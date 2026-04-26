import { google, type drive_v3 } from "googleapis";
import { Readable } from "node:stream";

/**
 * Google Drive integration via service account.
 *
 * Files are uploaded into a Shared Drive (or shared folder) whose root ID is
 * `GCP_DRIVE_SHARED_FOLDER_ID`. The service account credentials live in the
 * `GCP_DRIVE_SERVICE_ACCOUNT_JSON` env var as a full JSON blob — DO NOT commit
 * the JSON to the repo.
 *
 * Folder layout under the root:
 *   <root>/<YYYY>/<MM>/<jenis>/<id>_<sanitized_original_name>.<ext>
 *
 * Database stores only `driveFileId` + `driveWebViewLink`; bytes live solely
 * in Drive. Reading happens via `streamDriveFile` (bytes proxied through the
 * authenticated app, so users do NOT need Workspace membership to access
 * uploaded documents) or directly via `webViewLink` for users who DO have
 * Workspace access (admin staff usually).
 */

const SCOPES = ["https://www.googleapis.com/auth/drive"];

let _drive: drive_v3.Drive | null = null;

function isConfigured(): boolean {
  return Boolean(
    process.env.GCP_DRIVE_SERVICE_ACCOUNT_JSON &&
      process.env.GCP_DRIVE_SHARED_FOLDER_ID,
  );
}

export function isGdriveEnabled(): boolean {
  return isConfigured();
}

function getDrive(): drive_v3.Drive {
  if (_drive) return _drive;
  const raw = process.env.GCP_DRIVE_SERVICE_ACCOUNT_JSON;
  if (!raw) throw new Error("GCP_DRIVE_SERVICE_ACCOUNT_JSON is not set");
  let credentials: Record<string, unknown>;
  try {
    credentials = JSON.parse(raw);
  } catch {
    throw new Error("GCP_DRIVE_SERVICE_ACCOUNT_JSON is not valid JSON");
  }
  const auth = new google.auth.GoogleAuth({ credentials, scopes: SCOPES });
  _drive = google.drive({ version: "v3", auth });
  return _drive;
}

function getRootFolderId(): string {
  const id = process.env.GCP_DRIVE_SHARED_FOLDER_ID;
  if (!id) throw new Error("GCP_DRIVE_SHARED_FOLDER_ID is not set");
  return id;
}

const SHARED_DRIVE_OPTS = {
  supportsAllDrives: true,
  includeItemsFromAllDrives: true,
} as const;

const ROMAN_MONTHS = [
  "I",
  "II",
  "III",
  "IV",
  "V",
  "VI",
  "VII",
  "VIII",
  "IX",
  "X",
  "XI",
  "XII",
];

/**
 * Look up a folder by name under `parentId`, or create it if missing. We
 * cache lookups in-memory per process to avoid hammering the Drive API on
 * every upload.
 */
const folderCache = new Map<string, string>();

async function ensureChildFolder(
  parentId: string,
  name: string,
): Promise<string> {
  const cacheKey = `${parentId}/${name}`;
  const cached = folderCache.get(cacheKey);
  if (cached) return cached;

  const drive = getDrive();
  // Drive query: folder + name match + parent + not trashed.
  const escaped = name.replace(/['\\]/g, "\\$&");
  const q = [
    `'${parentId}' in parents`,
    `mimeType = 'application/vnd.google-apps.folder'`,
    `name = '${escaped}'`,
    `trashed = false`,
  ].join(" and ");

  const found = await drive.files.list({
    q,
    fields: "files(id, name)",
    pageSize: 1,
    ...SHARED_DRIVE_OPTS,
    corpora: "allDrives",
  });

  if (found.data.files && found.data.files.length > 0) {
    const id = found.data.files[0].id!;
    folderCache.set(cacheKey, id);
    return id;
  }

  const created = await drive.files.create({
    requestBody: {
      name,
      mimeType: "application/vnd.google-apps.folder",
      parents: [parentId],
    },
    fields: "id",
    supportsAllDrives: true,
  });
  const id = created.data.id!;
  folderCache.set(cacheKey, id);
  return id;
}

/**
 * Resolve (and lazily create) the path
 * `<root>/<YYYY>/<MM-romawi>/<jenis>` under the configured Shared Drive
 * root, returning the leaf folder ID.
 */
export async function ensureUploadFolderForToday(
  jenis: string,
  date: Date = new Date(),
): Promise<string> {
  const root = getRootFolderId();
  const year = String(date.getUTCFullYear());
  const month = ROMAN_MONTHS[date.getUTCMonth()];
  const yearId = await ensureChildFolder(root, year);
  const monthId = await ensureChildFolder(yearId, month);
  return ensureChildFolder(monthId, jenis);
}

export interface DriveUploadResult {
  fileId: string;
  webViewLink: string;
  webContentLink: string | null;
  name: string;
  size: number;
  mimeType: string;
}

export interface DriveUploadInput {
  bytes: Buffer;
  fileName: string;
  mimeType: string;
  /**
   * Stable record id (e.g. cuid of the RequestDocument or Certification).
   * Used as a prefix for the Drive file name so files sort cleanly and
   * collisions are impossible.
   */
  recordId: string;
  /**
   * Subfolder name representing the document category (e.g. "sertifikat",
   * "dokumen-pengajuan", "bukti-bkd", "kop-surat"). Used as the leaf
   * folder under <root>/<year>/<month>/.
   */
  jenis: string;
  /**
   * Optional explicit date overriding "today" — used by migration scripts
   * to file legacy uploads under their original month.
   */
  date?: Date;
}

/**
 * Upload bytes to Drive. Always issues a new fileId (no overwrite) and
 * returns the freshly-issued `webViewLink`. The file is configured with
 * "anyone with link can view" so the app UI can show a "Buka di Drive"
 * shortcut for users who don't need to round-trip through `/api/documents`.
 * Auth-gated bytes streaming remains available via `streamDriveFile`.
 */
export async function uploadFileToDrive(
  input: DriveUploadInput,
): Promise<DriveUploadResult> {
  const drive = getDrive();
  const folderId = await ensureUploadFolderForToday(input.jenis, input.date);
  const fileName = `${input.recordId}_${input.fileName}`;

  const created = await drive.files.create({
    requestBody: {
      name: fileName,
      parents: [folderId],
      mimeType: input.mimeType,
    },
    media: {
      mimeType: input.mimeType,
      body: Readable.from(input.bytes),
    },
    fields: "id, webViewLink, webContentLink, name, size, mimeType",
    supportsAllDrives: true,
  });

  const fileId = created.data.id;
  if (!fileId) throw new Error("Drive upload returned no file id");

  // Make the file accessible by anyone who possesses the (unguessable) link.
  // The app still gates LIST/VIEW access at the route level — only logged-in
  // users see the link in the UI. This permission lets HR/admins click
  // through to the native Drive viewer without needing Workspace access.
  try {
    await drive.permissions.create({
      fileId,
      requestBody: { type: "anyone", role: "reader" },
      supportsAllDrives: true,
    });
  } catch (err) {
    // Best-effort: some Shared Drive policies disallow anyone-with-link
    // sharing. Bytes streaming still works via the app's auth-gated route.
    console.warn("Drive permissions.create failed:", (err as Error).message);
  }

  return {
    fileId,
    webViewLink: created.data.webViewLink ?? `https://drive.google.com/file/d/${fileId}/view`,
    webContentLink: created.data.webContentLink ?? null,
    name: created.data.name ?? fileName,
    size: Number(created.data.size ?? input.bytes.byteLength),
    mimeType: created.data.mimeType ?? input.mimeType,
  };
}

/**
 * Fetch raw bytes for a Drive file by id. Used by API routes to proxy
 * downloads with auth gating intact.
 */
export async function streamDriveFile(
  fileId: string,
): Promise<{ bytes: Buffer; mimeType: string; name: string }> {
  const drive = getDrive();
  const meta = await drive.files.get({
    fileId,
    fields: "id, name, mimeType, size",
    supportsAllDrives: true,
  });
  const dl = await drive.files.get(
    { fileId, alt: "media", supportsAllDrives: true },
    { responseType: "arraybuffer" },
  );
  const bytes = Buffer.from(dl.data as ArrayBuffer);
  return {
    bytes,
    mimeType: meta.data.mimeType ?? "application/octet-stream",
    name: meta.data.name ?? fileId,
  };
}

/**
 * Permanent delete (skips Trash). Used by rollback paths when the
 * surrounding DB transaction fails.
 */
export async function deleteDriveFile(fileId: string): Promise<void> {
  const drive = getDrive();
  await drive.files.delete({ fileId, supportsAllDrives: true });
}

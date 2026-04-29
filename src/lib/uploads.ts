import { mkdir, writeFile, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { randomBytes } from "node:crypto";
import {
  isGdriveEnabled,
  uploadFileToDrive,
  streamDriveFile,
  deleteDriveFile,
  type DriveUploadResult,
} from "./gdrive";

/**
 * Root directory for uploaded documents when using local disk storage.
 * In production, uploads are offloaded first to Google Drive (when
 * `GCP_DRIVE_*` env vars are present), then to Vercel Blob (back-compat),
 * and only fall through to this directory in local development.
 */
export const UPLOAD_ROOT = path.join(process.cwd(), "uploads");

const SAFE_EXT = /\.(pdf|png|jpg|jpeg|webp|docx?|xlsx?)$/i;

/**
 * Server-side allowlist of MIME types keyed by file extension. The
 * client-provided `File.type` is NOT trusted — an attacker could upload an
 * HTML/JavaScript payload with a `.pdf` extension and a spoofed
 * `Content-Type: text/html`. Using this map when we both *store* and *serve*
 * uploads ensures the browser never renders untrusted content as HTML in our
 * origin.
 */
export const SAFE_MIME_BY_EXT: Record<string, string> = {
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".doc": "application/msword",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".xls": "application/vnd.ms-excel",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};

export function safeMimeFor(fileName: string): string {
  const m = fileName.toLowerCase().match(SAFE_EXT);
  if (!m) return "application/octet-stream";
  return SAFE_MIME_BY_EXT[m[0]] ?? "application/octet-stream";
}

function sanitizeName(name: string): string {
  return name.replace(/[^\w.\-]+/g, "_").slice(0, 120);
}

/**
 * Sentinel string written to `RequestDocument.storedPath` for files whose
 * canonical home is Google Drive. We never `fetch()` this URL — the bytes
 * are read via the Drive API using `driveFileId`. Keeping the sentinel
 * lets us preserve the existing `storedPath` NOT NULL constraint without
 * a destructive migration.
 */
export const GDRIVE_PATH_PREFIX = "gdrive://";

export interface SavedUpload {
  /**
   * Either:
   *   - `gdrive://<fileId>` for new uploads stored in Google Drive
   *   - an absolute `https://...blob.vercel-storage.com/...` URL for legacy
   *     Vercel Blob uploads
   *   - a relative path inside `UPLOAD_ROOT` for legacy local-disk uploads.
   * Consumers MUST use `readStoredUpload` rather than interpreting the value.
   */
  storedPath: string;
  /**
   * When the upload landed in Google Drive, these fields capture the
   * canonical Drive references. Persist them alongside `storedPath` in the
   * DB (see `RequestDocument.driveFileId` / `driveWebViewLink`).
   */
  driveFileId: string | null;
  driveWebViewLink: string | null;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
}

function isBlobStorageEnabled(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

/** Map our internal `kind` codes to a slugged Drive subfolder name. */
function jenisFolderFor(kind: string): string {
  const k = kind.toLowerCase();
  // Known kinds: lowercased DocumentKind enum members from Prisma schema
  // (SKP, LAST_SK_BERKALA, TRIDHARMA_PROOF, SURAT_PENGANTAR, SK_BERKALA)
  // plus app-specific tags ("cert" for sertifikasi, "letterhead" for kop).
  switch (k) {
    case "cert":
      return "sertifikat";
    case "letterhead":
      return "kop-surat";
    case "skp":
    case "last_sk_berkala":
    case "tridharma_proof":
    case "surat_pengantar":
    case "sk_berkala":
      return "dokumen-pengajuan";
    default:
      return k.replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "lainnya";
  }
}

/**
 * Persist a File from a multipart Server Action. Tries Drive → Blob →
 * local-disk in that order, depending on which credentials are configured.
 * The returned `driveFileId` is non-null only when storage landed in Drive.
 *
 * `recordId` should be the cuid of the row that will reference this upload
 * (e.g. the RequestDocument or Certification id). It becomes part of the
 * Drive file name so files sort cleanly even when many records share an
 * original filename like "scan.pdf".
 */
export async function saveUpload(
  file: File,
  scope: string,
  kind: string,
  recordId?: string,
): Promise<SavedUpload> {
  if (!file || file.size === 0) {
    throw new Error("Berkas tidak valid (kosong).");
  }
  if (file.size > 25 * 1024 * 1024) {
    throw new Error("Ukuran berkas melebihi 25 MB.");
  }
  const originalName = sanitizeName(file.name || "document");
  if (!SAFE_EXT.test(originalName)) {
    throw new Error("Format berkas tidak didukung. Unggah PDF/JPG/PNG/DOC/XLS.");
  }

  const random = randomBytes(6).toString("hex");
  const extMatch = originalName.match(SAFE_EXT);
  const ext = extMatch ? extMatch[0] : ".bin";
  const fileName = `${kind.toLowerCase()}-${random}${ext}`;
  const mimeType = safeMimeFor(fileName);
  const buffer = Buffer.from(await file.arrayBuffer());

  if (isGdriveEnabled()) {
    const result: DriveUploadResult = await uploadFileToDrive({
      bytes: buffer,
      fileName: originalName,
      mimeType,
      recordId: recordId ?? random,
      jenis: jenisFolderFor(kind),
    });
    return {
      storedPath: GDRIVE_PATH_PREFIX + result.fileId,
      driveFileId: result.fileId,
      driveWebViewLink: result.webViewLink,
      originalName,
      mimeType,
      sizeBytes: file.size,
    };
  }

  if (isBlobStorageEnabled()) {
    const { put } = await import("@vercel/blob");
    const key = `${scope}/${fileName}`;
    const blob = await put(key, buffer, {
      access: "public",
      contentType: mimeType,
      addRandomSuffix: false,
      allowOverwrite: false,
    });
    return {
      storedPath: blob.url,
      driveFileId: null,
      driveWebViewLink: null,
      originalName,
      mimeType,
      sizeBytes: file.size,
    };
  }

  const dir = path.join(UPLOAD_ROOT, scope);
  if (!existsSync(dir)) {
    await mkdir(dir, { recursive: true });
  }
  const abs = path.join(dir, fileName);
  await writeFile(abs, buffer);

  return {
    storedPath: `${scope}/${fileName}`,
    driveFileId: null,
    driveWebViewLink: null,
    originalName,
    mimeType,
    sizeBytes: file.size,
  };
}

/**
 * Best-effort cleanup helper for rollback paths. Removes a previously-
 * uploaded Drive file when the surrounding DB transaction failed to commit
 * so we never leave orphan files behind. Errors are swallowed and logged
 * because the original error (DB failure) is more important to surface.
 */
export async function rollbackUpload(saved: SavedUpload): Promise<void> {
  if (saved.driveFileId) {
    try {
      await deleteDriveFile(saved.driveFileId);
    } catch (err) {
      console.error("Drive rollback failed:", (err as Error).message);
    }
  }
  // Vercel Blob doesn't ship a delete in the runtime path we use, and a
  // local-disk file would just dangle in `./uploads/` — both are safe to
  // ignore for the dev/legacy fallbacks.
}

function isBlobUrl(storedPath: string): boolean {
  return /^https?:\/\//i.test(storedPath);
}

function isGdrivePath(storedPath: string): boolean {
  return storedPath.startsWith(GDRIVE_PATH_PREFIX);
}

/**
 * Strict allowlist of hostnames we're willing to issue an outbound `fetch()`
 * to when re-reading a stored upload. Vercel Blob URLs are served from
 * `<store-id>.public.blob.vercel-storage.com`; any other host (especially
 * internal metadata endpoints like `169.254.169.254` or private RFC1918
 * addresses) must be rejected as a defense-in-depth measure against DB
 * tampering / SSRF.
 */
function isTrustedBlobHost(storedPath: string): boolean {
  let host: string;
  try {
    host = new URL(storedPath).hostname.toLowerCase();
  } catch {
    return false;
  }
  return /^[a-z0-9-]+\.public\.blob\.vercel-storage\.com$/.test(host);
}

/**
 * Return the absolute local disk path for a stored upload. Only valid when
 * `storedPath` is NOT a Vercel Blob URL or Drive sentinel — callers should
 * use `readStoredUpload` instead.
 */
export function resolveUpload(storedPath: string): string {
  if (isBlobUrl(storedPath)) {
    throw new Error("resolveUpload cannot be used with Blob URLs");
  }
  if (isGdrivePath(storedPath)) {
    throw new Error("resolveUpload cannot be used with Drive paths");
  }
  const normalized = storedPath.replace(/\\/g, "/");
  if (normalized.includes("..")) throw new Error("Path tidak valid.");
  return path.join(UPLOAD_ROOT, normalized);
}

export type StoredUploadResult = { kind: "bytes"; bytes: Buffer; mimeType?: string };

/**
 * Read a stored upload and return raw bytes. Handles all three storage
 * backends transparently:
 *   - Drive (sentinel `gdrive://<id>` or explicit `driveFileId`)
 *   - Vercel Blob (https URL)
 *   - Local disk (relative path under `UPLOAD_ROOT`)
 *
 * Bytes are always proxied through the app's authenticated route so we
 * never expose Drive/Blob URLs directly to clients without going through
 * the same role check + CSP/nosniff headers.
 */
export async function readStoredUpload(
  storedPath: string,
  driveFileId?: string | null,
): Promise<StoredUploadResult> {
  // Prefer the explicit driveFileId column when present — `storedPath`
  // may still hold a legacy Blob URL on rows that haven't been migrated.
  if (driveFileId) {
    const { bytes, mimeType } = await streamDriveFile(driveFileId);
    return { kind: "bytes", bytes, mimeType };
  }
  if (isGdrivePath(storedPath)) {
    const fileId = storedPath.slice(GDRIVE_PATH_PREFIX.length);
    const { bytes, mimeType } = await streamDriveFile(fileId);
    return { kind: "bytes", bytes, mimeType };
  }
  if (isBlobUrl(storedPath)) {
    if (!isTrustedBlobHost(storedPath)) {
      throw new Error("Blob URL host tidak dikenali.");
    }
    const res = await fetch(storedPath, { cache: "no-store" });
    if (!res.ok) {
      throw new Error(`Blob fetch failed (${res.status})`);
    }
    const ab = await res.arrayBuffer();
    return { kind: "bytes", bytes: Buffer.from(ab) };
  }
  const abs = resolveUpload(storedPath);
  const bytes = await readFile(abs);
  return { kind: "bytes", bytes };
}

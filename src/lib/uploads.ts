import { mkdir, writeFile, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { randomBytes } from "node:crypto";

/**
 * Root directory for uploaded documents when using local disk storage.
 * In production on Vercel, uploads are offloaded to Vercel Blob (see
 * `saveUpload`) and this path is unused.
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

export interface SavedUpload {
  /**
   * Either a relative path inside `UPLOAD_ROOT` (for local disk) or an
   * absolute `https://...` URL (for Vercel Blob). Consumers MUST use
   * `readStoredUpload` rather than interpreting this value directly.
   */
  storedPath: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
}

function isBlobStorageEnabled(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

/**
 * Persist a File (from a multipart/form-data Server Action) either to local
 * disk (`uploads/<scope>/<kind>-<random>.<ext>`) or to Vercel Blob when the
 * `BLOB_READ_WRITE_TOKEN` env var is present.
 */
export async function saveUpload(
  file: File,
  scope: string,
  kind: string,
): Promise<SavedUpload> {
  if (!file || file.size === 0) {
    throw new Error("Berkas tidak valid (kosong).");
  }
  if (file.size > 10 * 1024 * 1024) {
    throw new Error("Ukuran berkas melebihi 10 MB.");
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

  if (isBlobStorageEnabled()) {
    const { put } = await import("@vercel/blob");
    const key = `${scope}/${fileName}`;
    const buffer = Buffer.from(await file.arrayBuffer());
    const blob = await put(key, buffer, {
      access: "public",
      contentType: mimeType,
      addRandomSuffix: false,
      allowOverwrite: false,
    });
    return {
      storedPath: blob.url,
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
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(abs, buffer);

  return {
    storedPath: `${scope}/${fileName}`,
    originalName,
    mimeType,
    sizeBytes: file.size,
  };
}

function isBlobUrl(storedPath: string): boolean {
  return /^https?:\/\//i.test(storedPath);
}

/**
 * Return the absolute local disk path for a stored upload. Only valid when
 * `storedPath` is NOT a Vercel Blob URL — callers should branch on
 * `isBlobUrl` first or use `readStoredUpload`.
 */
export function resolveUpload(storedPath: string): string {
  if (isBlobUrl(storedPath)) {
    throw new Error("resolveUpload cannot be used with Blob URLs");
  }
  const normalized = storedPath.replace(/\\/g, "/");
  if (normalized.includes("..")) throw new Error("Path tidak valid.");
  return path.join(UPLOAD_ROOT, normalized);
}

export type StoredUploadResult =
  | { kind: "bytes"; bytes: Buffer }
  | { kind: "redirect"; url: string };

/**
 * Read a stored upload, whether it lives on local disk or Vercel Blob.
 * Returns either raw bytes (to stream back) or a URL to 302 redirect to.
 */
export async function readStoredUpload(
  storedPath: string,
): Promise<StoredUploadResult> {
  if (isBlobUrl(storedPath)) {
    return { kind: "redirect", url: storedPath };
  }
  const abs = resolveUpload(storedPath);
  const bytes = await readFile(abs);
  return { kind: "bytes", bytes };
}

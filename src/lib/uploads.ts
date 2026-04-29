import { mkdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { randomBytes } from "node:crypto";

/**
 * Root directory for uploaded documents. Files are stored here (outside
 * `public/`) and served via an authenticated route that enforces access
 * control before streaming the bytes.
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
  storedPath: string; // relative to UPLOAD_ROOT, always using forward slashes
  originalName: string;
  mimeType: string;
  sizeBytes: number;
}

/**
 * Persist a File (from a multipart/form-data Server Action) under
 * `uploads/<requestId>/<kind>-<random>.<ext>`.
 */
export async function saveUpload(
  file: File,
  requestId: string,
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

  const dir = path.join(UPLOAD_ROOT, requestId);
  if (!existsSync(dir)) {
    await mkdir(dir, { recursive: true });
  }

  const random = randomBytes(6).toString("hex");
  const extMatch = originalName.match(SAFE_EXT);
  const ext = extMatch ? extMatch[0] : ".bin";
  const fileName = `${kind.toLowerCase()}-${random}${ext}`;
  const abs = path.join(dir, fileName);

  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(abs, buffer);

  return {
    storedPath: `${requestId}/${fileName}`,
    originalName,
    // Derive from the validated extension — never trust `file.type` because
    // the client can spoof it (e.g. .pdf with text/html to trigger stored XSS
    // when served inline).
    mimeType: safeMimeFor(fileName),
    sizeBytes: file.size,
  };
}

export function resolveUpload(storedPath: string): string {
  const normalized = storedPath.replace(/\\/g, "/");
  if (normalized.includes("..")) throw new Error("Path tidak valid.");
  return path.join(UPLOAD_ROOT, normalized);
}

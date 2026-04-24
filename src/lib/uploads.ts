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
    mimeType: file.type || "application/octet-stream",
    sizeBytes: file.size,
  };
}

export function resolveUpload(storedPath: string): string {
  const normalized = storedPath.replace(/\\/g, "/");
  if (normalized.includes("..")) throw new Error("Path tidak valid.");
  return path.join(UPLOAD_ROOT, normalized);
}

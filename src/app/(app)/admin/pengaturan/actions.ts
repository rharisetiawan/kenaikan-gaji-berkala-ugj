"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  ensureAppSettingsRow,
  DEFAULT_DOSEN_REQUIRED_BKD_PASSES,
  DEFAULT_INCREMENT_PERCENT,
  DEFAULT_STAFF_MIN_PERFORMANCE_SCORE,
} from "@/lib/app-settings";
import { saveUpload, rollbackUpload, type SavedUpload } from "@/lib/uploads";

export interface UpdateAppSettingsState {
  success?: string;
  error?: string;
}

/**
 * Parse a decimal from a user-typed percent field. The input is the
 * PERCENT value (e.g. "3" for 3%), NOT the fraction (0.03). We convert
 * here so the DB always stores the fraction.
 */
function parsePercentInput(raw: string, fallback: number): number {
  const trimmed = raw.trim().replace(",", ".");
  if (!trimmed) return fallback;
  const asPercent = Number(trimmed);
  if (!Number.isFinite(asPercent) || asPercent < 0 || asPercent > 100) {
    throw new Error(
      "Persentase kenaikan harus berupa angka antara 0 dan 100 (contoh: 3 untuk 3%).",
    );
  }
  return asPercent / 100;
}

function parseIntegerInRange(
  raw: string,
  min: number,
  max: number,
  label: string,
  fallback: number,
): number {
  const trimmed = raw.trim();
  if (!trimmed) return fallback;
  const n = Number(trimmed);
  if (!Number.isFinite(n) || !Number.isInteger(n)) {
    throw new Error(`${label} harus berupa bilangan bulat.`);
  }
  if (n < min || n > max) {
    throw new Error(`${label} harus antara ${min} dan ${max}.`);
  }
  return n;
}

/**
 * Update the three KGB rule variables stored in AppSetting. Does NOT
 * touch letterheadUrl — that flows through `uploadLetterheadAction`.
 */
export async function updateKgbRulesAction(
  _prev: UpdateAppSettingsState,
  formData: FormData,
): Promise<UpdateAppSettingsState> {
  await requireRole(["ADMIN"]);
  try {
    const incrementPercent = parsePercentInput(
      String(formData.get("incrementPercent") ?? ""),
      DEFAULT_INCREMENT_PERCENT,
    );
    const staffMinPerformanceScore = parseIntegerInRange(
      String(formData.get("staffMinPerformanceScore") ?? ""),
      0,
      100,
      "Nilai kinerja minimum",
      DEFAULT_STAFF_MIN_PERFORMANCE_SCORE,
    );
    const dosenRequiredBkdPasses = parseIntegerInRange(
      String(formData.get("dosenRequiredBkdPasses") ?? ""),
      1,
      6,
      "Jumlah semester BKD",
      DEFAULT_DOSEN_REQUIRED_BKD_PASSES,
    );

    await prisma.appSetting.upsert({
      where: { id: "singleton" },
      update: {
        incrementPercent,
        staffMinPerformanceScore,
        dosenRequiredBkdPasses,
      },
      create: {
        id: "singleton",
        incrementPercent,
        staffMinPerformanceScore,
        dosenRequiredBkdPasses,
      },
    });

    revalidatePath("/admin/pengaturan");
    // Any page that renders with these rules needs to re-fetch. Be generous
    // — the dashboards + evaluation list are the main consumers.
    revalidatePath("/dashboard");
    revalidatePath("/evaluations");
    revalidatePath("/employees");
    return { success: "Aturan KGB berhasil disimpan." };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

/**
 * Replace the letterhead image. We reuse `saveUpload()` for storage,
 * but enforce a stricter 5 MB cap here than the generic 25 MB cap used
 * for KGB documents: the letterhead is base64-inlined as a data URI by
 * `getLetterheadForPdf()` during every PDF render, so a 25 MB image
 * would balloon to ~33 MB of in-memory string per render and risk OOM
 * on Vercel's serverless runtime under concurrent load.
 */
const LETTERHEAD_MAX_BYTES = 5 * 1024 * 1024;

export async function uploadLetterheadAction(
  _prev: UpdateAppSettingsState,
  formData: FormData,
): Promise<UpdateAppSettingsState> {
  await requireRole(["ADMIN"]);
  let saved: SavedUpload | null = null;
  try {
    const file = formData.get("letterhead");
    if (!(file instanceof File) || file.size === 0) {
      return { error: "Berkas kop surat wajib dipilih." };
    }
    if (file.size > LETTERHEAD_MAX_BYTES) {
      return {
        error: "Ukuran berkas kop surat melebihi 5 MB. Kompres gambar (mis. ke PNG 300 DPI atau JPG quality 85) sebelum upload.",
      };
    }
    const lowered = file.name.toLowerCase();
    if (!/\.(png|jpe?g|webp)$/.test(lowered)) {
      return {
        error: "Format kop surat harus PNG, JPG, atau WEBP.",
      };
    }
    await ensureAppSettingsRow();
    saved = await saveUpload(file, "app-settings", "letterhead", "singleton");
    // PDFs read the letterhead via getLetterheadForPdf() which inlines a
    // base64 data URI for Drive-backed files (using the service account)
    // and falls through to letterheadUrl only for legacy Blob uploads.
    // We therefore store the webViewLink purely as an admin convenience
    // ("buka di Drive" link in /admin/pengaturan) — the PDF renderer
    // never depends on the file being publicly accessible.
    const letterheadUrl = saved.driveWebViewLink ?? saved.storedPath;
    await prisma.appSetting.update({
      where: { id: "singleton" },
      data: {
        letterheadUrl,
        letterheadDriveFileId: saved.driveFileId,
      },
    });

    revalidatePath("/admin/pengaturan");
    // Letterhead appears in every PDF — invalidate request pages too so
    // a regenerated PDF picks up the new image immediately.
    revalidatePath("/hr");
    revalidatePath("/rector");
    revalidatePath("/foundation");
    return { success: "Kop surat berhasil diunggah." };
  } catch (e) {
    // If the file landed in Drive but the AppSetting update failed,
    // remove the orphan so we don't leave an unreferenced kop surat
    // sitting in Drive with a public anyone-with-link permission.
    if (saved) await rollbackUpload(saved);
    return { error: (e as Error).message };
  }
}

/**
 * Clear the letterhead so PDFs fall back to the text-only institutional
 * header. We deliberately do NOT delete the underlying blob object —
 * keeping it around lets admins roll back by re-uploading the same file.
 */
export async function clearLetterheadAction(): Promise<void> {
  await requireRole(["ADMIN"]);
  await ensureAppSettingsRow();
  await prisma.appSetting.update({
    where: { id: "singleton" },
    data: { letterheadUrl: null, letterheadDriveFileId: null },
  });
  revalidatePath("/admin/pengaturan");
}

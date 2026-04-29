/**
 * Accessor for the single-row AppSetting table. All consumers should go
 * through these helpers instead of calling `prisma.appSetting.findFirst()`
 * directly so that (a) the row is auto-initialised on first read and
 * (b) missing fields fall back to safe defaults.
 *
 * The row is cached per React request via `cache()` — Server Components
 * that call `getKgbRules()` / `getLetterheadUrl()` multiple times in the
 * same render only issue a single SELECT.
 */

import { cache } from "react";
import { prisma } from "./prisma";

// Defaults mirror the legal university rule set. They MUST match the
// `@default(...)` values in prisma/schema.prisma → AppSetting so that a
// freshly-migrated DB without a row behaves identically to an explicit
// singleton row with defaults.
export const DEFAULT_INCREMENT_PERCENT = 0.03;
export const DEFAULT_STAFF_MIN_PERFORMANCE_SCORE = 76;
export const DEFAULT_DOSEN_REQUIRED_BKD_PASSES = 2;

export interface KgbRules {
  incrementPercent: number;
  staffMinPerformanceScore: number;
  dosenRequiredBkdPasses: number;
}

export const DEFAULT_KGB_RULES: KgbRules = {
  incrementPercent: DEFAULT_INCREMENT_PERCENT,
  staffMinPerformanceScore: DEFAULT_STAFF_MIN_PERFORMANCE_SCORE,
  dosenRequiredBkdPasses: DEFAULT_DOSEN_REQUIRED_BKD_PASSES,
};

export interface ResolvedAppSettings {
  id: string;
  letterheadUrl: string | null;
  letterheadDriveFileId: string | null;
  incrementPercent: number;
  staffMinPerformanceScore: number;
  dosenRequiredBkdPasses: number;
}

/**
 * Read the AppSetting singleton, returning defaults when the row is absent
 * or any column is null. Never throws — if the DB is unreachable during
 * a non-critical render path (PDF footer, etc.) we'd rather fall back to
 * defaults than 500 the whole page.
 */
export const getAppSettings = cache(async (): Promise<ResolvedAppSettings> => {
  try {
    const row = await prisma.appSetting.findUnique({
      where: { id: "singleton" },
    });
    if (!row) {
      return {
        id: "singleton",
        letterheadUrl: null,
        letterheadDriveFileId: null,
        ...DEFAULT_KGB_RULES,
      };
    }
    return {
      id: row.id,
      letterheadUrl: row.letterheadUrl,
      letterheadDriveFileId: row.letterheadDriveFileId,
      incrementPercent: row.incrementPercent,
      staffMinPerformanceScore: row.staffMinPerformanceScore,
      dosenRequiredBkdPasses: row.dosenRequiredBkdPasses,
    };
  } catch {
    return {
      id: "singleton",
      letterheadUrl: null,
      letterheadDriveFileId: null,
      ...DEFAULT_KGB_RULES,
    };
  }
});

export async function getKgbRules(): Promise<KgbRules> {
  const s = await getAppSettings();
  return {
    incrementPercent: s.incrementPercent,
    staffMinPerformanceScore: s.staffMinPerformanceScore,
    dosenRequiredBkdPasses: s.dosenRequiredBkdPasses,
  };
}

export async function getLetterheadUrl(): Promise<string | null> {
  const s = await getAppSettings();
  return s.letterheadUrl;
}

/**
 * Resolve the letterhead image into a value safe to pass directly to
 * `@react-pdf/renderer`'s `<Image src={...} />` from the server runtime.
 *
 * For Drive-backed letterheads we fetch the bytes via the service account
 * and inline them as a base64 data URI — this sidesteps the requirement
 * that Drive files have a public anyone-with-link permission, which some
 * Workspace policies disallow. For legacy Vercel Blob letterheads we
 * return the raw URL since `<Image>` can fetch public HTTPS URLs directly.
 *
 * Returns null when no letterhead is configured OR when the Drive fetch
 * fails (e.g. file deleted, service account lost access). PDFs gracefully
 * fall back to the text-only header in either case.
 */
export async function getLetterheadForPdf(): Promise<string | null> {
  const s = await getAppSettings();
  if (s.letterheadDriveFileId) {
    try {
      const { streamDriveFile } = await import("./gdrive");
      const { bytes, mimeType } = await streamDriveFile(s.letterheadDriveFileId);
      return `data:${mimeType};base64,${bytes.toString("base64")}`;
    } catch (err) {
      console.error("Letterhead Drive fetch failed:", (err as Error).message);
      return null;
    }
  }
  return s.letterheadUrl;
}

/**
 * Lazily create the singleton row on first write. The write path (admin
 * form submit) is the only place that needs to do this; the read path
 * tolerates a missing row via the default fallback above.
 */
export async function ensureAppSettingsRow(): Promise<void> {
  await prisma.appSetting.upsert({
    where: { id: "singleton" },
    update: {},
    create: {
      id: "singleton",
      letterheadUrl: null,
      incrementPercent: DEFAULT_INCREMENT_PERCENT,
      staffMinPerformanceScore: DEFAULT_STAFF_MIN_PERFORMANCE_SCORE,
      dosenRequiredBkdPasses: DEFAULT_DOSEN_REQUIRED_BKD_PASSES,
    },
  });
}

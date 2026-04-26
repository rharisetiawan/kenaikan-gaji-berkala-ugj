/**
 * One-time migration: move every legacy Vercel Blob / local-disk upload
 * referenced by RequestDocument, Certification, or AppSetting into Google
 * Drive, then update the row to record the new driveFileId / webViewLink.
 *
 * Idempotent — rows that already have a driveFileId are skipped, so the
 * script can be re-run safely if it errors halfway.
 *
 * Usage:
 *   npx tsx scripts/migrate-blob-to-drive.ts            # dry-run (default)
 *   npx tsx scripts/migrate-blob-to-drive.ts --apply    # actually migrate
 */
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import {
  isGdriveEnabled,
  uploadFileToDrive,
} from "../src/lib/gdrive";
import { readStoredUpload, safeMimeFor } from "../src/lib/uploads";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is not set");
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});
const APPLY = process.argv.includes("--apply");

interface MigrationCandidate {
  table: "RequestDocument" | "Certification" | "AppSetting";
  id: string;
  storedPath: string;
  originalName: string;
  jenis: string;
}

function jenisFolderForKind(kind: string): string {
  const k = kind.toLowerCase();
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
      return "lainnya";
  }
}

async function collect(): Promise<MigrationCandidate[]> {
  const out: MigrationCandidate[] = [];

  const reqDocs = await prisma.requestDocument.findMany({
    where: { driveFileId: null, storedPath: { not: { startsWith: "gdrive://" } } },
    select: { id: true, storedPath: true, originalName: true, kind: true },
  });
  for (const d of reqDocs) {
    out.push({
      table: "RequestDocument",
      id: d.id,
      storedPath: d.storedPath,
      originalName: d.originalName,
      jenis: jenisFolderForKind(d.kind),
    });
  }

  const certs = await prisma.certification.findMany({
    where: {
      driveFileId: null,
      filePath: { not: null },
    },
    select: { id: true, filePath: true, fileName: true },
  });
  for (const c of certs) {
    if (!c.filePath || c.filePath.startsWith("gdrive://")) continue;
    out.push({
      table: "Certification",
      id: c.id,
      storedPath: c.filePath,
      originalName: c.fileName ?? "sertifikat.pdf",
      jenis: "sertifikat",
    });
  }

  const setting = await prisma.appSetting.findUnique({
    where: { id: "singleton" },
  });
  if (
    setting?.letterheadUrl &&
    !setting.letterheadDriveFileId &&
    /^https?:\/\//i.test(setting.letterheadUrl)
  ) {
    // Letterheads in Blob were saved with synthetic filenames — pick a
    // sensible default extension so MIME / Drive folder stay consistent.
    out.push({
      table: "AppSetting",
      id: "singleton",
      storedPath: setting.letterheadUrl,
      originalName: "kop-surat.png",
      jenis: "kop-surat",
    });
  }

  return out;
}

async function migrateOne(c: MigrationCandidate): Promise<void> {
  const { bytes } = await readStoredUpload(c.storedPath, null);
  const mimeType = safeMimeFor(c.originalName);
  const result = await uploadFileToDrive({
    bytes,
    fileName: c.originalName,
    mimeType,
    recordId: c.id,
    jenis: c.jenis,
  });
  switch (c.table) {
    case "RequestDocument":
      await prisma.requestDocument.update({
        where: { id: c.id },
        data: {
          driveFileId: result.fileId,
          driveWebViewLink: result.webViewLink,
          storedPath: `gdrive://${result.fileId}`,
        },
      });
      break;
    case "Certification":
      await prisma.certification.update({
        where: { id: c.id },
        data: {
          driveFileId: result.fileId,
          driveWebViewLink: result.webViewLink,
          filePath: `gdrive://${result.fileId}`,
        },
      });
      break;
    case "AppSetting":
      await prisma.appSetting.update({
        where: { id: c.id },
        data: {
          letterheadDriveFileId: result.fileId,
          letterheadUrl: result.webViewLink,
        },
      });
      break;
  }
}

async function main(): Promise<void> {
  if (!isGdriveEnabled()) {
    throw new Error(
      "GCP_DRIVE_SERVICE_ACCOUNT_JSON / GCP_DRIVE_SHARED_FOLDER_ID not set — refusing to run.",
    );
  }
  const candidates = await collect();
  console.log(
    `Found ${candidates.length} legacy upload(s) needing migration.`,
  );
  if (candidates.length === 0) return;
  for (const c of candidates) {
    console.log(
      `  [${c.table}] ${c.id}  ←  ${c.storedPath.slice(0, 80)}…  →  Drive/${c.jenis}/`,
    );
  }
  if (!APPLY) {
    console.log("\nDry-run only. Re-run with --apply to perform the migration.");
    return;
  }
  let ok = 0;
  let failed = 0;
  for (const c of candidates) {
    try {
      await migrateOne(c);
      ok += 1;
      console.log(`  ✓ migrated ${c.table}/${c.id}`);
    } catch (err) {
      failed += 1;
      console.error(
        `  ✗ FAILED ${c.table}/${c.id}: ${(err as Error).message}`,
      );
    }
  }
  console.log(`\nDone. ${ok} migrated, ${failed} failed.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

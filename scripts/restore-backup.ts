/**
 * Restore a Neon snapshot produced by /api/cron/backup-db. Reads a local
 * `.json.gz` file, ingests rows in dependency-friendly order, and uses
 * upsert (or createMany skipDuplicates) so the script can be run against
 * an empty DB or a partially-populated one.
 *
 * Usage:
 *   npx tsx scripts/restore-backup.ts ./backup.json.gz
 *
 * SAFETY: this script DOES NOT truncate target tables. If you need a
 * clean restore, drop the DB first or run `prisma migrate reset` before
 * invoking it. Refusing to truncate by default is intentional — most
 * recovery scenarios want to merge backed-up rows into a fresh schema,
 * not nuke whatever the operator already typed in.
 */
import { gunzipSync } from "node:zlib";
import { readFileSync } from "node:fs";
import { PrismaClient, Prisma } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is not set");
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});
const file = process.argv[2];

if (!file) {
  console.error("Usage: tsx scripts/restore-backup.ts <path-to-backup.json.gz>");
  process.exit(2);
}

interface BackupTable {
  rows: number;
  data: unknown[];
}
interface BackupPayload {
  generatedAt: string;
  schemaVersion: number;
  tables: Record<string, BackupTable>;
}

function loadBackup(path: string): BackupPayload {
  const gz = readFileSync(path);
  const json = gunzipSync(gz).toString("utf-8");
  return JSON.parse(json) as BackupPayload;
}

// Insertion order respects FK dependencies (parents before children).
const ORDER: Array<keyof PrismaClient & string> = [
  "user",
  "academicRank",
  "payGrade",
  "employee",
  "dosenDetail",
  "staffDetail",
  "bkdEvaluation",
  "performanceScore",
  "incrementRequest",
  "requestDocument",
  "incrementHistory",
  "certification",
  "publication",
  "orgOfficial",
  "appSetting",
];

const TABLE_TO_DELEGATE: Record<string, string> = {
  User: "user",
  AcademicRank: "academicRank",
  PayGrade: "payGrade",
  Employee: "employee",
  DosenDetail: "dosenDetail",
  StaffDetail: "staffDetail",
  BkdEvaluation: "bkdEvaluation",
  PerformanceScore: "performanceScore",
  IncrementRequest: "incrementRequest",
  RequestDocument: "requestDocument",
  IncrementHistory: "incrementHistory",
  Certification: "certification",
  Publication: "publication",
  OrgOfficial: "orgOfficial",
  AppSetting: "appSetting",
};

async function main(): Promise<void> {
  const payload = loadBackup(file);
  console.log(
    `Restoring snapshot from ${payload.generatedAt} (schema v${payload.schemaVersion})`,
  );

  for (const delegateName of ORDER) {
    const tableName = Object.keys(TABLE_TO_DELEGATE).find(
      (k) => TABLE_TO_DELEGATE[k] === delegateName,
    );
    if (!tableName) continue;
    const t = payload.tables[tableName];
    if (!t || t.rows === 0) {
      console.log(`  · ${tableName}: empty, skip`);
      continue;
    }
    // Date-typed fields are emitted as ISO strings by JSON.stringify;
    // Prisma's runtime accepts ISO strings on Date columns, so no extra
    // post-processing is needed.
    const delegate = (
      prisma as unknown as Record<string, { createMany: (args: unknown) => Promise<Prisma.BatchPayload> }>
    )[delegateName];
    const result = await delegate.createMany({
      data: t.data,
      skipDuplicates: true,
    });
    console.log(
      `  ✓ ${tableName}: ${result.count}/${t.rows} inserted (duplicates skipped)`,
    );
  }
  console.log("Restore complete.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

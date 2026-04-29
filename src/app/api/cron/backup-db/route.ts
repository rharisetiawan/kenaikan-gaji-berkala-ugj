import { NextRequest, NextResponse } from "next/server";
import { gzipSync } from "node:zlib";
import { prisma } from "@/lib/prisma";
import {
  isGdriveEnabled,
  ensureFolderUnderRoot,
  uploadBytesToFolder,
  listFolderFiles,
  deleteDriveFile,
} from "@/lib/gdrive";

/**
 * Daily Neon → Drive backup. Runs on Vercel Cron (see vercel.json) at
 * 02:00 WIB / 19:00 UTC. Also callable manually with the right header so
 * a sysadmin can force a snapshot from outside Vercel.
 *
 * Auth: caller MUST present the `CRON_SECRET` env var either as a Bearer
 * token (Vercel Cron does this automatically) or as the `x-cron-secret`
 * header. We intentionally accept both so external uptime services
 * (cron-job.org etc.) can be wired in without Vercel-specific headers.
 *
 * Backup format: a single gzipped JSON document with one key per Prisma
 * model containing the full table contents. Restorable with a small
 * counterpart script (`scripts/restore-backup.ts`, see below). This
 * avoids needing pg_dump on Vercel's serverless runtime.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RETENTION_DAYS = 30;
const BACKUP_FOLDER_NAME = "_backups";

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const headerValue =
    req.headers.get("x-cron-secret") ??
    req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
    "";
  return headerValue === secret;
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

async function dumpAllTables(): Promise<BackupPayload> {
  // Order doesn't matter for the JSON dump — restore script handles FK
  // ordering. We collect every Prisma model that holds business data.
  //
  // SECURITY: User rows are stripped of `passwordHash` before serialization.
  // The backup file lives in a Shared Drive that's accessible to every
  // member, so we never let bcrypt hashes leave the primary database. On
  // restore, scripts/restore-backup.ts injects a placeholder hash that
  // forces a password reset for any user that didn't already exist in the
  // target DB.
  const [
    rawUsers,
    academicRanks,
    payGrades,
    employees,
    dosenDetails,
    staffDetails,
    bkdEvaluations,
    performanceScores,
    incrementRequests,
    requestDocuments,
    incrementHistories,
    certifications,
    publications,
    orgOfficials,
    appSettings,
  ] = await Promise.all([
    prisma.user.findMany(),
    prisma.academicRank.findMany(),
    prisma.payGrade.findMany(),
    prisma.employee.findMany(),
    prisma.dosenDetail.findMany(),
    prisma.staffDetail.findMany(),
    prisma.bkdEvaluation.findMany(),
    prisma.performanceScore.findMany(),
    prisma.incrementRequest.findMany(),
    prisma.requestDocument.findMany(),
    prisma.incrementHistory.findMany(),
    prisma.certification.findMany(),
    prisma.publication.findMany(),
    prisma.orgOfficial.findMany(),
    prisma.appSetting.findMany(),
  ]);

  const users = rawUsers.map((u) => {
    const copy: Record<string, unknown> = { ...u };
    delete copy.passwordHash;
    return copy;
  });

  const wrap = (data: unknown[]): BackupTable => ({ rows: data.length, data });
  return {
    generatedAt: new Date().toISOString(),
    schemaVersion: 1,
    tables: {
      User: wrap(users),
      AcademicRank: wrap(academicRanks),
      PayGrade: wrap(payGrades),
      Employee: wrap(employees),
      DosenDetail: wrap(dosenDetails),
      StaffDetail: wrap(staffDetails),
      BkdEvaluation: wrap(bkdEvaluations),
      PerformanceScore: wrap(performanceScores),
      IncrementRequest: wrap(incrementRequests),
      RequestDocument: wrap(requestDocuments),
      IncrementHistory: wrap(incrementHistories),
      Certification: wrap(certifications),
      Publication: wrap(publications),
      OrgOfficial: wrap(orgOfficials),
      AppSetting: wrap(appSettings),
    },
  };
}

/**
 * Sweep backups older than RETENTION_DAYS. Best-effort — failures here
 * never abort the response since the new snapshot is the important part.
 */
async function pruneOldBackups(folderId: string): Promise<{
  deleted: string[];
  errors: string[];
}> {
  const cutoff = Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000;
  const files = await listFolderFiles(folderId);
  const deleted: string[] = [];
  const errors: string[] = [];
  for (const f of files) {
    const created = new Date(f.createdTime).getTime();
    if (Number.isFinite(created) && created < cutoff) {
      try {
        await deleteDriveFile(f.id);
        deleted.push(f.name);
      } catch (err) {
        errors.push(`${f.name}: ${(err as Error).message}`);
      }
    }
  }
  return { deleted, errors };
}

async function runBackup(): Promise<NextResponse> {
  if (!isGdriveEnabled()) {
    return NextResponse.json(
      { ok: false, error: "Drive credentials missing." },
      { status: 503 },
    );
  }

  const folderId = await ensureFolderUnderRoot(BACKUP_FOLDER_NAME);
  const payload = await dumpAllTables();
  const json = JSON.stringify(payload);
  const gz = gzipSync(Buffer.from(json, "utf-8"));

  const stamp = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const fileName = `${stamp}-${Date.now()}.json.gz`;

  const { fileId, size } = await uploadBytesToFolder(
    folderId,
    fileName,
    gz,
    "application/gzip",
  );

  // Retention sweep runs after the new snapshot is safely uploaded so we
  // never delete the only good backup before producing its replacement.
  const sweep = await pruneOldBackups(folderId);

  const totalRows = Object.values(payload.tables).reduce(
    (acc, t) => acc + t.rows,
    0,
  );

  return NextResponse.json({
    ok: true,
    fileId,
    fileName,
    sizeBytes: size,
    totalRows,
    tables: Object.fromEntries(
      Object.entries(payload.tables).map(([k, v]) => [k, v.rows]),
    ),
    retention: {
      days: RETENTION_DAYS,
      deleted: sweep.deleted.length,
      deletedNames: sweep.deleted,
      errors: sweep.errors,
    },
  });
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  if (!authorized(req)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  try {
    return await runBackup();
  } catch (err) {
    console.error("Backup failed:", err);
    return NextResponse.json(
      { ok: false, error: (err as Error).message },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  return GET(req);
}

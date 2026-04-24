/**
 * Import employees from the legacy "REKAP BERKALA DIEDIT 2019 April.xlsx"
 * file provided by UNIGA Malang.
 *
 * Source-of-truth sheet inside the workbook: "Data Karyawan (FINAL)".
 * Pre-processed and deduplicated (latest cycle per unique fullName) into
 * `prisma/data/rekap-berkala-2019.json` — re-generate that file from the
 * raw .xlsx with `scripts/generate-rekap-json.py` if the Excel source is
 * updated.
 *
 * Each row is mapped into:
 *   - Employee  (type=STAFF, status=ACTIVE)
 *   - StaffDetail (links to PayGrade by code)
 *   - User      (role=EMPLOYEE, email @unigamalang.ac.id)
 *
 * The script is idempotent: re-running will upsert on (Employee.nip) and
 * (User.email), so no duplicates are created.
 *
 * Run with: `npx tsx prisma/import-rekap-berkala.ts`
 */
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";
import { computeNextIncrementDate } from "../src/lib/eligibility";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is not set");
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

interface RekapRow {
  fullName: string;
  nis: string;
  email: string;
  hireDate: string | null;
  golongan: string | null;
  currentBaseSalary: number;
  previousBaseSalary: number;
  lastIncrementDate: string | null;
  skNomor: string | null;
  status: string | null;
}

async function main() {
  const jsonPath = path.join(__dirname, "data", "rekap-berkala-2019.json");
  if (!fs.existsSync(jsonPath)) {
    throw new Error(
      `Missing ${jsonPath}. Regenerate it from the REKAP BERKALA Excel file using scripts/generate-rekap-json.py.`,
    );
  }
  const rows: RekapRow[] = JSON.parse(fs.readFileSync(jsonPath, "utf-8"));

  const grades = await prisma.payGrade.findMany();
  const gradeByCode = new Map(grades.map((g) => [g.code, g]));

  const report = {
    total: rows.length,
    imported: 0,
    updated: 0,
    skipped: [] as Array<{ row: RekapRow; reason: string }>,
    userAccountsCreated: 0,
  };

  const defaultPassword = await bcrypt.hash("pegawai123", 10);

  for (const row of rows) {
    // Validation
    if (!row.fullName || !row.email || !row.nis) {
      report.skipped.push({ row, reason: "Nama/NIS/email kosong" });
      continue;
    }
    if (!row.hireDate) {
      report.skipped.push({ row, reason: "TMT SK Keluar tidak ada" });
      continue;
    }
    if (!row.currentBaseSalary || row.currentBaseSalary <= 0) {
      report.skipped.push({ row, reason: "Gaji Baru tidak valid" });
      continue;
    }
    const grade = row.golongan ? gradeByCode.get(row.golongan) : undefined;
    if (!grade) {
      report.skipped.push({ row, reason: `Golongan "${row.golongan}" belum ada di PayGrade` });
      continue;
    }

    const hire = new Date(row.hireDate);
    const lastInc = row.lastIncrementDate ? new Date(row.lastIncrementDate) : null;
    const nextInc = computeNextIncrementDate({ hireDate: hire, lastIncrementDate: lastInc });

    // Synthetic birthDate (Excel has none): assume 25 y/o at hire.
    const synthBirth = new Date(hire);
    synthBirth.setFullYear(synthBirth.getFullYear() - 25);

    const before = await prisma.employee.findUnique({ where: { nip: row.nis } });
    // Handle email collisions with existing (seed) employees. We prefer to
    // keep the imported row's NIS intact and disambiguate the email by
    // appending the NIS's last 3 digits, keeping the login domain consistent.
    const emailOwner = await prisma.employee.findUnique({ where: { email: row.email } });
    let email = row.email;
    if (emailOwner && emailOwner.nip !== row.nis) {
      const suffix = row.nis.slice(-3);
      email = row.email.replace("@unigamalang.ac.id", `.${suffix}@unigamalang.ac.id`);
    }

    await prisma.employee.upsert({
      where: { nip: row.nis },
      update: {
        fullName: row.fullName,
        email,
        currentBaseSalary: row.currentBaseSalary,
        lastIncrementDate: lastInc,
        nextIncrementDate: nextInc,
        hireDate: hire,
        staffDetail: {
          upsert: {
            create: {
              payGradeId: grade.id,
              lastGradeDate: lastInc ?? hire,
              unit: "Tenaga Kependidikan",
              position: "Staf Administrasi",
            },
            update: {
              payGradeId: grade.id,
              lastGradeDate: lastInc ?? hire,
            },
          },
        },
      },
      create: {
        nip: row.nis,
        fullName: row.fullName,
        email,
        gender: guessGender(row.fullName),
        birthDate: synthBirth,
        type: "STAFF",
        hireDate: hire,
        currentBaseSalary: row.currentBaseSalary,
        lastIncrementDate: lastInc,
        nextIncrementDate: nextInc,
        status: "ACTIVE",
        staffDetail: {
          create: {
            payGradeId: grade.id,
            lastGradeDate: lastInc ?? hire,
            unit: "Tenaga Kependidikan",
            position: "Staf Administrasi",
          },
        },
      },
    });

    if (before) report.updated += 1;
    else report.imported += 1;

    // User account linking (create if missing)
    const emp = await prisma.employee.findUnique({ where: { nip: row.nis } });
    if (!emp) continue;
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (!existingUser) {
      await prisma.user.create({
        data: {
          email,
          passwordHash: defaultPassword,
          name: row.fullName,
          role: "EMPLOYEE",
          employeeId: emp.id,
        },
      });
      report.userAccountsCreated += 1;
    } else if (!existingUser.employeeId) {
      await prisma.user.update({
        where: { id: existingUser.id },
        data: { employeeId: emp.id, name: row.fullName },
      });
    }
  }

  console.log("────────────────────────────────────────────────");
  console.log("  REKAP BERKALA import summary");
  console.log("────────────────────────────────────────────────");
  console.log(`  Rows in JSON      : ${report.total}`);
  console.log(`  New employees     : ${report.imported}`);
  console.log(`  Updated employees : ${report.updated}`);
  console.log(`  User accounts new : ${report.userAccountsCreated}`);
  console.log(`  Skipped           : ${report.skipped.length}`);
  for (const s of report.skipped) {
    console.log(`    - ${s.row.fullName}: ${s.reason}`);
  }
}

// Very rough gender guess from first-name suffix — the Excel has no gender field.
// This is purely cosmetic (Employee.gender is required). HR can correct it later.
function guessGender(name: string): "MALE" | "FEMALE" {
  const first = name.trim().split(/\s+/)[0].toLowerCase();
  const femalePrefixes = ["sri", "titik", "yuli", "antik", "rina", "nur", "fitri", "siti", "ibu"];
  const femaleSuffixes = ["ati", "tik", "sih", "ani", "ati,", "wati", "yati", "ina", "ita"];
  if (femalePrefixes.some((p) => first.startsWith(p))) return "FEMALE";
  if (femaleSuffixes.some((s) => first.endsWith(s))) return "FEMALE";
  return "MALE";
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });

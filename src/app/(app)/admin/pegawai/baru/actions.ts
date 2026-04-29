"use server";

import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { computeNextIncrementDate } from "@/lib/eligibility";
import type { EmployeeType, Gender, EmploymentStatus } from "@prisma/client";

const EMPLOYEE_TYPES: readonly EmployeeType[] = ["DOSEN", "STAFF"];
const GENDERS: readonly Gender[] = ["MALE", "FEMALE"];
const EMPLOYMENT_STATUSES: readonly EmploymentStatus[] = [
  "TETAP",
  "KONTRAK",
  "HONORER",
];

function generateTempPassword(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  const buf = randomBytes(10);
  let out = "";
  for (let i = 0; i < 10; i++) out += alphabet[buf[i] % alphabet.length];
  return out;
}

export interface CreateEmployeeState {
  error?: string;
  success?: string;
  // Newly created account's login credentials (shown ONCE).
  newEmail?: string;
  newPassword?: string;
}

function req(formData: FormData, key: string, label: string): string {
  const v = String(formData.get(key) ?? "").trim();
  if (!v) throw new Error(`${label} wajib diisi.`);
  return v;
}

function optionalNumber(formData: FormData, key: string): number | null {
  const v = String(formData.get(key) ?? "").trim();
  if (!v) return null;
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) throw new Error(`Nilai ${key} tidak valid.`);
  return n;
}

export async function createEmployeeAction(
  _prev: CreateEmployeeState,
  formData: FormData,
): Promise<CreateEmployeeState> {
  await requireRole(["ADMIN"]);

  try {
    const type = req(formData, "type", "Tipe pegawai") as EmployeeType;
    if (!EMPLOYEE_TYPES.includes(type)) throw new Error("Tipe pegawai tidak valid.");

    const gender = req(formData, "gender", "Jenis kelamin") as Gender;
    if (!GENDERS.includes(gender)) throw new Error("Jenis kelamin tidak valid.");

    const employmentStatus = req(
      formData,
      "employmentStatus",
      "Status hubungan kerja",
    ) as EmploymentStatus;
    if (!EMPLOYMENT_STATUSES.includes(employmentStatus))
      throw new Error("Status hubungan kerja tidak valid.");

    const nip = req(formData, "nip", "NIP");
    const fullName = req(formData, "fullName", "Nama lengkap");
    const email = req(formData, "email", "Email").toLowerCase();
    if (!/^[\w.+-]+@[\w.-]+\.\w+$/.test(email))
      throw new Error("Format email tidak valid.");
    const birthDate = new Date(req(formData, "birthDate", "Tanggal lahir"));
    const hireDate = new Date(req(formData, "hireDate", "Tanggal mulai kerja (TMT)"));
    const baseSalary = optionalNumber(formData, "currentBaseSalary");
    if (baseSalary == null) throw new Error("Gaji pokok wajib diisi.");
    const lastIncrementStr = String(formData.get("lastIncrementDate") ?? "").trim();
    const lastIncrementDate = lastIncrementStr ? new Date(lastIncrementStr) : null;

    // Type-specific fields
    let dosenDetailCreate: {
      nidn: string;
      academicRankId: number;
      faculty: string;
      studyProgram: string;
    } | null = null;
    let staffDetailCreate: {
      payGradeId: number;
      unit: string;
      position: string;
    } | null = null;

    if (type === "DOSEN") {
      const nidn = req(formData, "nidn", "NIDN");
      // Number("") === 0 passes Number.isFinite, so guard with > 0 to catch
      // the empty placeholder option without leaking a Prisma FK error.
      const academicRankId = Number(formData.get("academicRankId"));
      if (!Number.isFinite(academicRankId) || academicRankId <= 0)
        throw new Error("Jabatan akademik wajib dipilih.");
      dosenDetailCreate = {
        nidn,
        academicRankId,
        faculty: req(formData, "faculty", "Fakultas"),
        studyProgram: req(formData, "studyProgram", "Program Studi"),
      };
    } else {
      const payGradeId = Number(formData.get("payGradeId"));
      if (!Number.isFinite(payGradeId) || payGradeId <= 0)
        throw new Error("Golongan wajib dipilih.");
      staffDetailCreate = {
        payGradeId,
        unit: req(formData, "unit", "Unit kerja"),
        position: req(formData, "position", "Jabatan"),
      };
    }

    // Duplicate checks (Prisma would also throw on unique violation; this
    // just gives a friendlier error message).
    const dupeNip = await prisma.employee.findUnique({ where: { nip } });
    if (dupeNip) throw new Error("NIP sudah terdaftar di pegawai lain.");
    const dupeEmail = await prisma.user.findUnique({ where: { email } });
    if (dupeEmail) throw new Error("Email sudah dipakai pengguna lain.");

    const nextIncrementDate = computeNextIncrementDate({
      hireDate,
      lastIncrementDate,
    });

    const tempPassword = generateTempPassword();
    const passwordHash = await bcrypt.hash(tempPassword, 10);

    // Create Employee + User atomically — if the user insert races against
    // another admin and loses the unique-email check, we don't want an
    // orphaned Employee row left behind (the admin would then hit
    // "NIP sudah terdaftar" on retry).
    await prisma.$transaction(async (tx) => {
      const employee = await tx.employee.create({
        data: {
          nip,
          fullName,
          gender,
          birthDate,
          email,
          type,
          hireDate,
          currentBaseSalary: baseSalary,
          lastIncrementDate,
          nextIncrementDate,
          employmentStatus,
          ...(dosenDetailCreate
            ? { dosenDetail: { create: dosenDetailCreate } }
            : {}),
          ...(staffDetailCreate
            ? { staffDetail: { create: staffDetailCreate } }
            : {}),
        },
      });
      await tx.user.create({
        data: {
          email,
          name: fullName,
          role: "EMPLOYEE",
          passwordHash,
          employeeId: employee.id,
        },
      });
    });

    revalidatePath("/admin/users");
    revalidatePath("/employees");
    return {
      success: "Pegawai & akun berhasil dibuat.",
      newEmail: email,
      newPassword: tempPassword,
    };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Gagal membuat pegawai.",
    };
  }
}

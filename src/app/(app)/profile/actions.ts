"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import type {
  LastEducation,
  MaritalStatus,
  Religion,
} from "@prisma/client";

// Acceptable enum values (kept as plain arrays so we can validate raw form
// strings without importing runtime enums from @prisma/client).
const RELIGIONS: readonly Religion[] = [
  "ISLAM",
  "KRISTEN",
  "KATOLIK",
  "HINDU",
  "BUDDHA",
  "KONGHUCU",
];
const EDUCATIONS: readonly LastEducation[] = [
  "SD",
  "SMP",
  "SMA",
  "D3",
  "S1",
  "S2",
  "S3",
];
const MARITAL_STATUSES: readonly MaritalStatus[] = [
  "BELUM_KAWIN",
  "KAWIN",
  "CERAI_HIDUP",
  "CERAI_MATI",
];

function normalizeOptional(raw: FormDataEntryValue | null): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function parseEnum<T extends string>(
  raw: FormDataEntryValue | null,
  allowed: readonly T[],
): T | null {
  const value = normalizeOptional(raw);
  if (!value) return null;
  if (!allowed.includes(value as T)) {
    throw new Error(`Nilai tidak valid: ${value}`);
  }
  return value as T;
}

function parseNik(raw: FormDataEntryValue | null): string | null {
  const value = normalizeOptional(raw);
  if (!value) return null;
  if (!/^\d{16}$/.test(value)) {
    throw new Error("NIK harus berupa 16 digit angka.");
  }
  return value;
}

function parseDependents(raw: FormDataEntryValue | null): number | null {
  if (typeof raw !== "string" || raw.trim() === "") return null;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 0 || n > 20) {
    throw new Error("Jumlah tanggungan harus bilangan bulat 0–20.");
  }
  return n;
}

/**
 * Employee self-service: update the subset of profile fields the user owns.
 * Sensitive fields (NIP, salary, golongan, TMT, employmentStatus) are NOT
 * updatable here — those remain HR-only via /employees/[id].
 */
export async function updateMyProfileAction(formData: FormData): Promise<void> {
  const session = await requireUser();

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    include: { employee: { include: { dosenDetail: true } } },
  });
  if (!user?.employee) {
    throw new Error("Akun Anda belum tertaut dengan data pegawai.");
  }
  const employee = user.employee;

  const phone = normalizeOptional(formData.get("phone"));
  const address = normalizeOptional(formData.get("address"));
  const placeOfBirth = normalizeOptional(formData.get("placeOfBirth"));
  const nik = parseNik(formData.get("nik"));
  const religion = parseEnum(formData.get("religion"), RELIGIONS);
  const lastEducation = parseEnum(
    formData.get("lastEducation"),
    EDUCATIONS,
  );
  const maritalStatus = parseEnum(
    formData.get("maritalStatus"),
    MARITAL_STATUSES,
  );
  const dependentsCount = parseDependents(formData.get("dependentsCount"));
  const emergencyContact = normalizeOptional(formData.get("emergencyContact"));

  // Dosen-only research identifiers. Silently ignored for Staff to keep the
  // form simple; the Staff form doesn't even render them.
  const isDosen = employee.type === "DOSEN";
  const scopusId = isDosen ? normalizeOptional(formData.get("scopusId")) : null;
  const sintaId = isDosen ? normalizeOptional(formData.get("sintaId")) : null;
  const orcid = isDosen ? normalizeOptional(formData.get("orcid")) : null;
  const googleScholarId = isDosen
    ? normalizeOptional(formData.get("googleScholarId"))
    : null;

  // Uniqueness check + update are wrapped in a single Serializable transaction
  // to close the TOCTOU window between the check and the write — matches the
  // pattern used in requests/actions.ts for cover-letter numbering.
  await prisma.$transaction(
    async (tx) => {
      if (nik) {
        const conflict = await tx.employee.findFirst({
          where: { nik, id: { not: employee.id } },
          select: { id: true },
        });
        if (conflict) {
          throw new Error("NIK tersebut sudah terdaftar pada pegawai lain.");
        }
      }

      await tx.employee.update({
        where: { id: employee.id },
        data: {
          phone,
          address,
          placeOfBirth,
          nik,
          religion,
          lastEducation,
          maritalStatus,
          dependentsCount,
          emergencyContact,
          profileUpdatedAt: new Date(),
        },
      });

      if (isDosen && employee.dosenDetail) {
        await tx.dosenDetail.update({
          where: { employeeId: employee.id },
          data: {
            scopusId,
            sintaId,
            orcid,
            googleScholarId,
          },
        });
      }
    },
    { isolationLevel: "Serializable" },
  );

  revalidatePath("/profile");
  revalidatePath("/dashboard");
}

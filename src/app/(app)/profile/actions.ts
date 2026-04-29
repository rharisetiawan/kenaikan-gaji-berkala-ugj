"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { rollbackUpload, saveUpload } from "@/lib/uploads";
import type {
  LastEducation,
  MaritalStatus,
  Religion,
} from "@prisma/client";

const PHOTO_MAX_BYTES = 5 * 1024 * 1024;
const PHOTO_MIME_ALLOWLIST = new Set(["image/jpeg", "image/png", "image/webp"]);
const PHOTO_EXT_ALLOWLIST = /\.(jpe?g|png|webp)$/i;

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

export interface PhotoUploadState {
  success?: string;
  error?: string;
}

/**
 * Upload (or replace) the current user's profile photo. Goes through the
 * same `saveUpload` pipeline as documents (Drive in production, Blob/local
 * fallback) but with a stricter 5 MB cap and an image-only MIME allowlist
 * because the photo is shown inline in lots of places.
 */
export async function uploadMyPhotoAction(
  _prev: PhotoUploadState,
  formData: FormData,
): Promise<PhotoUploadState> {
  const session = await requireUser();
  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { employeeId: true },
  });
  if (!user?.employeeId) {
    return { error: "Akun Anda belum tertaut dengan data pegawai." };
  }
  const file = formData.get("photo");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Pilih berkas foto terlebih dahulu." };
  }
  if (file.size > PHOTO_MAX_BYTES) {
    return { error: "Ukuran foto melebihi 5 MB." };
  }
  // Two-layer validation: file.type is browser-supplied and trivially
  // spoofable, so we ALSO require the filename extension to be an
  // image. saveUpload's SAFE_EXT regex accepts pdf/doc/xls — without
  // the extension check a client could spoof Content-Type and store a
  // PDF as a profile photo.
  if (!PHOTO_MIME_ALLOWLIST.has(file.type) || !PHOTO_EXT_ALLOWLIST.test(file.name)) {
    return { error: "Format foto harus JPG, PNG, atau WEBP." };
  }
  let saved;
  try {
    saved = await saveUpload(file, "employees", "photo", user.employeeId);
  } catch (err) {
    return { error: (err as Error).message };
  }
  try {
    await prisma.employee.update({
      where: { id: user.employeeId },
      data: {
        photoStoredPath: saved.storedPath,
        photoDriveFileId: saved.driveFileId,
        photoDriveWebViewLink: saved.driveWebViewLink,
        photoMimeType: saved.mimeType,
        photoSizeBytes: saved.sizeBytes,
      },
    });
  } catch (err) {
    await rollbackUpload(saved);
    return { error: `Gagal menyimpan foto: ${(err as Error).message}` };
  }
  revalidatePath("/profile");
  revalidatePath("/employees");
  revalidatePath(`/employees/${user.employeeId}`);
  return { success: "Foto profil berhasil diperbarui." };
}

"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { saveUpload } from "@/lib/uploads";
import { CERTIFICATION_CATEGORIES } from "@/lib/hris";
import type { CertificationCategory } from "@prisma/client";

function str(v: FormDataEntryValue | null): string {
  return typeof v === "string" ? v.trim() : "";
}

function optional(v: FormDataEntryValue | null): string | null {
  const s = str(v);
  return s.length > 0 ? s : null;
}

function parseDate(v: FormDataEntryValue | null, required: boolean): Date | null {
  const s = str(v);
  if (!s) {
    if (required) throw new Error("Tanggal wajib diisi.");
    return null;
  }
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) throw new Error("Format tanggal tidak valid.");
  return d;
}

async function requireOwnEmployee(userId: string): Promise<{ employeeId: string }> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { employeeId: true },
  });
  if (!user?.employeeId) {
    throw new Error("Akun Anda belum tertaut dengan data pegawai.");
  }
  return { employeeId: user.employeeId };
}

export async function createCertificationAction(formData: FormData): Promise<void> {
  const session = await requireUser();
  const { employeeId } = await requireOwnEmployee(session.userId);

  const name = str(formData.get("name"));
  const issuer = str(formData.get("issuer"));
  const category = str(formData.get("category")) as CertificationCategory;
  const certificateNumber = optional(formData.get("certificateNumber"));
  const issueDate = parseDate(formData.get("issueDate"), true)!;
  const expiryDate = parseDate(formData.get("expiryDate"), false);
  const notes = optional(formData.get("notes"));

  if (!name) throw new Error("Nama sertifikat wajib diisi.");
  if (!issuer) throw new Error("Penerbit sertifikat wajib diisi.");
  if (!CERTIFICATION_CATEGORIES.includes(category)) {
    throw new Error("Kategori sertifikat tidak valid.");
  }
  if (expiryDate && expiryDate < issueDate) {
    throw new Error("Tanggal kadaluwarsa tidak boleh sebelum tanggal terbit.");
  }

  // Create row first to get id, then attach file if present. Any failure after
  // row creation cleans up the row so the employee can retry.
  const created = await prisma.certification.create({
    data: {
      employeeId,
      name,
      issuer,
      category,
      certificateNumber,
      issueDate,
      expiryDate,
      notes,
    },
  });

  const file = formData.get("file");
  if (file instanceof File && file.size > 0) {
    try {
      const saved = await saveUpload(file, `cert-${created.id}`, "CERT");
      await prisma.certification.update({
        where: { id: created.id },
        data: {
          filePath: saved.storedPath,
          fileName: saved.originalName,
          fileMimeType: saved.mimeType,
          fileSizeBytes: saved.sizeBytes,
        },
      });
    } catch (err) {
      await prisma.certification.delete({ where: { id: created.id } });
      throw err;
    }
  }

  revalidatePath("/profile/sertifikasi");
  revalidatePath("/profile");
}

export async function deleteCertificationAction(formData: FormData): Promise<void> {
  const session = await requireUser();
  const { employeeId } = await requireOwnEmployee(session.userId);

  const id = str(formData.get("id"));
  if (!id) throw new Error("ID tidak valid.");

  // Own-record check — employees cannot delete another employee's certification.
  const existing = await prisma.certification.findUnique({ where: { id } });
  if (!existing || existing.employeeId !== employeeId) {
    throw new Error("Sertifikat tidak ditemukan.");
  }

  await prisma.certification.delete({ where: { id } });
  revalidatePath("/profile/sertifikasi");
  revalidatePath("/profile");
}

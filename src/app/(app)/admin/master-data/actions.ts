"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export interface MasterDataState {
  success?: string;
  error?: string;
}

function parseRupiah(raw: FormDataEntryValue | null, label: string): number {
  const s = String(raw ?? "").replace(/[^\d]/g, "");
  if (!s) throw new Error(`${label} wajib diisi.`);
  const n = Number(s);
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < 0 || n > 100_000_000) {
    throw new Error(`${label} harus bilangan bulat 0–100.000.000.`);
  }
  return n;
}

function parseInt32(raw: FormDataEntryValue | null, label: string, min: number, max: number): number {
  const n = Number(String(raw ?? "").trim());
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < min || n > max) {
    throw new Error(`${label} harus bilangan bulat ${min}–${max}.`);
  }
  return n;
}

function parseRequired(raw: FormDataEntryValue | null, label: string): string {
  const s = String(raw ?? "").trim();
  if (!s) throw new Error(`${label} wajib diisi.`);
  return s;
}

/**
 * Update a single PayGrade row. We don't allow code rename here — that
 * would invalidate any historical IncrementHistory rows that reference
 * the grade by code in their snapshot data. New grades go through
 * `createPayGradeAction`.
 */
export async function updatePayGradeAction(
  _prev: MasterDataState,
  formData: FormData,
): Promise<MasterDataState> {
  await requireRole(["ADMIN"]);
  try {
    const id = parseInt32(formData.get("id"), "ID", 1, 1_000_000);
    const name = parseRequired(formData.get("name"), "Nama");
    const baseSalary = parseRupiah(formData.get("baseSalary"), "Gaji pokok");
    const level = parseInt32(formData.get("level"), "Level", 1, 999);
    await prisma.payGrade.update({
      where: { id },
      data: { name, baseSalary, level },
    });
    revalidatePath("/admin/master-data");
    revalidatePath("/employees");
    return { success: `Golongan ${name} berhasil diperbarui.` };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

export async function createPayGradeAction(
  _prev: MasterDataState,
  formData: FormData,
): Promise<MasterDataState> {
  await requireRole(["ADMIN"]);
  try {
    const code = parseRequired(formData.get("code"), "Kode");
    const name = parseRequired(formData.get("name"), "Nama");
    const baseSalary = parseRupiah(formData.get("baseSalary"), "Gaji pokok");
    const level = parseInt32(formData.get("level"), "Level", 1, 999);
    const exists = await prisma.payGrade.findUnique({ where: { code } });
    if (exists) throw new Error(`Kode "${code}" sudah ada.`);
    await prisma.payGrade.create({
      data: { code, name, baseSalary, level },
    });
    revalidatePath("/admin/master-data");
    return { success: `Golongan ${code} berhasil ditambahkan.` };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

/**
 * Update an AcademicRank row. Like PayGrade we don't expose `code`
 * (Prisma enum) for editing; it's a fixed enum referenced by code in
 * eligibility logic. Only the human-readable fields and allowance can
 * be changed.
 */
export async function updateAcademicRankAction(
  _prev: MasterDataState,
  formData: FormData,
): Promise<MasterDataState> {
  await requireRole(["ADMIN"]);
  try {
    const id = parseInt32(formData.get("id"), "ID", 1, 1_000_000);
    const name = parseRequired(formData.get("name"), "Nama");
    const minServiceYears = parseInt32(
      formData.get("minServiceYears"),
      "Masa kerja minimum",
      0,
      40,
    );
    const functionalAllowance = parseRupiah(
      formData.get("functionalAllowance"),
      "Tunjangan fungsional",
    );
    await prisma.academicRank.update({
      where: { id },
      data: { name, minServiceYears, functionalAllowance },
    });
    revalidatePath("/admin/master-data");
    revalidatePath("/employees");
    return { success: `Jabatan ${name} berhasil diperbarui.` };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

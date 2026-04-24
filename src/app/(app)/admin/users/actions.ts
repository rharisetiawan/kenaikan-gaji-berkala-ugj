"use server";

import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import type { UserRole } from "@prisma/client";

const ROLES: readonly UserRole[] = [
  "ADMIN",
  "HR",
  "RECTOR",
  "FOUNDATION",
  "EMPLOYEE",
];

export interface UserActionState {
  success?: string;
  error?: string;
  generatedPassword?: string;
}

/**
 * Generate a human-typable random password (10 chars, letters+digits, no
 * ambiguous 0/O/1/l). Shown ONCE in the flash message so the ADMIN can
 * hand it over; we never store the plain value.
 */
function generateTempPassword(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  const buf = randomBytes(10);
  let out = "";
  for (let i = 0; i < 10; i++) out += alphabet[buf[i] % alphabet.length];
  return out;
}

export async function resetUserPasswordAction(
  _prev: UserActionState,
  formData: FormData,
): Promise<UserActionState> {
  await requireRole(["ADMIN"]);
  const id = String(formData.get("userId") ?? "");
  if (!id) return { error: "ID pengguna wajib." };

  const newPassword = generateTempPassword();
  try {
    await prisma.user.update({
      where: { id },
      data: { passwordHash: await bcrypt.hash(newPassword, 10) },
    });
  } catch {
    return { error: "Pengguna tidak ditemukan." };
  }
  revalidatePath("/admin/users");
  return {
    success: "Kata sandi berhasil direset.",
    generatedPassword: newPassword,
  };
}

export async function setUserActiveAction(
  _prev: UserActionState,
  formData: FormData,
): Promise<UserActionState> {
  const session = await requireRole(["ADMIN"]);
  const id = String(formData.get("userId") ?? "");
  const isActive = String(formData.get("isActive") ?? "") === "true";

  if (!id) return { error: "ID pengguna wajib." };
  if (id === session.userId && !isActive) {
    return { error: "Tidak bisa menonaktifkan akun Anda sendiri." };
  }

  try {
    await prisma.user.update({ where: { id }, data: { isActive } });
  } catch {
    return { error: "Pengguna tidak ditemukan." };
  }
  revalidatePath("/admin/users");
  return { success: isActive ? "Akun diaktifkan." : "Akun dinonaktifkan." };
}

export async function setUserRoleAction(
  _prev: UserActionState,
  formData: FormData,
): Promise<UserActionState> {
  const session = await requireRole(["ADMIN"]);
  const id = String(formData.get("userId") ?? "");
  const roleRaw = String(formData.get("role") ?? "");
  if (!id) return { error: "ID pengguna wajib." };
  if (!ROLES.includes(roleRaw as UserRole)) return { error: "Peran tidak valid." };
  const role = roleRaw as UserRole;
  if (id === session.userId && role !== "ADMIN") {
    return {
      error: "Tidak bisa mengubah peran Anda sendiri dari ADMIN.",
    };
  }
  try {
    await prisma.user.update({ where: { id }, data: { role } });
  } catch {
    return { error: "Pengguna tidak ditemukan." };
  }
  revalidatePath("/admin/users");
  return { success: `Peran diubah menjadi ${role}.` };
}

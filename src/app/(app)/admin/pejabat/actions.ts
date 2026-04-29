"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import type { OfficialRole } from "@prisma/client";

const ROLES: readonly OfficialRole[] = ["RECTOR", "FOUNDATION_CHAIR"] as const;

export interface UpdateOfficialState {
  success?: string;
  error?: string;
}

export async function updateOfficialAction(
  _prev: UpdateOfficialState,
  formData: FormData,
): Promise<UpdateOfficialState> {
  const session = await requireRole(["ADMIN"]);

  const roleRaw = String(formData.get("role") ?? "");
  if (!ROLES.includes(roleRaw as OfficialRole)) {
    return { error: "Jabatan tidak valid." };
  }
  const role = roleRaw as OfficialRole;
  const name = String(formData.get("name") ?? "").trim();
  const titleRaw = String(formData.get("title") ?? "").trim();
  const nipRaw = String(formData.get("nip") ?? "").trim();

  if (!name) return { error: "Nama wajib diisi." };
  if (!titleRaw) return { error: "Jabatan lengkap wajib diisi." };

  await prisma.orgOfficial.upsert({
    where: { role },
    update: {
      name,
      title: titleRaw,
      nip: nipRaw.length > 0 ? nipRaw : null,
      updatedById: session.userId,
    },
    create: {
      role,
      name,
      title: titleRaw,
      nip: nipRaw.length > 0 ? nipRaw : null,
      updatedById: session.userId,
    },
  });

  revalidatePath("/admin/pejabat");
  return { success: "Data pejabat berhasil diperbarui." };
}

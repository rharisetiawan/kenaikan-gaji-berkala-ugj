"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import {
  AUTHOR_ROLES,
  PUBLICATION_KINDS,
  SCOPUS_QUARTILES,
  SINTA_RANKS,
} from "@/lib/hris";
import type { AuthorRole, PublicationKind } from "@prisma/client";

function str(v: FormDataEntryValue | null): string {
  return typeof v === "string" ? v.trim() : "";
}

function optional(v: FormDataEntryValue | null): string | null {
  const s = str(v);
  return s.length > 0 ? s : null;
}

function parseYear(v: FormDataEntryValue | null): number {
  const s = str(v);
  const n = Number(s);
  const current = new Date().getFullYear();
  if (!Number.isInteger(n) || n < 1950 || n > current + 1) {
    throw new Error(`Tahun harus bilangan bulat 1950–${current + 1}.`);
  }
  return n;
}

async function requireOwnDosenDetail(userId: string): Promise<{ dosenDetailId: string }> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      employee: {
        include: { dosenDetail: { select: { id: true } } },
      },
    },
  });
  if (!user?.employee?.dosenDetail) {
    throw new Error(
      "Publikasi hanya dapat diisi oleh Dosen. Akun Anda bukan dosen.",
    );
  }
  return { dosenDetailId: user.employee.dosenDetail.id };
}

export async function createPublicationAction(formData: FormData): Promise<void> {
  const session = await requireUser();
  const { dosenDetailId } = await requireOwnDosenDetail(session.userId);

  const title = str(formData.get("title"));
  const kind = str(formData.get("kind")) as PublicationKind;
  const year = parseYear(formData.get("year"));
  const venue = str(formData.get("venue"));
  const doi = optional(formData.get("doi"));
  const url = optional(formData.get("url"));
  const authorRole = str(formData.get("authorRole")) as AuthorRole;
  const coauthors = optional(formData.get("coauthors"));
  const sintaRank = optional(formData.get("sintaRank"));
  const scopusQuartile = optional(formData.get("scopusQuartile"));

  if (!title) throw new Error("Judul publikasi wajib diisi.");
  if (!venue) throw new Error("Nama jurnal / prosiding wajib diisi.");
  if (!PUBLICATION_KINDS.includes(kind)) {
    throw new Error("Jenis publikasi tidak valid.");
  }
  if (!AUTHOR_ROLES.includes(authorRole)) {
    throw new Error("Peran penulis tidak valid.");
  }
  if (sintaRank && !(SINTA_RANKS as readonly string[]).includes(sintaRank)) {
    throw new Error("Peringkat SINTA tidak valid.");
  }
  if (scopusQuartile && !(SCOPUS_QUARTILES as readonly string[]).includes(scopusQuartile)) {
    throw new Error("Kuartil Scopus tidak valid.");
  }

  await prisma.publication.create({
    data: {
      dosenDetailId,
      title,
      kind,
      year,
      venue,
      doi,
      url,
      authorRole,
      coauthors,
      sintaRank: kind === "JURNAL_NASIONAL_TERAKREDITASI" ? sintaRank : null,
      scopusQuartile:
        kind === "JURNAL_INTERNASIONAL_BEREPUTASI" ? scopusQuartile : null,
    },
  });

  revalidatePath("/profile/publikasi");
  revalidatePath("/profile");
}

export async function deletePublicationAction(formData: FormData): Promise<void> {
  const session = await requireUser();
  const { dosenDetailId } = await requireOwnDosenDetail(session.userId);

  const id = str(formData.get("id"));
  if (!id) throw new Error("ID tidak valid.");

  const existing = await prisma.publication.findUnique({ where: { id } });
  if (!existing || existing.dosenDetailId !== dosenDetailId) {
    throw new Error("Publikasi tidak ditemukan.");
  }

  await prisma.publication.delete({ where: { id } });
  revalidatePath("/profile/publikasi");
  revalidatePath("/profile");
}

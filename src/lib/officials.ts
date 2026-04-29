/**
 * Helpers for reading the runtime-editable list of organization officials
 * (Rektor, Ketua Yayasan, ...). ADMIN maintains this data at
 * `/admin/pejabat`; all PDF renderers call {@link getOfficial} at generation
 * time so that when role-holders change, the next letter picks up the new
 * name without a redeploy.
 */
import { prisma } from "@/lib/prisma";
import type { OfficialRole } from "@prisma/client";

export interface OfficialSnapshot {
  name: string;
  nip: string | null;
  title: string;
}

/**
 * Fallback names used only if the DB row is missing (e.g. before the seed
 * has run on a fresh environment). These mirror the hard-coded strings the
 * PDFs used before this feature shipped so behaviour is stable.
 */
const FALLBACKS: Record<OfficialRole, OfficialSnapshot> = {
  RECTOR: {
    name: "Prof. Dr. Ernani Hadiyati, S.E., M.M.",
    nip: null,
    title: "Rektor Universitas Gajayana Malang",
  },
  FOUNDATION_CHAIR: {
    name: "Dr. Rosidi, SE, MM. Ak",
    nip: null,
    title: "Ketua Yayasan Pembina Pendidikan Gajayana",
  },
};

export async function getOfficial(role: OfficialRole): Promise<OfficialSnapshot> {
  const row = await prisma.orgOfficial.findUnique({ where: { role } });
  if (!row) return FALLBACKS[role];
  return { name: row.name, nip: row.nip, title: row.title };
}

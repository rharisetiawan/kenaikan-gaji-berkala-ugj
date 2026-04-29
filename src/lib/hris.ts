// HRIS Phase 2 utilities — human-readable labels + small helpers used by both
// the employee self-service pages and the HR export.

import type {
  AuthorRole,
  CertificationCategory,
  PublicationKind,
} from "@prisma/client";

export const CERTIFICATION_CATEGORIES: readonly CertificationCategory[] = [
  "SERDOS",
  "PROFESI",
  "PELATIHAN",
  "KEAHLIAN",
  "BAHASA",
  "LAINNYA",
];

export function humanCertificationCategory(c: CertificationCategory): string {
  switch (c) {
    case "SERDOS":
      return "Sertifikasi Dosen (Serdos)";
    case "PROFESI":
      return "Sertifikasi Profesi";
    case "PELATIHAN":
      return "Pelatihan / Workshop";
    case "KEAHLIAN":
      return "Sertifikasi Keahlian";
    case "BAHASA":
      return "Sertifikasi Bahasa";
    case "LAINNYA":
      return "Lainnya";
  }
}

export const PUBLICATION_KINDS: readonly PublicationKind[] = [
  "JURNAL_NASIONAL",
  "JURNAL_NASIONAL_TERAKREDITASI",
  "JURNAL_INTERNASIONAL",
  "JURNAL_INTERNASIONAL_BEREPUTASI",
  "PROSIDING_NASIONAL",
  "PROSIDING_INTERNASIONAL",
  "BUKU",
  "BAB_BUKU",
  "HKI",
  "LAINNYA",
];

export function humanPublicationKind(k: PublicationKind): string {
  switch (k) {
    case "JURNAL_NASIONAL":
      return "Jurnal Nasional";
    case "JURNAL_NASIONAL_TERAKREDITASI":
      return "Jurnal Nasional Terakreditasi (SINTA)";
    case "JURNAL_INTERNASIONAL":
      return "Jurnal Internasional";
    case "JURNAL_INTERNASIONAL_BEREPUTASI":
      return "Jurnal Internasional Bereputasi (Scopus / WoS)";
    case "PROSIDING_NASIONAL":
      return "Prosiding Nasional";
    case "PROSIDING_INTERNASIONAL":
      return "Prosiding Internasional";
    case "BUKU":
      return "Buku";
    case "BAB_BUKU":
      return "Bab Buku";
    case "HKI":
      return "HKI / Paten";
    case "LAINNYA":
      return "Lainnya";
  }
}

export const AUTHOR_ROLES: readonly AuthorRole[] = [
  "FIRST_AUTHOR",
  "CORRESPONDING_AUTHOR",
  "COAUTHOR",
];

export function humanAuthorRole(r: AuthorRole): string {
  switch (r) {
    case "FIRST_AUTHOR":
      return "Penulis Pertama";
    case "CORRESPONDING_AUTHOR":
      return "Penulis Korespondensi";
    case "COAUTHOR":
      return "Co-Author";
  }
}

export const SINTA_RANKS = ["S1", "S2", "S3", "S4", "S5", "S6"] as const;
export const SCOPUS_QUARTILES = ["Q1", "Q2", "Q3", "Q4"] as const;

/**
 * Days until expiry, or null when no expiry is set. Negative when expired.
 * Helper for UI pill colour logic on the sertifikasi list.
 */
export function daysUntilExpiry(expiry: Date | null): number | null {
  if (!expiry) return null;
  const now = new Date();
  const diffMs = expiry.getTime() - now.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

export function expiryStatusClass(daysLeft: number | null): string {
  if (daysLeft === null) return "bg-slate-100 text-slate-600";
  if (daysLeft < 0) return "bg-rose-100 text-rose-800";
  if (daysLeft <= 90) return "bg-amber-100 text-amber-800";
  return "bg-emerald-100 text-emerald-800";
}

export function expiryStatusLabel(daysLeft: number | null): string {
  if (daysLeft === null) return "Tidak Kadaluwarsa";
  if (daysLeft < 0) return `Kadaluwarsa ${Math.abs(daysLeft)} hari yang lalu`;
  if (daysLeft === 0) return "Kadaluwarsa hari ini";
  if (daysLeft <= 90) return `Kadaluwarsa dalam ${daysLeft} hari`;
  return `Aktif (${daysLeft} hari lagi)`;
}

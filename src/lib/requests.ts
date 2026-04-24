import type { IncrementRequestStatus, DocumentKind, EmployeeType } from "@prisma/client";

// Feature flag: the Dosen (Lecturer) workflow — including the Bukti Tridharma
// upload — is on hold per product scope. Schema and roles remain in place so
// Dosen data can coexist, but self-service submission is blocked for Dosen
// until this flips to true.
export const DOSEN_WORKFLOW_ENABLED = false;

export const REQUIRED_DOCUMENTS_STAFF: DocumentKind[] = ["SKP", "LAST_SK_BERKALA"];
export const REQUIRED_DOCUMENTS_DOSEN: DocumentKind[] = [
  "SKP",
  "LAST_SK_BERKALA",
  "TRIDHARMA_PROOF",
];

export function requiredDocumentsFor(type: EmployeeType): DocumentKind[] {
  return type === "DOSEN" ? REQUIRED_DOCUMENTS_DOSEN : REQUIRED_DOCUMENTS_STAFF;
}

export function workflowEnabledFor(type: EmployeeType): boolean {
  return type === "STAFF" || DOSEN_WORKFLOW_ENABLED;
}

export function humanDocumentKind(kind: DocumentKind): string {
  switch (kind) {
    case "SKP":
      return "SKP (ditandatangani atasan langsung)";
    case "LAST_SK_BERKALA":
      return "SK Berkala terakhir";
    case "TRIDHARMA_PROOF":
      return "Bukti Tridharma aktif";
    case "SURAT_PENGANTAR":
      return "Surat Pengantar Rektor";
    case "SK_BERKALA":
      return "SK Kenaikan Gaji Berkala";
  }
}

export function humanRequestStatus(status: IncrementRequestStatus): string {
  switch (status) {
    case "DRAFT":
      return "Draf";
    case "SUBMITTED":
      return "Menunggu Verifikasi Kepegawaian";
    case "HR_REJECTED":
      return "Ditolak Kepegawaian";
    case "HR_VERIFIED":
      return "Menunggu Tanda Tangan Rektor";
    case "RECTOR_SIGNED":
      return "Menunggu Persetujuan Yayasan";
    case "FOUNDATION_REJECTED":
      return "Ditolak Yayasan";
    case "FOUNDATION_APPROVED":
      return "Disetujui Yayasan – Siap Terbit SK";
    case "ISSUED":
      return "SK Berkala Terbit";
    case "CANCELLED":
      return "Dibatalkan";
  }
}

export function requestStatusColor(status: IncrementRequestStatus): string {
  switch (status) {
    case "DRAFT":
    case "CANCELLED":
      return "bg-slate-100 text-slate-700 border-slate-300";
    case "SUBMITTED":
    case "HR_VERIFIED":
    case "RECTOR_SIGNED":
      return "bg-amber-50 text-amber-800 border-amber-200";
    case "FOUNDATION_APPROVED":
      return "bg-sky-50 text-sky-800 border-sky-200";
    case "ISSUED":
      return "bg-emerald-50 text-emerald-800 border-emerald-200";
    case "HR_REJECTED":
    case "FOUNDATION_REJECTED":
      return "bg-rose-50 text-rose-800 border-rose-200";
  }
}

const ORDER: IncrementRequestStatus[] = [
  "SUBMITTED",
  "HR_VERIFIED",
  "RECTOR_SIGNED",
  "FOUNDATION_APPROVED",
  "ISSUED",
];

export function statusProgressPercent(status: IncrementRequestStatus): number {
  const idx = ORDER.indexOf(status);
  if (idx < 0) return 0;
  return Math.round(((idx + 1) / ORDER.length) * 100);
}

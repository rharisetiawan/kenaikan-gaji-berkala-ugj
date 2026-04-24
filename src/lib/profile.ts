import type {
  DosenDetail,
  Employee,
  EmployeeType,
  LastEducation,
  MaritalStatus,
  Religion,
} from "@prisma/client";

// Fields that every employee (Staff + Dosen) must fill in their profile.
// Kept in one list so the "Kelengkapan Data" page and the profile form stay
// in sync — if a field is added here it is surfaced in both places.
export const COMMON_PROFILE_FIELDS = [
  "phone",
  "address",
  "placeOfBirth",
  "nik",
  "religion",
  "lastEducation",
  "maritalStatus",
  "dependentsCount",
  "emergencyContact",
] as const;

// Extra fields required for Dosen (akreditasi research identifiers).
// NIDN is enforced at onboarding so it is not included here; Scopus/SINTA/ORCID/
// Google Scholar are typically missing and need to be nagged via kelengkapan data.
export const DOSEN_PROFILE_FIELDS = [
  "scopusId",
  "sintaId",
  "orcid",
  "googleScholarId",
] as const;

type CommonField = (typeof COMMON_PROFILE_FIELDS)[number];
type DosenField = (typeof DOSEN_PROFILE_FIELDS)[number];

export type ProfileFieldKey = CommonField | DosenField;

export interface ProfileCompleteness {
  filled: number;
  total: number;
  percent: number;
  missingFields: ProfileFieldKey[];
}

function isFilled(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (typeof value === "number") return Number.isFinite(value);
  return true;
}

export function computeProfileCompleteness(
  employee: Pick<
    Employee,
    | "phone"
    | "address"
    | "placeOfBirth"
    | "nik"
    | "religion"
    | "lastEducation"
    | "maritalStatus"
    | "dependentsCount"
    | "emergencyContact"
    | "type"
  >,
  dosenDetail: Pick<
    DosenDetail,
    "scopusId" | "sintaId" | "orcid" | "googleScholarId"
  > | null,
): ProfileCompleteness {
  const missingFields: ProfileFieldKey[] = [];
  const commonValues: Record<CommonField, unknown> = {
    phone: employee.phone,
    address: employee.address,
    placeOfBirth: employee.placeOfBirth,
    nik: employee.nik,
    religion: employee.religion,
    lastEducation: employee.lastEducation,
    maritalStatus: employee.maritalStatus,
    dependentsCount: employee.dependentsCount,
    emergencyContact: employee.emergencyContact,
  };
  for (const key of COMMON_PROFILE_FIELDS) {
    if (!isFilled(commonValues[key])) missingFields.push(key);
  }
  let total: number = COMMON_PROFILE_FIELDS.length;
  if (employee.type === "DOSEN") {
    total += DOSEN_PROFILE_FIELDS.length;
    const dosenValues: Record<DosenField, unknown> = {
      scopusId: dosenDetail?.scopusId ?? null,
      sintaId: dosenDetail?.sintaId ?? null,
      orcid: dosenDetail?.orcid ?? null,
      googleScholarId: dosenDetail?.googleScholarId ?? null,
    };
    for (const key of DOSEN_PROFILE_FIELDS) {
      if (!isFilled(dosenValues[key])) missingFields.push(key);
    }
  }
  const filled = total - missingFields.length;
  const percent = total === 0 ? 100 : Math.round((filled / total) * 100);
  return { filled, total, percent, missingFields };
}

export function humanProfileField(key: ProfileFieldKey): string {
  switch (key) {
    case "phone":
      return "No. HP / WhatsApp";
    case "address":
      return "Alamat Domisili";
    case "placeOfBirth":
      return "Tempat Lahir";
    case "nik":
      return "NIK (KTP)";
    case "religion":
      return "Agama";
    case "lastEducation":
      return "Pendidikan Terakhir";
    case "maritalStatus":
      return "Status Pernikahan";
    case "dependentsCount":
      return "Jumlah Tanggungan";
    case "emergencyContact":
      return "Kontak Darurat";
    case "scopusId":
      return "Scopus ID";
    case "sintaId":
      return "SINTA ID";
    case "orcid":
      return "ORCID";
    case "googleScholarId":
      return "Google Scholar ID";
  }
}

export function humanLastEducation(value: LastEducation): string {
  switch (value) {
    case "SD":
      return "SD";
    case "SMP":
      return "SMP";
    case "SMA":
      return "SMA / SMK / MA";
    case "D3":
      return "Diploma (D3)";
    case "S1":
      return "Sarjana (S1)";
    case "S2":
      return "Magister (S2)";
    case "S3":
      return "Doktor (S3)";
  }
}

export function humanMaritalStatus(value: MaritalStatus): string {
  switch (value) {
    case "BELUM_KAWIN":
      return "Belum Kawin";
    case "KAWIN":
      return "Kawin";
    case "CERAI_HIDUP":
      return "Cerai Hidup";
    case "CERAI_MATI":
      return "Cerai Mati";
  }
}

export function humanReligion(value: Religion): string {
  switch (value) {
    case "ISLAM":
      return "Islam";
    case "KRISTEN":
      return "Kristen";
    case "KATOLIK":
      return "Katolik";
    case "HINDU":
      return "Hindu";
    case "BUDDHA":
      return "Buddha";
    case "KONGHUCU":
      return "Konghucu";
  }
}

export function humanEmployeeType(type: EmployeeType): string {
  return type === "DOSEN" ? "Dosen" : "Tenaga Kependidikan";
}

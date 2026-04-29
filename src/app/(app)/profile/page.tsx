import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { formatDateID, formatRupiah } from "@/lib/format";
import {
  computeProfileCompleteness,
  humanEmployeeType,
  humanLastEducation,
  humanMaritalStatus,
  humanReligion,
} from "@/lib/profile";
import { updateMyProfileAction } from "./actions";

export const dynamic = "force-dynamic";

const RELIGION_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "ISLAM", label: "Islam" },
  { value: "KRISTEN", label: "Kristen" },
  { value: "KATOLIK", label: "Katolik" },
  { value: "HINDU", label: "Hindu" },
  { value: "BUDDHA", label: "Buddha" },
  { value: "KONGHUCU", label: "Konghucu" },
];

const EDUCATION_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "SD", label: "SD" },
  { value: "SMP", label: "SMP" },
  { value: "SMA", label: "SMA / SMK / MA" },
  { value: "D3", label: "Diploma (D3)" },
  { value: "S1", label: "Sarjana (S1)" },
  { value: "S2", label: "Magister (S2)" },
  { value: "S3", label: "Doktor (S3)" },
];

const MARITAL_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "BELUM_KAWIN", label: "Belum Kawin" },
  { value: "KAWIN", label: "Kawin" },
  { value: "CERAI_HIDUP", label: "Cerai Hidup" },
  { value: "CERAI_MATI", label: "Cerai Mati" },
];

function humanEmploymentStatus(status: string): string {
  switch (status) {
    case "TETAP":
      return "Pegawai Tetap Yayasan";
    case "KONTRAK":
      return "Pegawai Kontrak";
    case "HONORER":
      return "Tenaga Honorer";
    default:
      return status;
  }
}

export default async function MyProfilePage() {
  const session = await requireUser();

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    include: {
      employee: {
        include: {
          dosenDetail: { include: { academicRank: true } },
          staffDetail: { include: { payGrade: true } },
        },
      },
    },
  });

  if (!user?.employee) {
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <h1 className="text-2xl font-bold text-slate-900">Profil Saya</h1>
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          Akun Anda belum tertaut dengan data pegawai. Hubungi Bagian Kepegawaian.
        </div>
      </div>
    );
  }

  const emp = user.employee;
  const completeness = computeProfileCompleteness(emp, emp.dosenDetail ?? null);
  const pangkat = emp.type === "DOSEN"
    ? emp.dosenDetail?.academicRank.name
    : emp.staffDetail?.payGrade.name;
  // Only Staff have a human-readable golongan code (e.g. "III/a"). Dosen
  // AcademicRank.code is a Prisma enum value (e.g. "LEKTOR_KEPALA") that
  // is internal-only — we already render the friendly `name` as `pangkat`,
  // so suppress the parenthetical for Dosen.
  const golongan = emp.type === "DOSEN"
    ? null
    : emp.staffDetail?.payGrade.code;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <div className="text-xs text-slate-500">
          <Link href="/dashboard" className="hover:underline">Beranda</Link> / Profil Saya
        </div>
        <h1 className="mt-1 text-2xl font-bold text-slate-900">Profil Saya</h1>
        <p className="mt-1 text-sm text-slate-600">
          Mohon pastikan data pribadi Anda selalu terbarui. Data ini digunakan
          untuk dokumen resmi, akreditasi BAN-PT, dan laporan LLDikti.
        </p>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="text-xs uppercase tracking-wide text-slate-500">
              Kelengkapan Profil
            </div>
            <div className="mt-1 text-2xl font-bold text-slate-900">
              {completeness.percent}%{" "}
              <span className="text-sm font-normal text-slate-500">
                ({completeness.filled}/{completeness.total} kolom terisi)
              </span>
            </div>
          </div>
          <div className="hidden h-12 w-48 overflow-hidden rounded-full bg-slate-100 md:block">
            <div
              className={`h-full ${
                completeness.percent >= 80
                  ? "bg-emerald-500"
                  : completeness.percent >= 50
                  ? "bg-amber-500"
                  : "bg-rose-500"
              }`}
              style={{ width: `${completeness.percent}%` }}
            />
          </div>
        </div>
        {completeness.missingFields.length > 0 && (
          <p className="mt-2 text-xs text-slate-500">
            {completeness.missingFields.length} kolom masih kosong — lengkapi di
            bawah agar status &ldquo;Profil Lengkap&rdquo; terpenuhi.
          </p>
        )}
      </div>

      {/* HRIS Phase 2 — accreditation modules */}
      <div className={`grid gap-3 ${emp.type === "DOSEN" ? "sm:grid-cols-2" : ""}`}>
        <Link
          href="/profile/sertifikasi"
          className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm hover:border-[var(--brand)] hover:shadow"
        >
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold text-slate-900">
                Sertifikasi &amp; Pelatihan
              </div>
              <div className="mt-1 text-xs text-slate-600">
                Catat sertifikat profesi, pelatihan, dan keahlian Anda.
              </div>
            </div>
            <span className="text-[var(--brand)]">→</span>
          </div>
        </Link>
        {emp.type === "DOSEN" && (
          <Link
            href="/profile/publikasi"
            className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm hover:border-[var(--brand)] hover:shadow"
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold text-slate-900">
                  Publikasi Ilmiah
                </div>
                <div className="mt-1 text-xs text-slate-600">
                  Jurnal, prosiding, buku, HKI untuk laporan SINTA &amp; BKD.
                </div>
              </div>
              <span className="text-[var(--brand)]">→</span>
            </div>
          </Link>
        )}
      </div>

      {/* Read-only identity — managed by HR */}
      <section className="rounded-lg border border-slate-200 bg-slate-50 p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-900">
            Data Kepegawaian (hanya HR yang bisa mengubah)
          </h2>
          <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-medium text-slate-700">
            Read-only
          </span>
        </div>
        <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm md:grid-cols-2">
          <div>
            <dt className="text-xs text-slate-500">Nama Lengkap</dt>
            <dd className="font-medium text-slate-900">{emp.fullName}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">NIP / NIS</dt>
            <dd className="font-mono text-slate-900">{emp.nip}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">Jenis Pegawai</dt>
            <dd className="text-slate-900">{humanEmployeeType(emp.type)}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">Status Hubungan Kerja</dt>
            <dd className="text-slate-900">
              {humanEmploymentStatus(emp.employmentStatus)}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">Pangkat / Golongan</dt>
            <dd className="text-slate-900">
              {pangkat ?? "—"} {golongan ? `(${golongan})` : ""}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">TMT Pegawai</dt>
            <dd className="text-slate-900">{formatDateID(emp.hireDate)}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">Gaji Pokok Saat Ini</dt>
            <dd className="text-slate-900">
              {formatRupiah(emp.currentBaseSalary)}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">TMT KGB Berikutnya</dt>
            <dd className="text-slate-900">
              {formatDateID(emp.nextIncrementDate)}
            </dd>
          </div>
          {emp.type === "DOSEN" && emp.dosenDetail && (
            <>
              <div>
                <dt className="text-xs text-slate-500">NIDN</dt>
                <dd className="font-mono text-slate-900">
                  {emp.dosenDetail.nidn}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Fakultas / Prodi</dt>
                <dd className="text-slate-900">
                  {emp.dosenDetail.faculty} / {emp.dosenDetail.studyProgram}
                </dd>
              </div>
            </>
          )}
          {emp.type === "STAFF" && emp.staffDetail && (
            <>
              <div>
                <dt className="text-xs text-slate-500">Unit Kerja</dt>
                <dd className="text-slate-900">{emp.staffDetail.unit}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Jabatan</dt>
                <dd className="text-slate-900">{emp.staffDetail.position}</dd>
              </div>
            </>
          )}
        </dl>
        <p className="mt-3 text-xs text-slate-500">
          Jika ada data kepegawaian yang salah, silakan hubungi{" "}
          <span className="font-medium">Bagian Kepegawaian</span>.
        </p>
      </section>

      {/* Editable profile */}
      <form action={updateMyProfileAction} className="space-y-6">
        <section className="rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="mb-3 text-sm font-semibold text-slate-900">
            Data Pribadi
          </h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Field
              label="Tempat Lahir"
              name="placeOfBirth"
              defaultValue={emp.placeOfBirth ?? ""}
              placeholder="mis. Malang"
            />
            <Field
              label="Tanggal Lahir"
              name="birthDateDisplay"
              defaultValue={formatDateID(emp.birthDate)}
              disabled
              hint="Hubungi HR untuk perbaikan."
            />
            <Field
              label="NIK (KTP, 16 digit)"
              name="nik"
              defaultValue={emp.nik ?? ""}
              placeholder="16 digit angka"
              pattern={"\\d{16}"}
              maxLength={16}
            />
            <Select
              label="Agama"
              name="religion"
              defaultValue={emp.religion ?? ""}
              options={RELIGION_OPTIONS}
            />
            <Select
              label="Status Pernikahan"
              name="maritalStatus"
              defaultValue={emp.maritalStatus ?? ""}
              options={MARITAL_OPTIONS}
            />
            <Field
              label="Jumlah Tanggungan"
              name="dependentsCount"
              type="number"
              defaultValue={emp.dependentsCount?.toString() ?? ""}
              min={0}
              max={20}
              hint="Digunakan untuk perhitungan PPh21."
            />
          </div>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="mb-3 text-sm font-semibold text-slate-900">
            Alamat & Kontak
          </h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Field
              label="Alamat Domisili"
              name="address"
              defaultValue={emp.address ?? ""}
              placeholder="Jalan / Desa / Kecamatan / Kota"
              multiline
              className="md:col-span-2"
            />
            <Field
              label="No. HP / WhatsApp"
              name="phone"
              defaultValue={emp.phone ?? ""}
              placeholder="08xx-xxxx-xxxx"
            />
            <Field
              label="Kontak Darurat"
              name="emergencyContact"
              defaultValue={emp.emergencyContact ?? ""}
              placeholder="Nama - Hubungan - No. HP"
            />
          </div>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="mb-3 text-sm font-semibold text-slate-900">
            Pendidikan
          </h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Select
              label="Pendidikan Terakhir"
              name="lastEducation"
              defaultValue={emp.lastEducation ?? ""}
              options={EDUCATION_OPTIONS}
              hint="Sesuaikan dengan ijazah terakhir yang sudah dilegalisir."
            />
          </div>
        </section>

        {emp.type === "DOSEN" && (
          <section className="rounded-lg border border-slate-200 bg-white p-4">
            <h2 className="mb-3 text-sm font-semibold text-slate-900">
              Identitas Peneliti (Khusus Dosen)
            </h2>
            <p className="mb-3 text-xs text-slate-500">
              Diperlukan untuk pelaporan PDDikti, SINTA, dan pengisian borang
              BAN-PT. Isi jika Anda sudah memiliki akun pada masing-masing
              sistem.
            </p>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Field
                label="Scopus ID"
                name="scopusId"
                defaultValue={emp.dosenDetail?.scopusId ?? ""}
                placeholder="mis. 57193456789"
              />
              <Field
                label="SINTA ID"
                name="sintaId"
                defaultValue={emp.dosenDetail?.sintaId ?? ""}
                placeholder="mis. 5987654"
              />
              <Field
                label="ORCID"
                name="orcid"
                defaultValue={emp.dosenDetail?.orcid ?? ""}
                placeholder="0000-0000-0000-0000"
              />
              <Field
                label="Google Scholar ID"
                name="googleScholarId"
                defaultValue={emp.dosenDetail?.googleScholarId ?? ""}
                placeholder="mis. AbCd1EfGhIj"
              />
            </div>
          </section>
        )}

        <div className="flex items-center justify-between gap-3">
          <div className="text-xs text-slate-500">
            Terakhir diperbarui:{" "}
            {emp.profileUpdatedAt
              ? formatDateID(emp.profileUpdatedAt)
              : "—"}
          </div>
          <button
            type="submit"
            className="rounded-md bg-[var(--brand)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--brand-dark)]"
          >
            Simpan Perubahan
          </button>
        </div>
      </form>

      {emp.lastEducation && (
        <div className="hidden">
          {humanLastEducation(emp.lastEducation)}
        </div>
      )}
      {emp.maritalStatus && (
        <div className="hidden">
          {humanMaritalStatus(emp.maritalStatus)}
        </div>
      )}
      {emp.religion && (
        <div className="hidden">{humanReligion(emp.religion)}</div>
      )}
    </div>
  );
}

function Field({
  label,
  name,
  defaultValue,
  placeholder,
  type = "text",
  disabled = false,
  hint,
  multiline = false,
  pattern,
  maxLength,
  min,
  max,
  className,
}: {
  label: string;
  name: string;
  defaultValue?: string;
  placeholder?: string;
  type?: string;
  disabled?: boolean;
  hint?: string;
  multiline?: boolean;
  pattern?: string;
  maxLength?: number;
  min?: number;
  max?: number;
  className?: string;
}) {
  const base =
    "w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-[var(--brand)] focus:outline-none focus:ring-1 focus:ring-[var(--brand)]";
  const disabledCls = disabled ? " bg-slate-100 text-slate-600" : "";
  return (
    <label className={`flex flex-col gap-1 text-sm ${className ?? ""}`}>
      <span className="text-xs font-medium text-slate-700">{label}</span>
      {multiline ? (
        <textarea
          name={name}
          defaultValue={defaultValue}
          placeholder={placeholder}
          disabled={disabled}
          maxLength={maxLength}
          rows={3}
          className={base + disabledCls}
        />
      ) : (
        <input
          type={type}
          name={name}
          defaultValue={defaultValue}
          placeholder={placeholder}
          disabled={disabled}
          pattern={pattern}
          maxLength={maxLength}
          min={min}
          max={max}
          className={base + disabledCls}
        />
      )}
      {hint && <span className="text-[11px] text-slate-500">{hint}</span>}
    </label>
  );
}

function Select({
  label,
  name,
  defaultValue,
  options,
  hint,
}: {
  label: string;
  name: string;
  defaultValue?: string;
  options: Array<{ value: string; label: string }>;
  hint?: string;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="text-xs font-medium text-slate-700">{label}</span>
      <select
        name={name}
        defaultValue={defaultValue ?? ""}
        className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-[var(--brand)] focus:outline-none focus:ring-1 focus:ring-[var(--brand)]"
      >
        <option value="">— Belum diisi —</option>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {hint && <span className="text-[11px] text-slate-500">{hint}</span>}
    </label>
  );
}

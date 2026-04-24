import Link from "next/link";
import { notFound } from "next/navigation";
import { loadEmployeeWithDetails } from "@/lib/employees";
import { evaluateEligibility, humanEligibilityStatus, humanRating } from "@/lib/eligibility";
import { formatDateID, formatRupiah, formatServiceLength } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { IssueIncrementForm } from "./IssueIncrementForm";
import { AddBkdForm } from "./AddBkdForm";
import { AddPerformanceForm } from "./AddPerformanceForm";

export const dynamic = "force-dynamic";

export default async function EmployeeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const employee = await loadEmployeeWithDetails(id);
  if (!employee) notFound();

  const eligibility = evaluateEligibility(employee);
  const history = await prisma.incrementHistory.findMany({
    where: { employeeId: id },
    orderBy: { effectiveDate: "desc" },
  });

  const yearRoman = (d: Date) => [
    "I",
    "II",
    "III",
    "IV",
    "V",
    "VI",
    "VII",
    "VIII",
    "IX",
    "X",
    "XI",
    "XII",
  ][d.getMonth()];
  const d = new Date();
  const suggestedDecree = `KGB/${String(history.length + 1).padStart(3, "0")}/UGJ/${yearRoman(d)}/${d.getFullYear()}`;

  return (
    <div className="space-y-6">
      <div>
        <div className="text-xs text-slate-500">
          <Link href="/employees" className="hover:underline">Data Pegawai</Link> / {employee.fullName}
        </div>
        <h1 className="mt-1 text-2xl font-bold text-slate-900">{employee.fullName}</h1>
        <div className="mt-1 flex flex-wrap gap-2 text-xs">
          <span className="rounded-full bg-slate-100 px-2 py-0.5 font-mono text-slate-700">
            NIP: {employee.nip}
          </span>
          {employee.type === "DOSEN" ? (
            <span className="rounded-full bg-blue-100 px-2 py-0.5 font-medium text-blue-800">
              Dosen &middot; NIDN {employee.dosenDetail?.nidn}
            </span>
          ) : (
            <span className="rounded-full bg-purple-100 px-2 py-0.5 font-medium text-purple-800">
              Tenaga Kependidikan
            </span>
          )}
          <span
            className={`rounded-full px-2 py-0.5 font-medium ${
              eligibility.status === "ELIGIBLE"
                ? "bg-emerald-100 text-emerald-800"
                : eligibility.status === "NOT_YET"
                ? "bg-slate-100 text-slate-700"
                : eligibility.status === "BLOCKED"
                ? "bg-red-100 text-red-800"
                : "bg-amber-100 text-amber-800"
            }`}
          >
            {humanEligibilityStatus(eligibility.status)}
          </span>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <InfoCard label="Gaji Pokok Saat Ini" value={formatRupiah(employee.currentBaseSalary)} />
        <InfoCard label="TMT Kenaikan Berikutnya" value={formatDateID(eligibility.projectedEffectiveDate)} />
        <InfoCard
          label="Proyeksi Gaji Baru"
          value={formatRupiah(eligibility.projectedNewSalary)}
          helper={`Kenaikan ${formatRupiah(eligibility.incrementAmount)}`}
        />
      </div>

      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-base font-semibold text-slate-900">Informasi Kepegawaian</h2>
        <dl className="grid gap-x-6 gap-y-2 text-sm md:grid-cols-2">
          <Row label="Jenis Kelamin" value={employee.gender === "MALE" ? "Laki-laki" : "Perempuan"} />
          <Row label="Tanggal Lahir" value={formatDateID(employee.birthDate)} />
          <Row label="Surel" value={employee.email ?? "-"} />
          <Row label="Telepon" value={employee.phone ?? "-"} />
          <Row label="TMT Mulai Kerja" value={formatDateID(employee.hireDate)} />
          <Row label="Masa Kerja" value={formatServiceLength(employee.hireDate)} />
          <Row label="TMT Kenaikan Terakhir" value={formatDateID(employee.lastIncrementDate)} />
          <Row label="Status Kepegawaian" value={employee.status} />
          <Row label="Status Hubungan Kerja" value={employee.employmentStatus} />

          {employee.type === "DOSEN" && employee.dosenDetail && (
            <>
              <Row label="Fakultas" value={employee.dosenDetail.faculty} />
              <Row label="Program Studi" value={employee.dosenDetail.studyProgram} />
              <Row label="Jabatan Akademik" value={employee.dosenDetail.academicRank.name} />
              <Row label="Tunjangan Fungsional" value={formatRupiah(employee.dosenDetail.academicRank.functionalAllowance)} />
            </>
          )}
          {employee.type === "STAFF" && employee.staffDetail && (
            <>
              <Row label="Unit Kerja" value={employee.staffDetail.unit} />
              <Row label="Jabatan" value={employee.staffDetail.position} />
              <Row label="Golongan" value={`${employee.staffDetail.payGrade.code} - ${employee.staffDetail.payGrade.name}`} />
              <Row label="Gaji Pokok Ref. Golongan" value={formatRupiah(employee.staffDetail.payGrade.baseSalary)} />
            </>
          )}
        </dl>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-2 text-base font-semibold text-slate-900">Evaluasi Kelayakan KGB</h2>
        <ul className="list-disc space-y-1 pl-5 text-sm text-slate-700">
          {eligibility.reasons.map((r, idx) => (
            <li key={idx}>{r}</li>
          ))}
        </ul>
      </section>

      {employee.type === "DOSEN" ? (
        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-3 text-base font-semibold text-slate-900">Riwayat BKD</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <Th>Tahun Akademik</Th>
                  <Th>Semester</Th>
                  <Th>Beban SKS</Th>
                  <Th>Status</Th>
                  <Th>Catatan</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {employee.bkdEvaluations.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-4 text-center text-slate-500">
                      Belum ada data BKD.
                    </td>
                  </tr>
                ) : (
                  [...employee.bkdEvaluations]
                    .sort((a, b) =>
                      a.academicYear < b.academicYear ? 1 : a.academicYear > b.academicYear ? -1 : a.semester < b.semester ? 1 : -1,
                    )
                    .map((b) => (
                      <tr key={b.id}>
                        <td className="px-4 py-2">{b.academicYear}</td>
                        <td className="px-4 py-2">{b.semester === "GANJIL" ? "Ganjil" : "Genap"}</td>
                        <td className="px-4 py-2">{b.sksLoad}</td>
                        <td className="px-4 py-2">
                          {b.status === "PASS" ? (
                            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">Lulus</span>
                          ) : b.status === "FAIL" ? (
                            <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800">Tidak Lulus</span>
                          ) : (
                            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">Pending</span>
                          )}
                        </td>
                        <td className="px-4 py-2 text-slate-600">{b.notes ?? "-"}</td>
                      </tr>
                    ))
                )}
              </tbody>
            </table>
          </div>
          <div className="mt-4 border-t border-slate-200 pt-4">
            <h3 className="mb-2 text-sm font-medium text-slate-800">Tambah / Perbarui BKD</h3>
            <AddBkdForm employeeId={employee.id} />
          </div>
        </section>
      ) : (
        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-3 text-base font-semibold text-slate-900">Penilaian Kinerja Tahunan</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <Th>Tahun</Th>
                  <Th>Nilai</Th>
                  <Th>Peringkat</Th>
                  <Th>Catatan</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {employee.performanceScores.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-4 text-center text-slate-500">
                      Belum ada data kinerja.
                    </td>
                  </tr>
                ) : (
                  [...employee.performanceScores]
                    .sort((a, b) => b.year - a.year)
                    .map((p) => (
                      <tr key={p.id}>
                        <td className="px-4 py-2">{p.year}</td>
                        <td className="px-4 py-2 font-medium">{p.score.toFixed(2)}</td>
                        <td className="px-4 py-2">{humanRating(p.rating)}</td>
                        <td className="px-4 py-2 text-slate-600">{p.notes ?? "-"}</td>
                      </tr>
                    ))
                )}
              </tbody>
            </table>
          </div>
          <div className="mt-4 border-t border-slate-200 pt-4">
            <h3 className="mb-2 text-sm font-medium text-slate-800">Tambah / Perbarui Nilai Kinerja</h3>
            <AddPerformanceForm employeeId={employee.id} />
          </div>
        </section>
      )}

      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-base font-semibold text-slate-900">Riwayat Kenaikan Gaji</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr>
                <Th>TMT</Th>
                <Th>Gaji Lama</Th>
                <Th>Gaji Baru</Th>
                <Th>Kenaikan</Th>
                <Th>No. SK</Th>
                <Th>Tanggal SK</Th>
                <Th>Aksi</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {history.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-4 text-center text-slate-500">
                    Belum ada riwayat kenaikan.
                  </td>
                </tr>
              ) : (
                history.map((h) => (
                  <tr key={h.id}>
                    <td className="px-4 py-2">{formatDateID(h.effectiveDate)}</td>
                    <td className="px-4 py-2">{formatRupiah(h.previousSalary)}</td>
                    <td className="px-4 py-2">{formatRupiah(h.newSalary)}</td>
                    <td className="px-4 py-2 text-emerald-700">+{formatRupiah(h.incrementAmount)}</td>
                    <td className="px-4 py-2 font-mono text-xs">{h.decreeNumber ?? "-"}</td>
                    <td className="px-4 py-2">{formatDateID(h.decreeDate)}</td>
                    <td className="px-4 py-2">
                      <Link
                        href={`/api/sk/${h.id}`}
                        target="_blank"
                        className="text-[var(--brand)] hover:underline"
                      >
                        Unduh PDF
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {eligibility.status === "ELIGIBLE" ? (
        <section className="rounded-lg border border-emerald-300 bg-emerald-50 p-5 shadow-sm">
          <h2 className="text-base font-semibold text-emerald-900">Terbitkan SK Kenaikan Gaji Berkala</h2>
          <p className="mb-4 text-sm text-emerald-800">
            Pegawai ini memenuhi syarat untuk KGB. Isi data SK berikut, lalu sistem akan mencatat riwayat dan
            menyiapkan berkas PDF.
          </p>
          <IssueIncrementForm
            employeeId={employee.id}
            projectedEffectiveDate={eligibility.projectedEffectiveDate.toISOString().slice(0, 10)}
            projectedNewSalary={eligibility.projectedNewSalary}
            suggestedDecreeNumber={suggestedDecree}
          />
        </section>
      ) : (
        <div className="rounded-md border border-slate-200 bg-white p-4 text-sm text-slate-700">
          Pegawai belum memenuhi syarat untuk penerbitan SK KGB saat ini.
        </div>
      )}
    </div>
  );
}

function InfoCard({ label, value, helper }: { label: string; value: string; helper?: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-1 text-lg font-semibold text-slate-900">{value}</div>
      {helper && <div className="text-xs text-slate-500">{helper}</div>}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 border-b border-dashed border-slate-100 pb-1">
      <dt className="text-slate-500">{label}</dt>
      <dd className="text-right font-medium text-slate-800">{value}</dd>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
      {children}
    </th>
  );
}

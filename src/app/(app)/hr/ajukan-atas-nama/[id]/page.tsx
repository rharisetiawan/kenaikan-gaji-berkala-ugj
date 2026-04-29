import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { formatDateID, formatRupiah } from "@/lib/format";
import {
  computeIncrementAmount,
  computeNextIncrementDate,
  dosenHasRecentBkdPasses,
} from "@/lib/eligibility";
import { getKgbRules } from "@/lib/app-settings";
import { humanDocumentKind, requiredDocumentsFor, workflowEnabledFor } from "@/lib/requests";
import { submitRequestOnBehalfAction } from "@/app/(app)/requests/actions";

export const dynamic = "force-dynamic";

/**
 * HR bypass: file a KGB request on behalf of an employee who can't (or
 * won't) file it themselves. Ingests the same required documents as the
 * self-service form but the HR user types + uploads them, then the
 * resulting IncrementRequest goes into the normal HR → Rektor → Yayasan
 * queue with `filedBy = HR user`.
 */
export default async function FileOnBehalfPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole(["HR", "ADMIN"]);
  const { id } = await params;

  const emp = await prisma.employee.findUnique({
    where: { id },
    include: {
      dosenDetail: { include: { academicRank: true } },
      staffDetail: { include: { payGrade: true } },
      bkdEvaluations: true,
    },
  });
  if (!emp) notFound();

  const rules = await getKgbRules();
  const projectedIncrement = computeIncrementAmount(
    emp.currentBaseSalary,
    rules.incrementPercent,
  );
  const projectedNewSalary = emp.currentBaseSalary + projectedIncrement;
  const projectedDate = computeNextIncrementDate(emp);
  const required = requiredDocumentsFor(emp.type);

  const blockReason: string | null = (() => {
    if (!workflowEnabledFor(emp.type)) {
      return "Alur KGB untuk tipe pegawai ini belum diaktifkan.";
    }
    if (emp.employmentStatus !== "TETAP") {
      return `KGB hanya berlaku untuk pegawai tetap (status saat ini: ${emp.employmentStatus}).`;
    }
    if (
      emp.type === "DOSEN" &&
      !dosenHasRecentBkdPasses(emp.bkdEvaluations, rules.dosenRequiredBkdPasses)
    ) {
      return `Pengajuan diblokir: BKD ${rules.dosenRequiredBkdPasses} semester terakhir belum lulus.`;
    }
    return null;
  })();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link
          href={`/employees/${emp.id}`}
          className="text-xs text-[var(--brand)] hover:underline"
        >
          ← Kembali ke Data Pegawai
        </Link>
        <h1 className="mt-1 text-2xl font-bold text-slate-900">
          Ajukan KGB Atas Nama {emp.fullName}
        </h1>
        <p className="text-sm text-slate-600">
          Formulir ini diisi oleh Bagian Kepegawaian untuk pegawai yang tidak
          dapat mengisi sendiri. Pengajuan akan tercatat dengan nama HR
          sebagai pengirim, namun tetap diverifikasi melalui alur normal
          (HR → Rektor → Yayasan).
        </p>
      </div>

      {blockReason && (
        <div className="rounded-lg border border-rose-300 bg-rose-50 p-4 text-sm text-rose-900">
          <p className="font-semibold">Tidak dapat diajukan</p>
          <p className="mt-1 text-rose-800">{blockReason}</p>
        </div>
      )}

      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="mb-2 text-sm font-semibold text-slate-900">Data Pegawai</h2>
        <dl className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
          <Row label="Nama Lengkap" value={emp.fullName} />
          <Row label="NIP" value={emp.nip} />
          <Row
            label="Status"
            value={emp.type === "DOSEN" ? "Dosen" : "Tenaga Kependidikan"}
          />
          <Row
            label={emp.type === "DOSEN" ? "Jabatan Akademik" : "Golongan"}
            value={
              emp.type === "DOSEN"
                ? emp.dosenDetail?.academicRank.name ?? "-"
                : `${emp.staffDetail?.payGrade.code ?? "-"} ${
                    emp.staffDetail?.payGrade.name ?? ""
                  }`
            }
          />
          <Row label="TMT Mulai Kerja" value={formatDateID(emp.hireDate)} />
          <Row label="TMT KGB Proyeksi" value={formatDateID(projectedDate)} />
          <Row label="Gaji Pokok Lama" value={formatRupiah(emp.currentBaseSalary)} />
          <Row
            label="Gaji Pokok Baru"
            value={formatRupiah(projectedNewSalary)}
            bold
          />
        </dl>
      </section>

      {!blockReason && (
        <form
          action={submitRequestOnBehalfAction}
          className="space-y-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
        >
          <input type="hidden" name="employeeId" value={emp.id} />
          <h2 className="text-sm font-semibold text-slate-900">Dokumen Pendukung</h2>
          <p className="text-xs text-slate-500">
            Unggah berkas dari pegawai (scan/foto). Ukuran maks 25 MB per
            berkas. Format: PDF, JPG, PNG, DOC/DOCX, XLS/XLSX.
          </p>
          {required.map((kind) => (
            <div key={kind}>
              <label
                htmlFor={`doc_${kind}`}
                className="block text-sm font-medium text-slate-700"
              >
                {humanDocumentKind(kind)} <span className="text-rose-600">*</span>
              </label>
              <input
                id={`doc_${kind}`}
                name={`doc_${kind}`}
                type="file"
                accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx,.xls,.xlsx"
                required
                className="mt-1 block w-full rounded-md border border-slate-300 text-sm file:mr-3 file:rounded file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-slate-700 hover:file:bg-slate-200"
              />
            </div>
          ))}
          <div>
            <label
              htmlFor="notes"
              className="block text-sm font-medium text-slate-700"
            >
              Catatan (opsional, akan tampil di detail pengajuan)
            </label>
            <textarea
              id="notes"
              name="notes"
              rows={3}
              className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="Misalnya: diajukan atas permintaan lisan pegawai karena kendala akses komputer."
            />
          </div>
          <div className="flex justify-end gap-2">
            <Link
              href={`/employees/${emp.id}`}
              className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Batal
            </Link>
            <button
              type="submit"
              className="rounded-md bg-[var(--brand)] px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[var(--brand-dark)]"
            >
              Kirim Pengajuan Atas Nama
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

function Row({
  label,
  value,
  bold = false,
}: {
  label: string;
  value: string;
  bold?: boolean;
}) {
  return (
    <>
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd
        className={`text-sm ${
          bold ? "font-semibold text-emerald-700" : "text-slate-800"
        }`}
      >
        {value}
      </dd>
    </>
  );
}

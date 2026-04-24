import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { formatDateID, formatRupiah } from "@/lib/format";
import {
  computeIncrementAmount,
  computeNextIncrementDate,
  dosenHasRecentBkdPasses,
  DOSEN_REQUIRED_BKD_PASSES,
} from "@/lib/eligibility";
import { humanDocumentKind, requiredDocumentsFor, workflowEnabledFor } from "@/lib/requests";
import { submitIncrementRequestAction } from "@/app/(app)/requests/actions";

export const dynamic = "force-dynamic";

export default async function NewRequestPage() {
  const session = await requireUser();
  if (session.role !== "EMPLOYEE" && session.role !== "ADMIN") redirect("/dashboard");

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    include: {
      employee: {
        include: {
          dosenDetail: { include: { academicRank: true } },
          staffDetail: { include: { payGrade: true } },
          bkdEvaluations: true,
        },
      },
    },
  });
  if (!user?.employee) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
        Akun Anda belum tertaut dengan data pegawai. Hubungi Bagian Kepegawaian.
      </div>
    );
  }
  const emp = user.employee;
  const projectedIncrement = computeIncrementAmount(emp.currentBaseSalary);
  const projectedNewSalary = emp.currentBaseSalary + projectedIncrement;
  const projectedDate = computeNextIncrementDate(emp);
  const required = requiredDocumentsFor(emp.type);
  const workflowOpen = workflowEnabledFor(emp.type);

  if (!workflowOpen) {
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <div>
          <Link href="/my-requests" className="text-xs text-[var(--brand)] hover:underline">
            ← Kembali
          </Link>
          <h1 className="mt-1 text-2xl font-bold text-slate-900">Ajukan Kenaikan Gaji Berkala</h1>
        </div>
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          <p className="font-semibold">Alur KGB untuk Dosen belum dibuka</p>
          <p className="mt-1 text-amber-800">
            Pengajuan mandiri untuk Dosen (termasuk unggahan Bukti Tridharma) sedang disiapkan.
            Saat ini sistem fokus pada alur Tenaga Kependidikan. Silakan hubungi Bagian Kepegawaian
            untuk kebutuhan KGB Anda.
          </p>
        </div>
      </div>
    );
  }

  if (emp.employmentStatus !== "TETAP") {
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <div>
          <Link href="/my-requests" className="text-xs text-[var(--brand)] hover:underline">
            ← Kembali
          </Link>
          <h1 className="mt-1 text-2xl font-bold text-slate-900">Ajukan Kenaikan Gaji Berkala</h1>
        </div>
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          <p className="font-semibold">KGB hanya untuk Pegawai Tetap</p>
          <p className="mt-1 text-amber-800">
            Status kepegawaian Anda saat ini: <b>{emp.employmentStatus}</b>. Kenaikan Gaji
            Berkala hanya berlaku untuk Pegawai Tetap Yayasan. Bila status Anda sudah
            berubah menjadi Tetap, silakan hubungi Bagian Kepegawaian untuk memutakhirkan
            data.
          </p>
        </div>
      </div>
    );
  }

  if (emp.type === "DOSEN" && !dosenHasRecentBkdPasses(emp.bkdEvaluations)) {
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <div>
          <Link href="/my-requests" className="text-xs text-[var(--brand)] hover:underline">
            ← Kembali
          </Link>
          <h1 className="mt-1 text-2xl font-bold text-slate-900">Ajukan Kenaikan Gaji Berkala</h1>
        </div>
        <div className="rounded-lg border border-rose-300 bg-rose-50 p-4 text-sm text-rose-900">
          <p className="font-semibold">
            Pengajuan diblokir: BKD {DOSEN_REQUIRED_BKD_PASSES} semester terakhir belum lulus
          </p>
          <p className="mt-1 text-rose-800">
            Kenaikan Gaji Berkala hanya dapat diajukan jika hasil Evaluasi Kinerja Dosen (BKD)
            pada {DOSEN_REQUIRED_BKD_PASSES} semester terakhir berstatus <b>LULUS</b>. Mohon
            selesaikan BKD terlebih dahulu. Hubungi Bagian Kepegawaian bila data BKD Anda belum
            termutakhirkan.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link href="/my-requests" className="text-xs text-[var(--brand)] hover:underline">
          ← Kembali
        </Link>
        <h1 className="mt-1 text-2xl font-bold text-slate-900">Ajukan Kenaikan Gaji Berkala</h1>
        <p className="text-sm text-slate-600">
          Unggah dokumen pendukung yang diperlukan. Pengajuan akan diteruskan ke Bagian Kepegawaian
          untuk verifikasi.
        </p>
      </div>

      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="mb-2 text-sm font-semibold text-slate-900">Data Pegawai</h2>
        <dl className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
          <Row label="Nama Lengkap" value={emp.fullName} />
          <Row label="NIP" value={emp.nip} />
          <Row label="Status" value={emp.type === "DOSEN" ? "Dosen" : "Tenaga Kependidikan"} />
          <Row
            label={emp.type === "DOSEN" ? "Jabatan Akademik" : "Golongan"}
            value={
              emp.type === "DOSEN"
                ? emp.dosenDetail?.academicRank.name ?? "-"
                : `${emp.staffDetail?.payGrade.code ?? "-"} ${emp.staffDetail?.payGrade.name ?? ""}`
            }
          />
          <Row label="TMT Mulai Kerja" value={formatDateID(emp.hireDate)} />
          <Row label="TMT KGB Proyeksi" value={formatDateID(projectedDate)} />
          <Row label="Gaji Pokok Lama" value={formatRupiah(emp.currentBaseSalary)} />
          <Row label="Gaji Pokok Baru" value={formatRupiah(projectedNewSalary)} bold />
        </dl>
      </section>

      <form
        action={submitIncrementRequestAction}
        className="space-y-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
      >
        <h2 className="text-sm font-semibold text-slate-900">Dokumen Pendukung</h2>
        <p className="text-xs text-slate-500">
          Ukuran maksimum 10 MB per berkas. Format yang didukung: PDF, JPG, PNG, DOC/DOCX, XLS/XLSX.
        </p>
        {required.map((kind) => (
          <div key={kind}>
            <label htmlFor={`doc_${kind}`} className="block text-sm font-medium text-slate-700">
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
          <label htmlFor="notes" className="block text-sm font-medium text-slate-700">
            Catatan (opsional)
          </label>
          <textarea
            id="notes"
            name="notes"
            rows={3}
            className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            placeholder="Misalnya: nomor telpon, informasi tambahan…"
          />
        </div>
        <div className="flex justify-end gap-2">
          <Link
            href="/my-requests"
            className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Batal
          </Link>
          <button
            type="submit"
            className="rounded-md bg-[var(--brand)] px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[var(--brand-dark)]"
          >
            Kirim Pengajuan
          </button>
        </div>
      </form>
    </div>
  );
}

function Row({ label, value, bold = false }: { label: string; value: string; bold?: boolean }) {
  return (
    <>
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className={`text-sm ${bold ? "font-semibold text-emerald-700" : "text-slate-800"}`}>
        {value}
      </dd>
    </>
  );
}

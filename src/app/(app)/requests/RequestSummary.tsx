import Link from "next/link";
import { formatDateID, formatRupiah } from "@/lib/format";
import { humanDocumentKind, humanRequestStatus, requestStatusColor } from "@/lib/requests";
import { rapelBreakdown } from "@/lib/rapel";
import type {
  Employee,
  IncrementRequest,
  RequestDocument,
  User,
} from "@prisma/client";

export type RequestWithRelations = IncrementRequest & {
  employee: Employee;
  documents: RequestDocument[];
  hrReviewedBy?: User | null;
  rectorSignedBy?: User | null;
  foundationReviewedBy?: User | null;
};

export function RequestSummary({ r }: { r: RequestWithRelations }) {
  const rapel = rapelBreakdown(r.currentSalary, r.projectedNewSalary, r.projectedEffectiveDate);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Pengajuan KGB {r.employee.fullName}</h1>
          <p className="text-sm text-slate-600">NIP {r.employee.nip}</p>
        </div>
        <span
          className={`rounded-full border px-3 py-1 text-sm font-semibold ${requestStatusColor(r.status)}`}
        >
          {humanRequestStatus(r.status)}
        </span>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="mb-2 text-sm font-semibold text-slate-900">Ringkasan Kenaikan</h2>
          <dl className="space-y-1 text-sm">
            <Row label="Gaji Pokok Lama" value={formatRupiah(r.currentSalary)} />
            <Row label="Gaji Pokok Baru" value={formatRupiah(r.projectedNewSalary)} bold />
            <Row label="Kenaikan" value={`+${formatRupiah(r.incrementAmount)}`} />
            <Row label="TMT Proyeksi" value={formatDateID(r.projectedEffectiveDate)} />
            {rapel.months > 0 && (
              <>
                <Row
                  label="Keterlambatan"
                  value={`${rapel.months} bulan`}
                />
                <Row
                  label="Total Rapel"
                  value={formatRupiah(rapel.amount)}
                  bold
                />
              </>
            )}
          </dl>
          {rapel.months > 0 && (
            <p className="mt-3 rounded-md border border-rose-200 bg-rose-50 p-2 text-xs text-rose-800">
              Pengajuan ini terlambat {rapel.months} bulan dari TMT. Yayasan wajib menyiapkan
              rapel sebesar {formatRupiah(rapel.amount)} (selisih bulanan {formatRupiah(rapel.delta)}).
            </p>
          )}
          {r.employeeNotes && (
            <p className="mt-3 rounded-md bg-slate-50 p-2 text-xs text-slate-600">
              <span className="font-medium">Catatan pegawai:</span> {r.employeeNotes}
            </p>
          )}
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="mb-2 text-sm font-semibold text-slate-900">Lini Masa</h2>
          <ol className="space-y-2 text-sm text-slate-700">
            <TimelineStep
              label="Diajukan pegawai"
              when={r.submittedAt}
              done={!!r.submittedAt}
            />
            <TimelineStep
              label={`Diverifikasi Kepegawaian${r.hrReviewedBy ? ` (${r.hrReviewedBy.name})` : ""}`}
              when={r.hrReviewedAt}
              done={!!r.hrReviewedAt && r.status !== "HR_REJECTED"}
              rejected={r.status === "HR_REJECTED"}
              notes={r.hrNotes}
            />
            <TimelineStep
              label={`Ditandatangani Rektor${r.rectorSignedBy ? ` (${r.rectorSignedBy.name})` : ""}`}
              when={r.rectorSignedAt}
              done={!!r.rectorSignedAt}
              notes={r.rectorNotes}
            />
            <TimelineStep
              label={`Disetujui Yayasan${r.foundationReviewedBy ? ` (${r.foundationReviewedBy.name})` : ""}`}
              when={r.foundationReviewedAt}
              done={!!r.foundationReviewedAt && r.status !== "FOUNDATION_REJECTED"}
              rejected={r.status === "FOUNDATION_REJECTED"}
              notes={r.foundationNotes}
            />
            <TimelineStep label="SK Berkala diterbitkan" when={r.issuedAt} done={!!r.issuedAt} />
          </ol>
        </div>
      </div>

      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="mb-2 text-sm font-semibold text-slate-900">Dokumen Pendukung</h2>
        {r.documents.length === 0 ? (
          <p className="text-sm text-slate-500">Belum ada dokumen terunggah.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {r.documents.map((d) => (
              <li key={d.id} className="flex items-center justify-between py-2 text-sm">
                <div>
                  <div className="font-medium text-slate-800">{humanDocumentKind(d.kind)}</div>
                  <div className="text-xs text-slate-500">
                    {d.originalName} · {(d.sizeBytes / 1024).toFixed(0)} KB · diunggah{" "}
                    {formatDateID(d.uploadedAt)}
                  </div>
                </div>
                <Link
                  href={`/api/documents/${d.id}`}
                  className="rounded-md border border-slate-300 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                  target="_blank"
                >
                  Lihat
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {(r.status === "HR_VERIFIED" ||
        r.status === "RECTOR_SIGNED" ||
        r.status === "FOUNDATION_APPROVED" ||
        r.status === "ISSUED") && (
        <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="mb-2 text-sm font-semibold text-slate-900">Surat Pengantar Rektor</h2>
          <p className="text-sm text-slate-600">
            Nomor: <span className="font-mono">{r.coverLetterNumber ?? "-"}</span> · Tanggal:{" "}
            {r.coverLetterDate ? formatDateID(r.coverLetterDate) : "-"}
          </p>
          <Link
            href={`/api/requests/${r.id}/surat-pengantar.pdf`}
            target="_blank"
            className="mt-2 inline-flex rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            Unduh Surat Pengantar (PDF)
          </Link>
        </section>
      )}

      {r.status === "ISSUED" && r.incrementHistoryId && (
        <section className="rounded-lg border border-emerald-200 bg-emerald-50/50 p-4">
          <h2 className="mb-2 text-sm font-semibold text-emerald-900">SK Kenaikan Gaji Berkala</h2>
          <p className="text-sm text-emerald-800">
            Nomor SK: <span className="font-mono">{r.decreeNumber}</span> · Tanggal:{" "}
            {r.decreeDate ? formatDateID(r.decreeDate) : "-"}
          </p>
          <Link
            href={`/api/sk/${r.incrementHistoryId}`}
            target="_blank"
            className="mt-2 inline-flex rounded-md bg-emerald-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-800"
          >
            Unduh SK Berkala (PDF)
          </Link>
        </section>
      )}
    </div>
  );
}

function Row({ label, value, bold = false }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className={`text-sm ${bold ? "font-semibold text-slate-900" : "text-slate-800"}`}>
        {value}
      </dd>
    </div>
  );
}

function TimelineStep({
  label,
  when,
  done,
  rejected = false,
  notes,
}: {
  label: string;
  when: Date | null | undefined;
  done: boolean;
  rejected?: boolean;
  notes?: string | null;
}) {
  const color = rejected
    ? "bg-rose-500"
    : done
      ? "bg-emerald-500"
      : "bg-slate-300";
  return (
    <li className="flex gap-3">
      <span className={`mt-1 h-2.5 w-2.5 rounded-full ${color}`} />
      <div className="flex-1">
        <div className={rejected ? "text-rose-800" : done ? "text-slate-800" : "text-slate-500"}>
          {label}
        </div>
        {when && (
          <div className="text-xs text-slate-500">{formatDateID(when)}</div>
        )}
        {notes && (
          <div className="mt-1 rounded-md bg-slate-50 px-2 py-1 text-xs text-slate-700">{notes}</div>
        )}
      </div>
    </li>
  );
}

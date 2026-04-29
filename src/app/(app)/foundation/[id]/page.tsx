import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { RequestSummary } from "@/app/(app)/requests/RequestSummary";
import {
  foundationApproveAction,
  foundationRejectAction,
  foundationIssueSkAction,
} from "@/app/(app)/requests/actions";

export const dynamic = "force-dynamic";

function ymd(d: Date | null | undefined) {
  if (!d) return "";
  return d.toISOString().slice(0, 10);
}

export default async function FoundationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole(["FOUNDATION", "ADMIN"]);
  const { id } = await params;
  const r = await prisma.incrementRequest.findUnique({
    where: { id },
    include: {
      employee: true,
      documents: { orderBy: { uploadedAt: "asc" } },
      hrReviewedBy: true,
      rectorSignedBy: true,
      foundationReviewedBy: true,
    },
  });
  if (!r) notFound();

  const now = new Date();
  const monthRoman = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"][
    now.getMonth()
  ];
  const countIssued = await prisma.incrementRequest.count({
    where: { status: "ISSUED", issuedAt: { gte: new Date(now.getFullYear(), 0, 1) } },
  });
  const suggestedDecree = `${String(countIssued + 1).padStart(3, "0")}/SK.KGB/UGJ/${monthRoman}/${now.getFullYear()}`;

  return (
    <div className="space-y-5">
      <Link href="/foundation" className="text-xs text-[var(--brand)] hover:underline">
        ← Kembali ke portal Yayasan
      </Link>
      <RequestSummary r={r} />

      {r.status === "RECTOR_SIGNED" && (
        <div className="grid gap-4 md:grid-cols-2">
          <form
            action={foundationApproveAction}
            className="space-y-3 rounded-lg border border-emerald-200 bg-emerald-50/40 p-4"
          >
            <input type="hidden" name="requestId" value={r.id} />
            <h3 className="text-sm font-semibold text-emerald-900">Setujui Pengajuan</h3>
            <p className="text-xs text-emerald-800">
              Yayasan menyetujui usulan; selanjutnya Anda dapat menerbitkan SK Berkala.
            </p>
            <label className="block text-xs font-medium text-emerald-900">
              Catatan (opsional)
            </label>
            <textarea
              name="notes"
              rows={2}
              className="block w-full rounded-md border border-emerald-300 bg-white px-3 py-1.5 text-sm shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
            <button
              type="submit"
              className="rounded-md bg-emerald-700 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-800"
            >
              Setujui
            </button>
          </form>
          <form
            action={foundationRejectAction}
            className="space-y-3 rounded-lg border border-rose-200 bg-rose-50/40 p-4"
          >
            <input type="hidden" name="requestId" value={r.id} />
            <h3 className="text-sm font-semibold text-rose-900">Tolak Pengajuan</h3>
            <label className="block text-xs font-medium text-rose-900">Alasan *</label>
            <textarea
              name="notes"
              rows={3}
              required
              className="block w-full rounded-md border border-rose-300 bg-white px-3 py-1.5 text-sm shadow-sm focus:border-rose-500 focus:outline-none focus:ring-1 focus:ring-rose-500"
            />
            <button
              type="submit"
              className="rounded-md border border-rose-300 bg-white px-4 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-100"
            >
              Tolak
            </button>
          </form>
        </div>
      )}

      {r.status === "FOUNDATION_APPROVED" && (
        <form
          action={foundationIssueSkAction}
          className="space-y-3 rounded-lg border border-emerald-300 bg-emerald-50 p-4"
        >
          <input type="hidden" name="requestId" value={r.id} />
          <h3 className="text-sm font-semibold text-emerald-900">
            Terbitkan SK Kenaikan Gaji Berkala
          </h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-medium text-emerald-900">Nomor SK *</label>
              <input
                type="text"
                name="decreeNumber"
                required
                defaultValue={suggestedDecree}
                className="mt-1 block w-full rounded-md border border-emerald-300 bg-white px-3 py-1.5 text-sm font-mono shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-emerald-900">Tanggal SK *</label>
              <input
                type="date"
                name="decreeDate"
                required
                defaultValue={ymd(now)}
                className="mt-1 block w-full rounded-md border border-emerald-300 bg-white px-3 py-1.5 text-sm shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-emerald-900">Penandatangan *</label>
              <input
                type="text"
                name="signedByName"
                required
                defaultValue="Prof. Dr. Hj. Ernani Hadiyati, S.E., M.S."
                className="mt-1 block w-full rounded-md border border-emerald-300 bg-white px-3 py-1.5 text-sm shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-emerald-900">Jabatan *</label>
              <input
                type="text"
                name="signedByPosition"
                required
                defaultValue="Rektor Universitas Gajayana Malang"
                className="mt-1 block w-full rounded-md border border-emerald-300 bg-white px-3 py-1.5 text-sm shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>
          </div>
          <button
            type="submit"
            className="rounded-md bg-emerald-700 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-800"
          >
            Terbitkan SK &amp; Perbarui Gaji Pegawai
          </button>
        </form>
      )}
    </div>
  );
}

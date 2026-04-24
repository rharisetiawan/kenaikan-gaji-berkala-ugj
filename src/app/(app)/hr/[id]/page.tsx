import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { RequestSummary } from "@/app/(app)/requests/RequestSummary";
import { hrVerifyAction, hrRejectAction } from "@/app/(app)/requests/actions";

export const dynamic = "force-dynamic";

export default async function HrDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole(["HR", "ADMIN"]);
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

  return (
    <div className="space-y-5">
      <Link href="/hr" className="text-xs text-[var(--brand)] hover:underline">
        ← Kembali ke antrean Kepegawaian
      </Link>
      <RequestSummary r={r} />

      {r.status === "SUBMITTED" && (
        <div className="grid gap-4 md:grid-cols-2">
          <form
            action={hrVerifyAction}
            className="space-y-3 rounded-lg border border-emerald-200 bg-emerald-50/40 p-4"
          >
            <input type="hidden" name="requestId" value={r.id} />
            <h3 className="text-sm font-semibold text-emerald-900">Verifikasi &amp; Setujui</h3>
            <label className="block text-xs font-medium text-emerald-900">
              Nomor Surat Pengantar (opsional)
            </label>
            <input
              type="text"
              name="coverLetterNumber"
              placeholder="Kosongkan untuk otomatis"
              className="block w-full rounded-md border border-emerald-300 bg-white px-3 py-1.5 text-sm font-mono shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
            <label className="block text-xs font-medium text-emerald-900">Catatan (opsional)</label>
            <textarea
              name="notes"
              rows={2}
              className="block w-full rounded-md border border-emerald-300 bg-white px-3 py-1.5 text-sm shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
            <button
              type="submit"
              className="rounded-md bg-emerald-700 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-800"
            >
              Verifikasi &amp; Buat Surat Pengantar
            </button>
          </form>

          <form
            action={hrRejectAction}
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
              placeholder="Contoh: SKP belum ditandatangani atasan langsung."
            />
            <button
              type="submit"
              className="rounded-md border border-rose-300 bg-white px-4 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-100"
            >
              Tolak Pengajuan
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { RequestSummary } from "@/app/(app)/requests/RequestSummary";
import { rectorSignAction } from "@/app/(app)/requests/actions";

export const dynamic = "force-dynamic";

export default async function RectorDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole(["RECTOR", "ADMIN"]);
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
      <Link href="/rector" className="text-xs text-[var(--brand)] hover:underline">
        ← Kembali ke antrean Rektor
      </Link>
      <RequestSummary r={r} />

      {r.status === "HR_VERIFIED" && (
        <form
          action={rectorSignAction}
          className="space-y-3 rounded-lg border border-sky-200 bg-sky-50/40 p-4"
        >
          <input type="hidden" name="requestId" value={r.id} />
          <h3 className="text-sm font-semibold text-sky-900">Tanda Tangani Surat Pengantar</h3>
          <p className="text-xs text-sky-800">
            Dengan menandatangani, Surat Pengantar otomatis diteruskan ke Yayasan untuk disetujui.
            Pastikan Anda telah meninjau Surat Pengantar (tombol unduh di atas).
          </p>
          <label className="block text-xs font-medium text-sky-900">Catatan (opsional)</label>
          <textarea
            name="notes"
            rows={2}
            className="block w-full rounded-md border border-sky-300 bg-white px-3 py-1.5 text-sm shadow-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
          />
          <button
            type="submit"
            className="rounded-md bg-sky-700 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-sky-800"
          >
            Tanda Tangani &amp; Teruskan ke Yayasan
          </button>
        </form>
      )}
    </div>
  );
}

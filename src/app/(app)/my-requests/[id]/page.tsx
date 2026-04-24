import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { RequestSummary } from "@/app/(app)/requests/RequestSummary";
import { cancelRequestAction } from "@/app/(app)/requests/actions";

export const dynamic = "force-dynamic";

export default async function MyRequestDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireUser();
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

  if (session.role === "EMPLOYEE") {
    const user = await prisma.user.findUnique({ where: { id: session.userId } });
    if (!user?.employeeId || user.employeeId !== r.employeeId) redirect("/my-requests");
  }

  const canCancel = ["DRAFT", "SUBMITTED", "HR_REJECTED", "FOUNDATION_REJECTED"].includes(r.status);

  return (
    <div className="space-y-5">
      <Link href="/my-requests" className="text-xs text-[var(--brand)] hover:underline">
        ← Kembali ke daftar
      </Link>
      <RequestSummary r={r} />
      {canCancel && (
        <form action={cancelRequestAction} className="rounded-lg border border-rose-200 bg-rose-50/40 p-4">
          <input type="hidden" name="requestId" value={r.id} />
          <p className="mb-2 text-sm text-rose-800">
            Anda dapat membatalkan pengajuan ini selama belum diverifikasi.
          </p>
          <button
            type="submit"
            className="rounded-md border border-rose-300 bg-white px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-100"
          >
            Batalkan Pengajuan
          </button>
        </form>
      )}
    </div>
  );
}

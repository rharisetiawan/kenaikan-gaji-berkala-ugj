import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { formatDateID, formatRupiah } from "@/lib/format";
import {
  humanRequestStatus,
  requestStatusColor,
  statusProgressPercent,
} from "@/lib/requests";
import { computeIncrementAmount } from "@/lib/eligibility";

export const dynamic = "force-dynamic";

export default async function MyRequestsPage() {
  const session = await requireUser();
  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    include: { employee: true },
  });

  if (!user?.employee) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
        Akun Anda belum tertaut dengan data pegawai. Hubungi Bagian Kepegawaian.
      </div>
    );
  }

  const today = new Date();
  const emp = user.employee;
  const requests = await prisma.incrementRequest.findMany({
    where: { employeeId: emp.id },
    orderBy: { createdAt: "desc" },
  });

  const msInDay = 1000 * 60 * 60 * 24;
  const daysUntilNext = Math.ceil(
    (emp.nextIncrementDate.getTime() - today.getTime()) / msInDay,
  );
  const reminderActive = daysUntilNext <= 90;
  const hasActiveRequest = requests.some((r) =>
    ["SUBMITTED", "HR_VERIFIED", "RECTOR_SIGNED", "FOUNDATION_APPROVED"].includes(r.status),
  );
  const canSubmitKgb = emp.employmentStatus === "TETAP";
  const projectedIncrement = computeIncrementAmount(emp.currentBaseSalary);
  const projectedNewSalary = emp.currentBaseSalary + projectedIncrement;

  if (session.role !== "EMPLOYEE" && session.role !== "ADMIN") {
    redirect("/dashboard");
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Pengajuan KGB Saya</h1>
          <p className="text-sm text-slate-600">
            Ajukan Kenaikan Gaji Berkala (KGB) secara mandiri dan pantau status persetujuannya.
          </p>
        </div>
        {!hasActiveRequest && canSubmitKgb && (
          <Link
            href="/my-requests/new"
            className="rounded-md bg-[var(--brand)] px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[var(--brand-dark)]"
          >
            + Ajukan KGB Baru
          </Link>
        )}
      </div>

      <section
        className={`rounded-lg border p-4 shadow-sm ${
          reminderActive
            ? "border-amber-300 bg-amber-50"
            : "border-slate-200 bg-white"
        }`}
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2
              className={`text-sm font-semibold ${
                reminderActive ? "text-amber-900" : "text-slate-900"
              }`}
            >
              {reminderActive
                ? "Pengingat: Saatnya Mengajukan Kenaikan Gaji Berkala"
                : "Status Kepegawaian Anda"}
            </h2>
            <p className="mt-1 text-sm text-slate-700">
              TMT KGB berikutnya Anda:{" "}
              <span className="font-semibold">{formatDateID(emp.nextIncrementDate)}</span>
              {reminderActive && daysUntilNext >= 0 && (
                <>
                  {" "}
                  — kurang lebih <span className="font-semibold">{daysUntilNext} hari</span> lagi.
                </>
              )}
              {reminderActive && daysUntilNext < 0 && (
                <>
                  {" "}
                  — <span className="font-semibold">sudah melewati TMT {Math.abs(daysUntilNext)} hari</span>.
                </>
              )}
            </p>
            <p className="mt-1 text-xs text-slate-600">
              Proyeksi gaji pokok baru:{" "}
              <span className="font-semibold">{formatRupiah(projectedNewSalary)}</span> (
              +{formatRupiah(projectedIncrement)} dari {formatRupiah(emp.currentBaseSalary)}).
            </p>
          </div>
          {reminderActive && !hasActiveRequest && canSubmitKgb && (
            <Link
              href="/my-requests/new"
              className="rounded-md bg-amber-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-amber-700"
            >
              Ajukan Sekarang
            </Link>
          )}
          {!canSubmitKgb && (
            <span className="rounded-md border border-amber-300 bg-amber-50 px-3 py-1 text-xs text-amber-800">
              Status {emp.employmentStatus} — KGB tidak berlaku
            </span>
          )}
          {hasActiveRequest && (
            <span className="rounded-md border border-slate-300 bg-white px-3 py-1 text-xs text-slate-700">
              Pengajuan aktif sedang diproses
            </span>
          )}
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-5 py-3">
          <h2 className="text-base font-semibold text-slate-900">Riwayat Pengajuan</h2>
        </div>
        {requests.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-slate-500">
            Belum ada pengajuan KGB. Klik &quot;Ajukan KGB Baru&quot; untuk memulai.
          </p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {requests.map((r) => (
              <li key={r.id} className="px-5 py-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <Link
                      href={`/my-requests/${r.id}`}
                      className="text-sm font-semibold text-slate-900 hover:underline"
                    >
                      Pengajuan {formatDateID(r.createdAt)}
                    </Link>
                    <p className="text-xs text-slate-500">
                      TMT proyeksi {formatDateID(r.projectedEffectiveDate)} ·{" "}
                      {formatRupiah(r.currentSalary)} → {formatRupiah(r.projectedNewSalary)}
                    </p>
                  </div>
                  <span
                    className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${requestStatusColor(r.status)}`}
                  >
                    {humanRequestStatus(r.status)}
                  </span>
                </div>
                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full bg-[var(--brand)] transition-all"
                    style={{ width: `${statusProgressPercent(r.status)}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

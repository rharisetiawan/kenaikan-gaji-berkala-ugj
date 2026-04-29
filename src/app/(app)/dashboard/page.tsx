import Link from "next/link";
import { redirect } from "next/navigation";
import { loadAllEmployeesWithDetails, evaluateAll } from "@/lib/employees";
import { formatDateID, formatRupiah } from "@/lib/format";
import { humanEligibilityStatus } from "@/lib/eligibility";
import { getKgbRules } from "@/lib/app-settings";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { humanRequestStatus, requestStatusColor } from "@/lib/requests";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const session = await requireUser();
  // Route employees and review-only roles straight to their dedicated portals.
  if (session.role === "EMPLOYEE") {
    // KONTRAK / HONORER have no KGB rights — route them to the contract
    // renewal hub instead of /my-requests (which would just show "KGB tidak
    // berlaku" and no actionable state).
    const dbUser = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { employee: { select: { employmentStatus: true } } },
    });
    const empStatus = dbUser?.employee?.employmentStatus;
    if (empStatus === "KONTRAK" || empStatus === "HONORER") {
      redirect("/kontrak");
    }
    redirect("/my-requests");
  }
  if (session.role === "RECTOR") redirect("/rector");
  if (session.role === "FOUNDATION") redirect("/foundation");

  const today = new Date();
  const employees = await loadAllEmployeesWithDetails();
  const rules = await getKgbRules();
  const evaluations = evaluateAll(employees, today, rules);
  const activeRequests = await prisma.incrementRequest.findMany({
    where: {
      status: { in: ["SUBMITTED", "HR_VERIFIED", "RECTOR_SIGNED", "FOUNDATION_APPROVED"] },
    },
    include: { employee: true },
    orderBy: { updatedAt: "desc" },
    take: 8,
  });

  const dosenCount = employees.filter((e) => e.type === "DOSEN").length;
  const staffCount = employees.filter((e) => e.type === "STAFF").length;
  const eligibleSoon = evaluations
    .filter((e) => e.eligibility.status === "ELIGIBLE")
    .sort((a, b) => a.eligibility.projectedEffectiveDate.getTime() - b.eligibility.projectedEffectiveDate.getTime());
  const blocked = evaluations.filter((e) => e.eligibility.status === "BLOCKED");
  const upcoming = evaluations
    .filter((e) => {
      if (e.eligibility.status !== "NOT_YET") return false;
      const diff = e.eligibility.projectedEffectiveDate.getTime() - today.getTime();
      return diff < 180 * 24 * 60 * 60 * 1000;
    })
    .sort((a, b) => a.eligibility.projectedEffectiveDate.getTime() - b.eligibility.projectedEffectiveDate.getTime())
    .slice(0, 5);

  const totalBudgetImpact = eligibleSoon.reduce((sum, e) => sum + e.eligibility.incrementAmount, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Beranda</h1>
        <p className="text-sm text-slate-600">
          Ringkasan Kenaikan Gaji Berkala (KGB) Dosen &amp; Tenaga Kependidikan Universitas Gajayana.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total Dosen" value={dosenCount} sub="orang aktif" tone="brand" />
        <StatCard label="Total Tenaga Kependidikan" value={staffCount} sub="orang aktif" tone="brand" />
        <StatCard
          label="Layak KGB ≤ 3 Bulan"
          value={eligibleSoon.length}
          sub="perlu diproses SK"
          tone="success"
        />
        <StatCard
          label="Estimasi Kenaikan Bulanan"
          value={formatRupiah(totalBudgetImpact)}
          sub="total penambahan gaji pokok"
          tone="accent"
          valueAsString
        />
      </div>

      <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              Pegawai yang Layak Naik Gaji dalam 3 Bulan Mendatang
            </h2>
            <p className="text-xs text-slate-500">
              Daftar ini dihitung otomatis berdasarkan masa kerja, jabatan akademik/golongan, dan hasil evaluasi terakhir.
            </p>
          </div>
          <Link
            href="/employees"
            className="text-sm font-medium text-[var(--brand)] hover:underline"
          >
            Lihat semua pegawai →
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr>
                <Th>NIP</Th>
                <Th>Nama Lengkap</Th>
                <Th>Jenis</Th>
                <Th>Jabatan / Golongan</Th>
                <Th>TMT Kenaikan</Th>
                <Th>Gaji Pokok Baru</Th>
                <Th>Kenaikan</Th>
                <Th>Aksi</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {eligibleSoon.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-slate-500">
                    Tidak ada pegawai yang memenuhi syarat kenaikan dalam 3 bulan ke depan.
                  </td>
                </tr>
              ) : (
                eligibleSoon.map(({ employee, eligibility }) => (
                  <tr key={employee.id} className="bg-green-50/30 hover:bg-green-50/70">
                    <Td className="font-mono text-xs">{employee.nip}</Td>
                    <Td className="font-medium text-slate-900">{employee.fullName}</Td>
                    <Td>
                      <TypeBadge type={employee.type} />
                    </Td>
                    <Td>
                      {employee.type === "DOSEN"
                        ? employee.dosenDetail?.academicRank.name ?? "-"
                        : `${employee.staffDetail?.payGrade.code ?? ""} ${employee.staffDetail?.payGrade.name ?? ""}`}
                    </Td>
                    <Td>{formatDateID(eligibility.projectedEffectiveDate)}</Td>
                    <Td>{formatRupiah(eligibility.projectedNewSalary)}</Td>
                    <Td className="text-emerald-700 font-semibold">
                      +{formatRupiah(eligibility.incrementAmount)}
                    </Td>
                    <Td>
                      <Link
                        href={`/employees/${employee.id}`}
                        className="inline-flex items-center rounded-md bg-[var(--brand)] px-3 py-1 text-xs font-medium text-white hover:bg-[var(--brand-dark)]"
                      >
                        Proses SK
                      </Link>
                    </Td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              Pengajuan KGB Aktif Terbaru
            </h2>
            <p className="text-xs text-slate-500">
              Alur persetujuan Pegawai → Kepegawaian → Rektor → Yayasan.
            </p>
          </div>
          <Link href="/hr" className="text-sm font-medium text-[var(--brand)] hover:underline">
            Buka antrean Kepegawaian →
          </Link>
        </div>
        {activeRequests.length === 0 ? (
          <p className="px-5 py-6 text-sm text-slate-500">Belum ada pengajuan aktif.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {activeRequests.map((r) => (
              <li key={r.id} className="flex items-start justify-between gap-4 px-5 py-3">
                <div>
                  <Link href={`/hr/${r.id}`} className="font-medium text-slate-900 hover:underline">
                    {r.employee.fullName}
                  </Link>
                  <p className="text-xs text-slate-500">{r.employee.nip}</p>
                  <p className="mt-1 text-xs text-slate-600">
                    Proyeksi: {formatRupiah(r.currentSalary)} → {formatRupiah(r.projectedNewSalary)} · TMT{" "}
                    {formatDateID(r.projectedEffectiveDate)}
                  </p>
                </div>
                <span
                  className={`shrink-0 rounded-full border px-2 py-0.5 text-xs font-medium ${requestStatusColor(r.status)}`}
                >
                  {humanRequestStatus(r.status)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-5 py-3">
            <h2 className="text-base font-semibold text-slate-900">Perlu Perhatian: Terkendala Syarat</h2>
            <p className="text-xs text-slate-500">
              Sudah masuk jendela waktu namun belum memenuhi syarat BKD atau penilaian kinerja.
            </p>
          </div>
          <ul className="divide-y divide-slate-100">
            {blocked.length === 0 ? (
              <li className="px-5 py-6 text-sm text-slate-500">Tidak ada.</li>
            ) : (
              blocked.map(({ employee, eligibility }) => (
                <li key={employee.id} className="flex items-start justify-between gap-4 px-5 py-3">
                  <div>
                    <Link href={`/employees/${employee.id}`} className="font-medium text-slate-900 hover:underline">
                      {employee.fullName}
                    </Link>
                    <p className="text-xs text-slate-500">{employee.nip}</p>
                    <p className="mt-1 text-xs text-red-700">{eligibility.reasons[eligibility.reasons.length - 1]}</p>
                  </div>
                  <span className="shrink-0 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                    {humanEligibilityStatus(eligibility.status)}
                  </span>
                </li>
              ))
            )}
          </ul>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-5 py-3">
            <h2 className="text-base font-semibold text-slate-900">KGB Berikutnya (≤ 6 Bulan)</h2>
            <p className="text-xs text-slate-500">
              Pegawai yang akan masuk jendela kenaikan dalam waktu dekat.
            </p>
          </div>
          <ul className="divide-y divide-slate-100">
            {upcoming.length === 0 ? (
              <li className="px-5 py-6 text-sm text-slate-500">Tidak ada.</li>
            ) : (
              upcoming.map(({ employee, eligibility }) => (
                <li key={employee.id} className="flex items-start justify-between gap-4 px-5 py-3">
                  <div>
                    <Link href={`/employees/${employee.id}`} className="font-medium text-slate-900 hover:underline">
                      {employee.fullName}
                    </Link>
                    <p className="text-xs text-slate-500">{employee.nip}</p>
                    <p className="mt-1 text-xs text-slate-600">
                      TMT proyeksi: <span className="font-medium">{formatDateID(eligibility.projectedEffectiveDate)}</span>
                    </p>
                  </div>
                  <TypeBadge type={employee.type} />
                </li>
              ))
            )}
          </ul>
        </section>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  sub,
  tone,
  valueAsString,
}: {
  label: string;
  value: number | string;
  sub?: string;
  tone: "brand" | "success" | "accent";
  valueAsString?: boolean;
}) {
  const toneClass = {
    brand: "bg-[var(--brand)] text-white",
    success: "bg-emerald-600 text-white",
    accent: "bg-amber-500 text-slate-900",
  }[tone];
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className={`inline-flex rounded-full ${toneClass} px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide`}>
        {tone === "success" ? "prioritas" : tone === "accent" ? "estimasi" : "total"}
      </div>
      <div className="mt-2 text-xs font-medium uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-1 text-2xl font-bold text-slate-900">
        {valueAsString ? (value as string) : Number(value).toLocaleString("id-ID")}
      </div>
      {sub && <div className="text-xs text-slate-500">{sub}</div>}
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

function Td({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-4 py-2 text-sm text-slate-700 ${className}`}>{children}</td>;
}

function TypeBadge({ type }: { type: "DOSEN" | "STAFF" }) {
  if (type === "DOSEN") {
    return (
      <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800">
        Dosen
      </span>
    );
  }
  return (
    <span className="rounded-full bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-800">
      Tendik
    </span>
  );
}

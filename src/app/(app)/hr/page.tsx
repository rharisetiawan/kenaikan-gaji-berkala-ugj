import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatDateID, formatRupiah } from "@/lib/format";
import {
  humanRequestStatus,
  requestStatusColor,
  DOSEN_WORKFLOW_ENABLED,
} from "@/lib/requests";
import { rapelBreakdown } from "@/lib/rapel";
import type { IncrementRequestStatus } from "@prisma/client";

export const dynamic = "force-dynamic";

const TAB_STATUSES: Record<string, IncrementRequestStatus[]> = {
  menunggu: ["SUBMITTED"],
  "sedang-diproses": ["HR_VERIFIED", "RECTOR_SIGNED", "FOUNDATION_APPROVED"],
  selesai: ["ISSUED"],
  ditolak: ["HR_REJECTED", "FOUNDATION_REJECTED", "CANCELLED"],
  semua: [
    "DRAFT",
    "SUBMITTED",
    "HR_REJECTED",
    "HR_VERIFIED",
    "RECTOR_SIGNED",
    "FOUNDATION_REJECTED",
    "FOUNDATION_APPROVED",
    "ISSUED",
    "CANCELLED",
  ],
};

export default async function HrPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  await requireRole(["HR", "ADMIN"]);
  const { tab: tabParam } = await searchParams;
  const activeTab = (tabParam && Object.keys(TAB_STATUSES).includes(tabParam) ? tabParam : "menunggu") as keyof typeof TAB_STATUSES;
  const statuses = TAB_STATUSES[activeTab];

  // Scope: focus on Tenaga Kependidikan (Staff) first; Dosen workflow on hold.
  const employeeTypeFilter = DOSEN_WORKFLOW_ENABLED ? undefined : ("STAFF" as const);

  const [counts, requests, pegawaiDueSoon] = await Promise.all([
    (async () => {
      const allRequests = await prisma.incrementRequest.findMany({
        where: employeeTypeFilter ? { employee: { type: employeeTypeFilter } } : {},
        select: { status: true },
      });
      return Object.fromEntries(
        Object.entries(TAB_STATUSES).map(([k, ss]) => [
          k,
          allRequests.filter((r) => ss.includes(r.status)).length,
        ]),
      );
    })(),
    prisma.incrementRequest.findMany({
      where: {
        status: { in: statuses },
        ...(employeeTypeFilter ? { employee: { type: employeeTypeFilter } } : {}),
      },
      include: { employee: true },
      orderBy: { updatedAt: "desc" },
    }),
    (async () => {
      const now = new Date();
      // Include overdue (past TMT) pegawai too — they're the ones accruing rapel.
      const ninetyDaysFromNow = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
      return prisma.employee.findMany({
        where: {
          status: "ACTIVE",
          // KGB is only for permanent employees — skip KONTRAK/HONORER.
          employmentStatus: "TETAP",
          ...(employeeTypeFilter ? { type: employeeTypeFilter } : {}),
          nextIncrementDate: { lte: ninetyDaysFromNow },
          incrementRequests: {
            none: {
              status: {
                in: ["SUBMITTED", "HR_VERIFIED", "RECTOR_SIGNED", "FOUNDATION_APPROVED"],
              },
            },
          },
        },
        orderBy: { nextIncrementDate: "asc" },
        take: 8,
      });
    })(),
  ]);

  // Rapel snapshot per request (only meaningful for SUBMITTED / in-progress).
  const rapelByRequestId = new Map<string, { months: number; amount: number }>();
  for (const r of requests) {
    const br = rapelBreakdown(r.currentSalary, r.projectedNewSalary, r.projectedEffectiveDate);
    rapelByRequestId.set(r.id, { months: br.months, amount: br.amount });
  }
  const totalRapel = Array.from(rapelByRequestId.values()).reduce((s, v) => s + v.amount, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Verifikasi Kepegawaian</h1>
        <p className="text-sm text-slate-600">
          Kelola pengajuan Kenaikan Gaji Berkala{" "}
          {DOSEN_WORKFLOW_ENABLED
            ? "dari Dosen dan Tenaga Kependidikan."
            : "Tenaga Kependidikan. (Alur Dosen sedang disiapkan.)"}
        </p>
      </div>

      <section className="grid gap-3 sm:grid-cols-3">
        <KpiCard label="Menunggu Verifikasi" value={counts.menunggu ?? 0} />
        <KpiCard label="Sedang Diproses" value={counts["sedang-diproses"] ?? 0} />
        <KpiCard
          label="Estimasi Total Rapel (tab aktif)"
          value={formatRupiah(totalRapel)}
          hint={`Sebanyak ${rapelByRequestId.size} pengajuan`}
        />
      </section>

      {pegawaiDueSoon.length > 0 && (
        <section className="rounded-lg border border-amber-200 bg-amber-50 p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-amber-900">
              Pengingat Otomatis – {pegawaiDueSoon.length} pegawai belum mengajukan KGB ≤ 90 hari
            </h2>
          </div>
          <ul className="mt-2 space-y-1 text-sm text-amber-900">
            {pegawaiDueSoon.map((p) => (
              <li key={p.id} className="flex items-center justify-between">
                <span>
                  {p.fullName} ({p.nip}) – TMT {formatDateID(p.nextIncrementDate)}
                </span>
                <Link
                  href={`/employees/${p.id}`}
                  className="text-xs font-medium text-amber-900 underline"
                >
                  Detail
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <nav className="flex flex-wrap gap-2 border-b border-slate-200 pb-2 text-sm">
        {Object.entries(TAB_STATUSES).map(([key]) => (
          <Link
            key={key}
            href={`/hr?tab=${key}`}
            className={`rounded-md px-3 py-1.5 ${
              key === activeTab
                ? "bg-[var(--brand)] text-white"
                : "bg-white text-slate-700 hover:bg-slate-100"
            }`}
          >
            {humanTab(key)} <span className="ml-1 text-xs opacity-80">({counts[key] ?? 0})</span>
          </Link>
        ))}
      </nav>

      <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr>
                <Th>Pegawai</Th>
                <Th>NIP</Th>
                <Th>TMT Proyeksi</Th>
                <Th>Gaji Lama → Baru</Th>
                <Th>Total Rapel</Th>
                <Th>Status</Th>
                <Th>Aksi</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {requests.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                    Tidak ada pengajuan pada kategori ini.
                  </td>
                </tr>
              ) : (
                requests.map((r) => {
                  const br = rapelByRequestId.get(r.id)!;
                  return (
                    <tr key={r.id} className="hover:bg-slate-50">
                      <Td className="font-medium">{r.employee.fullName}</Td>
                      <Td className="font-mono text-xs">{r.employee.nip}</Td>
                      <Td>{formatDateID(r.projectedEffectiveDate)}</Td>
                      <Td className="whitespace-nowrap">
                        {formatRupiah(r.currentSalary)} <span className="text-slate-400">→</span>{" "}
                        <span className="font-medium">{formatRupiah(r.projectedNewSalary)}</span>
                      </Td>
                      <Td>
                        {br.months === 0 ? (
                          <span className="text-xs text-slate-500">Tidak ada (belum lewat TMT)</span>
                        ) : (
                          <div className="whitespace-nowrap">
                            <div className="font-semibold text-rose-700">
                              {formatRupiah(br.amount)}
                            </div>
                            <div className="text-[11px] text-slate-500">{br.months} bulan</div>
                          </div>
                        )}
                      </Td>
                      <Td>
                        <span
                          className={`inline-flex rounded-full border px-2 py-0.5 text-xs ${requestStatusColor(r.status)}`}
                        >
                          {humanRequestStatus(r.status)}
                        </span>
                      </Td>
                      <Td>
                        <Link
                          href={`/hr/${r.id}`}
                          className="rounded-md bg-[var(--brand)] px-3 py-1 text-xs font-medium text-white hover:bg-[var(--brand-dark)]"
                        >
                          Proses
                        </Link>
                      </Td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
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
  return <td className={`px-4 py-2 text-slate-700 ${className}`}>{children}</td>;
}
function KpiCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string | number;
  hint?: string;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-1 text-xl font-bold text-slate-900">{value}</div>
      {hint && <div className="mt-0.5 text-xs text-slate-500">{hint}</div>}
    </div>
  );
}
function humanTab(key: string) {
  switch (key) {
    case "menunggu":
      return "Menunggu Verifikasi";
    case "sedang-diproses":
      return "Sedang Diproses";
    case "selesai":
      return "SK Terbit";
    case "ditolak":
      return "Ditolak / Dibatalkan";
    case "semua":
      return "Semua";
    default:
      return key;
  }
}

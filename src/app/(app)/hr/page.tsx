import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatDateID, formatRupiah } from "@/lib/format";
import {
  humanRequestStatus,
  requestStatusColor,
} from "@/lib/requests";
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

  const [counts, requests, pegawaiDueSoon] = await Promise.all([
    (async () => {
      const allRequests = await prisma.incrementRequest.findMany({ select: { status: true } });
      return Object.fromEntries(
        Object.entries(TAB_STATUSES).map(([k, ss]) => [
          k,
          allRequests.filter((r) => ss.includes(r.status)).length,
        ]),
      );
    })(),
    prisma.incrementRequest.findMany({
      where: { status: { in: statuses } },
      include: { employee: true },
      orderBy: { updatedAt: "desc" },
    }),
    (async () => {
      const now = new Date();
      const ninetyDaysFromNow = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
      return prisma.employee.findMany({
        where: {
          status: "ACTIVE",
          nextIncrementDate: { gte: now, lte: ninetyDaysFromNow },
          incrementRequests: {
            none: {
              status: {
                in: ["SUBMITTED", "HR_VERIFIED", "RECTOR_SIGNED", "FOUNDATION_APPROVED"],
              },
            },
          },
        },
        orderBy: { nextIncrementDate: "asc" },
        take: 6,
      });
    })(),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Verifikasi Kepegawaian</h1>
        <p className="text-sm text-slate-600">
          Kelola pengajuan Kenaikan Gaji Berkala dari Dosen dan Tenaga Kependidikan.
        </p>
      </div>

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
                <Th>Jenis</Th>
                <Th>TMT Proyeksi</Th>
                <Th>Gaji Baru</Th>
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
                requests.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50">
                    <Td className="font-medium">{r.employee.fullName}</Td>
                    <Td className="font-mono text-xs">{r.employee.nip}</Td>
                    <Td>{r.employee.type === "DOSEN" ? "Dosen" : "Tendik"}</Td>
                    <Td>{formatDateID(r.projectedEffectiveDate)}</Td>
                    <Td>{formatRupiah(r.projectedNewSalary)}</Td>
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
                ))
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

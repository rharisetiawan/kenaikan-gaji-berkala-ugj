import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatDateID } from "@/lib/format";
import {
  computeProfileCompleteness,
  humanEmployeeType,
  humanProfileField,
} from "@/lib/profile";

export const dynamic = "force-dynamic";

function humanEmploymentStatus(status: string): string {
  switch (status) {
    case "TETAP":
      return "Tetap";
    case "KONTRAK":
      return "Kontrak";
    case "HONORER":
      return "Honorer";
    default:
      return status;
  }
}

export default async function KelengkapanDataPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  await requireRole(["HR", "ADMIN"]);
  const { filter } = await searchParams;

  const employees = await prisma.employee.findMany({
    where: { status: "ACTIVE" },
    include: { dosenDetail: true },
    orderBy: { fullName: "asc" },
  });

  const rows = employees.map((emp) => {
    const c = computeProfileCompleteness(emp, emp.dosenDetail ?? null);
    return { emp, completeness: c };
  });

  // Aggregate stats
  const total = rows.length;
  const lengkap = rows.filter((r) => r.completeness.percent === 100).length;
  const sebagian = rows.filter(
    (r) => r.completeness.percent > 0 && r.completeness.percent < 100,
  ).length;
  const kosong = rows.filter((r) => r.completeness.percent === 0).length;
  const avg =
    total === 0
      ? 0
      : Math.round(
          rows.reduce((s, r) => s + r.completeness.percent, 0) / total,
        );

  const filterOptions = [
    { key: "all", label: "Semua", predicate: () => true },
    {
      key: "belum-lengkap",
      label: "Belum Lengkap",
      predicate: (p: number) => p < 100,
    },
    {
      key: "lengkap",
      label: "Sudah Lengkap",
      predicate: (p: number) => p === 100,
    },
  ];
  const activeFilter =
    filterOptions.find((f) => f.key === filter)?.key ?? "belum-lengkap";
  const activePredicate =
    filterOptions.find((f) => f.key === activeFilter)?.predicate ??
    (() => true);

  const displayRows = rows
    .filter((r) => activePredicate(r.completeness.percent))
    .sort((a, b) => a.completeness.percent - b.completeness.percent);

  return (
    <div className="space-y-6">
      <div>
        <div className="text-xs text-slate-500">
          <Link href="/hr" className="hover:underline">Verifikasi Kepegawaian</Link> /
          Kelengkapan Data
        </div>
        <h1 className="mt-1 text-2xl font-bold text-slate-900">
          Kelengkapan Data Pegawai
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Pantau pegawai yang belum melengkapi data profilnya. Data ini penting
          untuk pengisian borang BAN-PT, laporan LLDikti, dan pemutakhiran
          SIAKAD.
        </p>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi
          label="Total Pegawai Aktif"
          value={total.toString()}
          tone="slate"
        />
        <Kpi
          label="Rata-rata Kelengkapan"
          value={`${avg}%`}
          tone={avg >= 80 ? "emerald" : avg >= 50 ? "amber" : "rose"}
        />
        <Kpi
          label="Profil Lengkap"
          value={`${lengkap} / ${total}`}
          tone="emerald"
          hint={
            total === 0 ? "—" : `${Math.round((lengkap / total) * 100)}%`
          }
        />
        <Kpi
          label="Belum Lengkap"
          value={`${sebagian + kosong}`}
          tone="rose"
          hint={`${sebagian} sebagian, ${kosong} kosong`}
        />
      </div>

      {/* Filter tabs */}
      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-1">
        {filterOptions.map((opt) => (
          <Link
            key={opt.key}
            href={`/hr/kelengkapan?filter=${opt.key}`}
            className={`rounded-t-md px-3 py-1.5 text-sm font-medium ${
              activeFilter === opt.key
                ? "border-b-2 border-[var(--brand)] text-[var(--brand)]"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            {opt.label}
          </Link>
        ))}
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-3 py-2 text-left">Pegawai</th>
              <th className="px-3 py-2 text-left">Jenis</th>
              <th className="px-3 py-2 text-left">Status</th>
              <th className="px-3 py-2 text-left">Kelengkapan</th>
              <th className="px-3 py-2 text-left">Kolom Kosong</th>
              <th className="px-3 py-2 text-left">Terakhir Update</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {displayRows.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="px-3 py-8 text-center text-sm text-slate-500"
                >
                  Tidak ada pegawai yang cocok dengan filter ini.
                </td>
              </tr>
            ) : (
              displayRows.map(({ emp, completeness }) => (
                <tr key={emp.id} className="hover:bg-slate-50">
                  <td className="px-3 py-2">
                    <Link
                      href={`/employees/${emp.id}`}
                      className="font-medium text-slate-900 hover:underline"
                    >
                      {emp.fullName}
                    </Link>
                    <div className="font-mono text-[11px] text-slate-500">
                      {emp.nip}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-slate-700">
                    {humanEmployeeType(emp.type)}
                  </td>
                  <td className="px-3 py-2 text-slate-700">
                    {humanEmploymentStatus(emp.employmentStatus)}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-24 overflow-hidden rounded-full bg-slate-100">
                        <div
                          className={`h-full ${
                            completeness.percent >= 80
                              ? "bg-emerald-500"
                              : completeness.percent >= 50
                              ? "bg-amber-500"
                              : "bg-rose-500"
                          }`}
                          style={{ width: `${completeness.percent}%` }}
                        />
                      </div>
                      <span className="text-xs font-medium text-slate-700">
                        {completeness.percent}%
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-500">
                      {completeness.filled}/{completeness.total} kolom
                    </div>
                  </td>
                  <td className="px-3 py-2 text-xs text-slate-600">
                    {completeness.missingFields.length === 0 ? (
                      <span className="text-emerald-600">✓ Lengkap</span>
                    ) : (
                      completeness.missingFields
                        .slice(0, 3)
                        .map(humanProfileField)
                        .join(", ") +
                      (completeness.missingFields.length > 3
                        ? ` · +${completeness.missingFields.length - 3} lainnya`
                        : "")
                    )}
                  </td>
                  <td className="px-3 py-2 text-xs text-slate-600">
                    {emp.profileUpdatedAt
                      ? formatDateID(emp.profileUpdatedAt)
                      : "Belum pernah"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-slate-500">
        Catatan: fitur pengingat otomatis via email akan ditambahkan di PR
        berikutnya. Sementara ini HR dapat menghubungi pegawai secara manual
        menggunakan daftar di atas.
      </p>
    </div>
  );
}

function Kpi({
  label,
  value,
  tone,
  hint,
}: {
  label: string;
  value: string;
  tone: "slate" | "emerald" | "amber" | "rose";
  hint?: string;
}) {
  const toneCls = {
    slate: "border-slate-200 bg-white",
    emerald: "border-emerald-200 bg-emerald-50",
    amber: "border-amber-200 bg-amber-50",
    rose: "border-rose-200 bg-rose-50",
  }[tone];
  return (
    <div className={`rounded-lg border p-4 ${toneCls}`}>
      <div className="text-xs uppercase tracking-wide text-slate-500">
        {label}
      </div>
      <div className="mt-1 text-2xl font-bold text-slate-900">{value}</div>
      {hint && <div className="text-[11px] text-slate-500">{hint}</div>}
    </div>
  );
}

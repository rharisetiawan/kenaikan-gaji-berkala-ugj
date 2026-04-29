import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatDateID, formatRupiah } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function IncrementsPage() {
  await requireRole(["ADMIN", "HR", "RECTOR", "FOUNDATION"]);
  const records = await prisma.incrementHistory.findMany({
    orderBy: { effectiveDate: "desc" },
    include: { employee: true },
  });
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Riwayat Kenaikan Gaji Berkala</h1>
        <p className="text-sm text-slate-600">
          Seluruh SK Kenaikan Gaji Berkala yang telah diterbitkan oleh Universitas Gajayana.
        </p>
      </div>
      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50">
            <tr>
              <Th>No. SK</Th>
              <Th>Pegawai</Th>
              <Th>Tanggal SK</Th>
              <Th>TMT Berlaku</Th>
              <Th>Gaji Lama</Th>
              <Th>Gaji Baru</Th>
              <Th>Kenaikan</Th>
              <Th>Aksi</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {records.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-6 text-center text-slate-500">
                  Belum ada SK KGB.
                </td>
              </tr>
            ) : (
              records.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50">
                  <td className="px-4 py-2 font-mono text-xs">{r.decreeNumber ?? "-"}</td>
                  <td className="px-4 py-2">
                    <Link href={`/employees/${r.employee.id}`} className="font-medium text-slate-900 hover:underline">
                      {r.employee.fullName}
                    </Link>
                    <div className="text-xs text-slate-500">{r.employee.nip}</div>
                  </td>
                  <td className="px-4 py-2">{formatDateID(r.decreeDate)}</td>
                  <td className="px-4 py-2">{formatDateID(r.effectiveDate)}</td>
                  <td className="px-4 py-2">{formatRupiah(r.previousSalary)}</td>
                  <td className="px-4 py-2">{formatRupiah(r.newSalary)}</td>
                  <td className="px-4 py-2 text-emerald-700">+{formatRupiah(r.incrementAmount)}</td>
                  <td className="px-4 py-2 space-x-3">
                    <Link href={`/increments/${r.id}`} className="text-[var(--brand)] hover:underline">
                      Detail
                    </Link>
                    <Link href={`/api/sk/${r.id}`} target="_blank" className="text-[var(--brand)] hover:underline">
                      PDF
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
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

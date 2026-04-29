import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatDateID, formatRupiah } from "@/lib/format";
import { humanRequestStatus, requestStatusColor } from "@/lib/requests";

export const dynamic = "force-dynamic";

export default async function RectorPage() {
  await requireRole(["RECTOR", "ADMIN"]);
  const [pending, recent] = await Promise.all([
    prisma.incrementRequest.findMany({
      where: { status: "HR_VERIFIED" },
      include: { employee: true },
      orderBy: { hrReviewedAt: "asc" },
    }),
    prisma.incrementRequest.findMany({
      where: { status: { in: ["RECTOR_SIGNED", "FOUNDATION_APPROVED", "ISSUED"] } },
      include: { employee: true },
      orderBy: { updatedAt: "desc" },
      take: 10,
    }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Tanda Tangan Rektor</h1>
        <p className="text-sm text-slate-600">
          Surat Pengantar KGB yang perlu ditandatangani Rektor sebelum diteruskan ke Yayasan.
        </p>
      </div>

      <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 bg-amber-50 px-5 py-3">
          <h2 className="text-base font-semibold text-amber-900">
            Menunggu Tanda Tangan ({pending.length})
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr>
                <Th>Pegawai</Th>
                <Th>Nomor Surat</Th>
                <Th>Tanggal Verifikasi</Th>
                <Th>TMT Proyeksi</Th>
                <Th>Gaji Baru</Th>
                <Th>Aksi</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {pending.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                    Tidak ada Surat Pengantar menunggu tanda tangan.
                  </td>
                </tr>
              ) : (
                pending.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50">
                    <Td className="font-medium">
                      {r.employee.fullName}
                      <div className="text-xs font-normal text-slate-500">{r.employee.nip}</div>
                    </Td>
                    <Td className="font-mono text-xs">{r.coverLetterNumber ?? "-"}</Td>
                    <Td>{r.hrReviewedAt ? formatDateID(r.hrReviewedAt) : "-"}</Td>
                    <Td>{formatDateID(r.projectedEffectiveDate)}</Td>
                    <Td>{formatRupiah(r.projectedNewSalary)}</Td>
                    <Td>
                      <Link
                        href={`/rector/${r.id}`}
                        className="rounded-md bg-[var(--brand)] px-3 py-1 text-xs font-medium text-white hover:bg-[var(--brand-dark)]"
                      >
                        Tinjau &amp; Tanda Tangani
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
        <div className="border-b border-slate-200 px-5 py-3">
          <h2 className="text-base font-semibold text-slate-900">Riwayat Terkini</h2>
        </div>
        {recent.length === 0 ? (
          <p className="px-5 py-6 text-sm text-slate-500">Belum ada riwayat.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {recent.map((r) => (
              <li key={r.id} className="flex items-center justify-between px-5 py-3">
                <div>
                  <Link href={`/rector/${r.id}`} className="font-medium hover:underline">
                    {r.employee.fullName}
                  </Link>
                  <p className="text-xs text-slate-500">
                    {r.coverLetterNumber} ·{" "}
                    {r.rectorSignedAt ? formatDateID(r.rectorSignedAt) : "-"}
                  </p>
                </div>
                <span
                  className={`rounded-full border px-2 py-0.5 text-xs font-medium ${requestStatusColor(r.status)}`}
                >
                  {humanRequestStatus(r.status)}
                </span>
              </li>
            ))}
          </ul>
        )}
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

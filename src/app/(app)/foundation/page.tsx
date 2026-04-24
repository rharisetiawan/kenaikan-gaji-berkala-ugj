import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatDateID, formatRupiah } from "@/lib/format";
import { humanRequestStatus, requestStatusColor } from "@/lib/requests";

export const dynamic = "force-dynamic";

export default async function FoundationPage() {
  await requireRole(["FOUNDATION", "ADMIN"]);

  const [awaitingApproval, readyToIssue, issued] = await Promise.all([
    prisma.incrementRequest.findMany({
      where: { status: "RECTOR_SIGNED" },
      include: { employee: true },
      orderBy: { rectorSignedAt: "asc" },
    }),
    prisma.incrementRequest.findMany({
      where: { status: "FOUNDATION_APPROVED" },
      include: { employee: true },
      orderBy: { foundationReviewedAt: "asc" },
    }),
    prisma.incrementRequest.findMany({
      where: { status: "ISSUED" },
      include: { employee: true },
      orderBy: { issuedAt: "desc" },
      take: 10,
    }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Portal Yayasan</h1>
        <p className="text-sm text-slate-600">
          Tinjau Surat Pengantar dari Rektor, setujui, dan terbitkan SK Kenaikan Gaji Berkala.
        </p>
      </div>

      <Section
        title={`Menunggu Persetujuan Yayasan (${awaitingApproval.length})`}
        tone="amber"
      >
        <RequestTable rows={awaitingApproval} hrefPrefix="/foundation" />
      </Section>

      <Section title={`Siap Diterbitkan SK (${readyToIssue.length})`} tone="sky">
        <RequestTable rows={readyToIssue} hrefPrefix="/foundation" />
      </Section>

      <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-5 py-3">
          <h2 className="text-base font-semibold text-slate-900">
            Riwayat SK Terbit Terbaru ({issued.length})
          </h2>
        </div>
        {issued.length === 0 ? (
          <p className="px-5 py-6 text-sm text-slate-500">Belum ada SK diterbitkan.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {issued.map((r) => (
              <li key={r.id} className="flex items-center justify-between px-5 py-3 text-sm">
                <div>
                  <Link href={`/foundation/${r.id}`} className="font-medium hover:underline">
                    {r.employee.fullName}
                  </Link>
                  <p className="text-xs text-slate-500">
                    SK {r.decreeNumber} · {r.issuedAt ? formatDateID(r.issuedAt) : "-"}
                  </p>
                </div>
                <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${requestStatusColor(r.status)}`}>
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

function Section({
  title,
  tone,
  children,
}: {
  title: string;
  tone: "amber" | "sky";
  children: React.ReactNode;
}) {
  const bg = tone === "amber" ? "bg-amber-50 text-amber-900" : "bg-sky-50 text-sky-900";
  return (
    <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className={`border-b border-slate-200 px-5 py-3 ${bg}`}>
        <h2 className="text-base font-semibold">{title}</h2>
      </div>
      <div className="overflow-x-auto">{children}</div>
    </section>
  );
}

function RequestTable({
  rows,
  hrefPrefix,
}: {
  rows: Array<{
    id: string;
    coverLetterNumber: string | null;
    projectedEffectiveDate: Date;
    projectedNewSalary: number;
    rectorSignedAt: Date | null;
    employee: { fullName: string; nip: string; type: string };
  }>;
  hrefPrefix: string;
}) {
  if (rows.length === 0) {
    return <p className="px-5 py-6 text-sm text-slate-500">Tidak ada antrean.</p>;
  }
  return (
    <table className="min-w-full divide-y divide-slate-200 text-sm">
      <thead className="bg-slate-50">
        <tr>
          <Th>Pegawai</Th>
          <Th>Nomor Surat</Th>
          <Th>Tanggal TTD Rektor</Th>
          <Th>TMT Proyeksi</Th>
          <Th>Gaji Baru</Th>
          <Th>Aksi</Th>
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-100">
        {rows.map((r) => (
          <tr key={r.id} className="hover:bg-slate-50">
            <Td className="font-medium">
              {r.employee.fullName}
              <div className="text-xs font-normal text-slate-500">{r.employee.nip}</div>
            </Td>
            <Td className="font-mono text-xs">{r.coverLetterNumber ?? "-"}</Td>
            <Td>{r.rectorSignedAt ? formatDateID(r.rectorSignedAt) : "-"}</Td>
            <Td>{formatDateID(r.projectedEffectiveDate)}</Td>
            <Td>{formatRupiah(r.projectedNewSalary)}</Td>
            <Td>
              <Link
                href={`${hrefPrefix}/${r.id}`}
                className="rounded-md bg-[var(--brand)] px-3 py-1 text-xs font-medium text-white hover:bg-[var(--brand-dark)]"
              >
                Proses
              </Link>
            </Td>
          </tr>
        ))}
      </tbody>
    </table>
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

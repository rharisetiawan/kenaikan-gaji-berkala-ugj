import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatDateID, formatLongDateID, formatRupiah, terbilangRupiah } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function IncrementDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole(["ADMIN", "HR", "RECTOR", "FOUNDATION"]);
  const { id } = await params;
  const record = await prisma.incrementHistory.findUnique({
    where: { id },
    include: {
      employee: {
        include: {
          dosenDetail: { include: { academicRank: true } },
          staffDetail: { include: { payGrade: true } },
        },
      },
      generatedBy: true,
    },
  });
  if (!record) notFound();
  const emp = record.employee;

  return (
    <div className="space-y-4">
      <div className="text-xs text-slate-500">
        <Link href="/increments" className="hover:underline">Riwayat KGB</Link> / {record.decreeNumber ?? record.id}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-slate-900">Detail SK Kenaikan Gaji Berkala</h1>
        <Link
          href={`/api/sk/${record.id}`}
          target="_blank"
          className="rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-emerald-700"
        >
          Unduh SK (PDF)
        </Link>
      </div>

      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-base font-semibold text-slate-900">Identitas Pegawai</h2>
        <dl className="grid gap-x-6 gap-y-2 text-sm md:grid-cols-2">
          <Row label="Nama" value={emp.fullName} />
          <Row label="NIP" value={emp.nip} />
          <Row label="Jenis Kelamin" value={emp.gender === "MALE" ? "Laki-laki" : "Perempuan"} />
          <Row label="Tanggal Lahir" value={formatDateID(emp.birthDate)} />
          <Row
            label={emp.type === "DOSEN" ? "Jabatan Akademik" : "Golongan"}
            value={
              emp.type === "DOSEN"
                ? emp.dosenDetail?.academicRank.name ?? "-"
                : `${emp.staffDetail?.payGrade.code ?? ""} - ${emp.staffDetail?.payGrade.name ?? ""}`
            }
          />
          <Row
            label={emp.type === "DOSEN" ? "Fakultas / Prodi" : "Unit Kerja"}
            value={
              emp.type === "DOSEN"
                ? `${emp.dosenDetail?.faculty ?? "-"} / ${emp.dosenDetail?.studyProgram ?? "-"}`
                : emp.staffDetail?.unit ?? "-"
            }
          />
        </dl>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-base font-semibold text-slate-900">Data SK</h2>
        <dl className="grid gap-x-6 gap-y-2 text-sm md:grid-cols-2">
          <Row label="Nomor SK" value={record.decreeNumber ?? "-"} />
          <Row label="Tanggal SK" value={formatLongDateID(record.decreeDate)} />
          <Row label="TMT Berlaku" value={formatLongDateID(record.effectiveDate)} />
          <Row label="Status" value={record.status} />
          <Row label="Penandatangan" value={`${record.signedByName ?? "-"} (${record.signedByPosition ?? "-"})`} />
          <Row label="Dihasilkan oleh" value={record.generatedBy?.name ?? "-"} />
        </dl>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-base font-semibold text-slate-900">Perubahan Gaji Pokok</h2>
        <dl className="grid gap-x-6 gap-y-2 text-sm md:grid-cols-2">
          <Row label="Gaji Pokok Lama" value={formatRupiah(record.previousSalary)} />
          <Row label="Gaji Pokok Baru" value={formatRupiah(record.newSalary)} />
          <Row label="Kenaikan" value={`${formatRupiah(record.incrementAmount)}`} />
          <Row label="Terbilang (Gaji Baru)" value={capitalize(terbilangRupiah(record.newSalary))} />
        </dl>
        {record.reason && (
          <p className="mt-3 text-sm text-slate-700"><span className="font-medium">Dasar: </span>{record.reason}</p>
        )}
      </section>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 border-b border-dashed border-slate-100 pb-1">
      <dt className="text-slate-500">{label}</dt>
      <dd className="text-right font-medium text-slate-800">{value}</dd>
    </div>
  );
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

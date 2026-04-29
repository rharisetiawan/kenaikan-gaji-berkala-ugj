import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatRupiah } from "@/lib/format";
import { PayGradeRow } from "./PayGradeRow";
import { AcademicRankRow } from "./AcademicRankRow";
import { NewPayGradeForm } from "./NewPayGradeForm";

export const dynamic = "force-dynamic";

export default async function MasterDataPage() {
  await requireRole(["ADMIN"]);
  const [payGrades, ranks, payGradeUsage, rankUsage] = await Promise.all([
    prisma.payGrade.findMany({ orderBy: { level: "asc" } }),
    prisma.academicRank.findMany({ orderBy: { minServiceYears: "asc" } }),
    prisma.staffDetail.groupBy({
      by: ["payGradeId"],
      _count: { _all: true },
    }),
    prisma.dosenDetail.groupBy({
      by: ["academicRankId"],
      _count: { _all: true },
    }),
  ]);
  const usageByPayGrade = new Map(
    payGradeUsage.map((u) => [u.payGradeId, u._count._all]),
  );
  const usageByRank = new Map(
    rankUsage.map((u) => [u.academicRankId, u._count._all]),
  );

  return (
    <div className="space-y-6">
      <div>
        <div className="text-xs text-slate-500">
          <Link href="/admin" className="hover:underline">Admin</Link> / Tabel Gaji & Pangkat
        </div>
        <h1 className="mt-1 text-2xl font-bold text-slate-900">
          Tabel Gaji Pokok & Tunjangan Fungsional
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Edit nilai gaji pokok per Golongan (Tendik) dan tunjangan
          fungsional per Jabatan Akademik (Dosen). Perubahan langsung
          dipakai oleh perhitungan KGB selanjutnya — riwayat KGB lama
          tidak terpengaruh karena snapshot finansialnya disimpan saat
          pengajuan.
        </p>
      </div>

      <section className="rounded-lg border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-4 py-3">
          <h2 className="text-base font-semibold text-slate-900">
            Golongan Tenaga Kependidikan
          </h2>
          <p className="mt-0.5 text-xs text-slate-600">
            Gaji pokok per golongan (PP referensi). Kode golongan tidak
            bisa diubah agar tidak memutus integritas riwayat.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-600">
              <tr>
                <th className="px-3 py-2">Kode</th>
                <th className="px-3 py-2">Nama</th>
                <th className="px-3 py-2 text-right">Gaji Pokok</th>
                <th className="px-3 py-2 text-right">Level</th>
                <th className="px-3 py-2">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {payGrades.map((g) => (
                <PayGradeRow
                  key={g.id}
                  id={g.id}
                  code={g.code}
                  initialName={g.name}
                  initialBaseSalary={g.baseSalary}
                  initialLevel={g.level}
                />
              ))}
            </tbody>
          </table>
        </div>
        <div className="border-t border-slate-200 px-4 py-3">
          <p className="mb-2 text-xs font-medium text-slate-700">
            Tambah Golongan Baru
          </p>
          <NewPayGradeForm />
        </div>
        <div className="border-t border-slate-200 px-4 py-3 text-xs text-slate-500">
          Total: {payGrades.length} golongan ·{" "}
          {Array.from(usageByPayGrade.values()).reduce((a, b) => a + b, 0)}{" "}
          pegawai terikat. Hapus golongan tidak diizinkan agar referensi
          riwayat tetap utuh.
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-4 py-3">
          <h2 className="text-base font-semibold text-slate-900">
            Jabatan Akademik Dosen
          </h2>
          <p className="mt-0.5 text-xs text-slate-600">
            Tunjangan fungsional per jabatan. Kode jabatan dikunci pada
            enum Prisma (Asisten Ahli / Lektor / Lektor Kepala / Guru
            Besar) — hubungi tim dev jika perlu menambah jabatan baru.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-600">
              <tr>
                <th className="px-3 py-2">Kode</th>
                <th className="px-3 py-2">Nama</th>
                <th className="px-3 py-2 text-right">Min. Masa Kerja (thn)</th>
                <th className="px-3 py-2 text-right">Tunj. Fungsional</th>
                <th className="px-3 py-2">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {ranks.map((r) => (
                <AcademicRankRow
                  key={r.id}
                  id={r.id}
                  code={r.code}
                  initialName={r.name}
                  initialMinServiceYears={r.minServiceYears}
                  initialFunctionalAllowance={r.functionalAllowance}
                />
              ))}
            </tbody>
          </table>
        </div>
        <div className="border-t border-slate-200 px-4 py-3 text-xs text-slate-500">
          Saat ini tunjangan terbesar: {formatRupiah(
            ranks.reduce((m, r) => Math.max(m, r.functionalAllowance), 0),
          )}
          {" · "}
          {Array.from(usageByRank.values()).reduce((a, b) => a + b, 0)} dosen
          terikat ke tabel ini.
        </div>
      </section>
    </div>
  );
}

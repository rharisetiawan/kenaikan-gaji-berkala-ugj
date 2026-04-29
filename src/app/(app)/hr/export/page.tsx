import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function HrExportPage() {
  await requireRole(["HR", "ADMIN"]);

  const [dosenCount, staffCount, certCount, pubCount] = await Promise.all([
    prisma.employee.count({ where: { type: "DOSEN" } }),
    prisma.employee.count({ where: { type: "STAFF" } }),
    prisma.certification.count(),
    prisma.publication.count(),
  ]);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <div className="text-xs text-slate-500">
          <Link href="/dashboard" className="hover:underline">Beranda</Link> / Export BAN-PT
        </div>
        <h1 className="mt-1 text-2xl font-bold text-slate-900">
          Export Data Akreditasi (BAN-PT / LLDikti)
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Unduh berkas Excel (.xlsx) berisi seluruh data pegawai &mdash; termasuk
          sertifikasi dan publikasi &mdash; dalam format yang siap pakai untuk
          laporan akreditasi.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        <Stat label="Dosen" value={dosenCount} />
        <Stat label="Tendik" value={staffCount} />
        <Stat label="Sertifikat" value={certCount} />
        <Stat label="Publikasi" value={pubCount} />
      </div>

      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-900">Isi Berkas Excel</h2>
        <ul className="mt-2 list-disc pl-5 text-sm text-slate-700">
          <li>
            Sheet <b>Dosen</b>: NIDN, Nama, Jabatan Akademik, Fakultas, Prodi,
            Pendidikan Terakhir, NIK, ORCID, Scopus ID, SINTA ID, Google Scholar ID.
          </li>
          <li>
            Sheet <b>Tenaga Kependidikan</b>: NIP, Nama, Unit Kerja, Golongan,
            Pendidikan Terakhir, NIK, Tanggal Lahir, Jenis Kelamin, Status Kerja.
          </li>
          <li>
            Sheet <b>Sertifikasi</b>: per sertifikat &mdash; pemilik, kategori,
            penerbit, nomor, tanggal terbit, tanggal kadaluwarsa, verifikasi.
          </li>
          <li>
            Sheet <b>Publikasi</b>: per publikasi &mdash; pemilik, jenis, judul,
            venue, tahun, DOI, peran penulis, SINTA / Scopus.
          </li>
        </ul>
        <div className="mt-4">
          <a
            href="/api/hr/export/akreditasi.xlsx"
            className="inline-block rounded-md bg-[var(--brand)] px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[var(--brand-dark)]"
          >
            Unduh Excel Akreditasi
          </a>
        </div>
        <p className="mt-2 text-xs text-slate-500">
          Data diambil <i>live</i> saat tombol di atas ditekan &mdash; tidak perlu
          regenerate manual.
        </p>
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
      <div className="text-xs uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-1 text-2xl font-semibold text-slate-900">
        {value.toLocaleString("id-ID")}
      </div>
    </div>
  );
}

import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { formatDateID } from "@/lib/format";
import {
  CERTIFICATION_CATEGORIES,
  daysUntilExpiry,
  expiryStatusClass,
  expiryStatusLabel,
  humanCertificationCategory,
} from "@/lib/hris";
import { createCertificationAction, deleteCertificationAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function SertifikasiPage() {
  const session = await requireUser();
  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    include: {
      employee: {
        include: {
          certifications: { orderBy: [{ issueDate: "desc" }] },
        },
      },
    },
  });

  if (!user?.employee) {
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <h1 className="text-2xl font-bold text-slate-900">Sertifikasi & Pelatihan</h1>
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          Akun Anda belum tertaut dengan data pegawai.
        </div>
      </div>
    );
  }

  const certs = user.employee.certifications;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <div className="text-xs text-slate-500">
          <Link href="/dashboard" className="hover:underline">Beranda</Link> /{" "}
          <Link href="/profile" className="hover:underline">Profil Saya</Link> /
          Sertifikasi &amp; Pelatihan
        </div>
        <h1 className="mt-1 text-2xl font-bold text-slate-900">Sertifikasi &amp; Pelatihan</h1>
        <p className="mt-1 text-sm text-slate-600">
          Catatkan semua sertifikat profesi, pelatihan, dan keahlian yang Anda miliki.
          Data ini digunakan untuk akreditasi BAN-PT dan laporan LLDikti.
        </p>
      </div>

      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold text-slate-900">
          Daftar Sertifikat ({certs.length})
        </h2>
        {certs.length === 0 ? (
          <p className="text-sm text-slate-500">
            Belum ada sertifikat tercatat. Tambahkan sertifikat pertama Anda di bawah.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="py-2 pr-3 font-medium">Nama</th>
                  <th className="py-2 pr-3 font-medium">Kategori</th>
                  <th className="py-2 pr-3 font-medium">Penerbit</th>
                  <th className="py-2 pr-3 font-medium">Tanggal Terbit</th>
                  <th className="py-2 pr-3 font-medium">Status</th>
                  <th className="py-2 pr-3 font-medium">Berkas</th>
                  <th className="py-2 pr-3 font-medium" />
                </tr>
              </thead>
              <tbody>
                {certs.map((c) => {
                  const daysLeft = daysUntilExpiry(c.expiryDate);
                  return (
                    <tr key={c.id} className="border-b border-slate-100 align-top">
                      <td className="py-2 pr-3">
                        <div className="font-medium text-slate-900">{c.name}</div>
                        {c.certificateNumber && (
                          <div className="text-xs text-slate-500">No: {c.certificateNumber}</div>
                        )}
                        {c.notes && (
                          <div className="mt-1 text-xs text-slate-500">{c.notes}</div>
                        )}
                      </td>
                      <td className="py-2 pr-3 text-slate-700">
                        {humanCertificationCategory(c.category)}
                      </td>
                      <td className="py-2 pr-3 text-slate-700">{c.issuer}</td>
                      <td className="py-2 pr-3 text-slate-700">{formatDateID(c.issueDate)}</td>
                      <td className="py-2 pr-3">
                        <span
                          className={`inline-block rounded-full px-2 py-0.5 text-xs ${expiryStatusClass(
                            daysLeft,
                          )}`}
                        >
                          {expiryStatusLabel(daysLeft)}
                        </span>
                      </td>
                      <td className="py-2 pr-3">
                        {c.filePath ? (
                          <a
                            href={`/api/certifications/${c.id}/file`}
                            className="text-xs text-[var(--brand)] hover:underline"
                            target="_blank"
                            rel="noreferrer"
                          >
                            {c.fileName ?? "Unduh"}
                          </a>
                        ) : (
                          <span className="text-xs text-slate-400">—</span>
                        )}
                      </td>
                      <td className="py-2 pr-3">
                        <form action={deleteCertificationAction}>
                          <input type="hidden" name="id" value={c.id} />
                          <button
                            type="submit"
                            className="text-xs text-rose-600 hover:underline"
                          >
                            Hapus
                          </button>
                        </form>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold text-slate-900">Tambah Sertifikat</h2>
        <form action={createCertificationAction} className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label htmlFor="name" className="block text-xs font-medium text-slate-700">
              Nama Sertifikat <span className="text-rose-600">*</span>
            </label>
            <input
              id="name"
              name="name"
              required
              maxLength={200}
              className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="Sertifikasi Dosen Profesional"
            />
          </div>
          <div>
            <label htmlFor="category" className="block text-xs font-medium text-slate-700">
              Kategori <span className="text-rose-600">*</span>
            </label>
            <select
              id="category"
              name="category"
              required
              className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              defaultValue="PELATIHAN"
            >
              {CERTIFICATION_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {humanCertificationCategory(c)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="issuer" className="block text-xs font-medium text-slate-700">
              Penerbit <span className="text-rose-600">*</span>
            </label>
            <input
              id="issuer"
              name="issuer"
              required
              maxLength={200}
              className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="Kementerian Pendidikan"
            />
          </div>
          <div>
            <label htmlFor="certificateNumber" className="block text-xs font-medium text-slate-700">
              Nomor Sertifikat
            </label>
            <input
              id="certificateNumber"
              name="certificateNumber"
              maxLength={100}
              className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="Opsional"
            />
          </div>
          <div>
            <label htmlFor="issueDate" className="block text-xs font-medium text-slate-700">
              Tanggal Terbit <span className="text-rose-600">*</span>
            </label>
            <input
              id="issueDate"
              name="issueDate"
              type="date"
              required
              className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <div>
            <label htmlFor="expiryDate" className="block text-xs font-medium text-slate-700">
              Tanggal Kadaluwarsa
            </label>
            <input
              id="expiryDate"
              name="expiryDate"
              type="date"
              className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <p className="mt-1 text-xs text-slate-500">Kosongkan jika tidak kadaluwarsa.</p>
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="notes" className="block text-xs font-medium text-slate-700">
              Catatan
            </label>
            <textarea
              id="notes"
              name="notes"
              rows={2}
              maxLength={500}
              className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="Opsional"
            />
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="file" className="block text-xs font-medium text-slate-700">
              Unggah Berkas Sertifikat
            </label>
            <input
              id="file"
              name="file"
              type="file"
              accept=".pdf,.png,.jpg,.jpeg,.webp"
              className="mt-1 block w-full rounded-md border border-slate-300 text-sm file:mr-3 file:rounded file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-slate-700 hover:file:bg-slate-200"
            />
            <p className="mt-1 text-xs text-slate-500">
              Opsional. Format: PDF/JPG/PNG, maksimum 25 MB.
            </p>
          </div>
          <div className="sm:col-span-2 flex justify-end">
            <button
              type="submit"
              className="rounded-md bg-[var(--brand)] px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[var(--brand-dark)]"
            >
              Simpan Sertifikat
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

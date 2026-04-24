import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import {
  AUTHOR_ROLES,
  PUBLICATION_KINDS,
  SCOPUS_QUARTILES,
  SINTA_RANKS,
  humanAuthorRole,
  humanPublicationKind,
} from "@/lib/hris";
import { createPublicationAction, deletePublicationAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function PublikasiPage() {
  const session = await requireUser();
  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    include: {
      employee: {
        include: {
          dosenDetail: {
            include: {
              publications: { orderBy: [{ year: "desc" }, { createdAt: "desc" }] },
            },
          },
        },
      },
    },
  });

  if (!user?.employee) {
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <h1 className="text-2xl font-bold text-slate-900">Publikasi</h1>
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          Akun Anda belum tertaut dengan data pegawai.
        </div>
      </div>
    );
  }

  if (!user.employee.dosenDetail) {
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <div className="text-xs text-slate-500">
          <Link href="/dashboard" className="hover:underline">Beranda</Link> /{" "}
          <Link href="/profile" className="hover:underline">Profil Saya</Link> / Publikasi
        </div>
        <h1 className="text-2xl font-bold text-slate-900">Publikasi</h1>
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          Halaman Publikasi hanya tersedia untuk <b>Dosen</b>.
        </div>
      </div>
    );
  }

  const pubs = user.employee.dosenDetail.publications;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <div className="text-xs text-slate-500">
          <Link href="/dashboard" className="hover:underline">Beranda</Link> /{" "}
          <Link href="/profile" className="hover:underline">Profil Saya</Link> / Publikasi
        </div>
        <h1 className="mt-1 text-2xl font-bold text-slate-900">Publikasi</h1>
        <p className="mt-1 text-sm text-slate-600">
          Daftar karya ilmiah, artikel jurnal, prosiding, buku, dan HKI Anda.
          Digunakan untuk akreditasi prodi, laporan SINTA, dan BKD.
        </p>
      </div>

      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold text-slate-900">
          Daftar Publikasi ({pubs.length})
        </h2>
        {pubs.length === 0 ? (
          <p className="text-sm text-slate-500">
            Belum ada publikasi tercatat. Tambahkan publikasi pertama Anda di bawah.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="py-2 pr-3 font-medium">Judul</th>
                  <th className="py-2 pr-3 font-medium">Jenis</th>
                  <th className="py-2 pr-3 font-medium">Venue</th>
                  <th className="py-2 pr-3 font-medium">Tahun</th>
                  <th className="py-2 pr-3 font-medium">Peran</th>
                  <th className="py-2 pr-3 font-medium">Peringkat</th>
                  <th className="py-2 pr-3 font-medium" />
                </tr>
              </thead>
              <tbody>
                {pubs.map((p) => (
                  <tr key={p.id} className="border-b border-slate-100 align-top">
                    <td className="py-2 pr-3">
                      <div className="font-medium text-slate-900">{p.title}</div>
                      {p.doi && (
                        <div className="text-xs text-slate-500">
                          DOI:{" "}
                          <a
                            href={`https://doi.org/${p.doi}`}
                            target="_blank"
                            rel="noreferrer"
                            className="text-[var(--brand)] hover:underline"
                          >
                            {p.doi}
                          </a>
                        </div>
                      )}
                      {p.url && !p.doi && (
                        <a
                          href={p.url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs text-[var(--brand)] hover:underline"
                        >
                          Tautan
                        </a>
                      )}
                      {p.coauthors && (
                        <div className="mt-1 text-xs text-slate-500">
                          Co-author: {p.coauthors}
                        </div>
                      )}
                    </td>
                    <td className="py-2 pr-3 text-slate-700">{humanPublicationKind(p.kind)}</td>
                    <td className="py-2 pr-3 text-slate-700">{p.venue}</td>
                    <td className="py-2 pr-3 text-slate-700">{p.year}</td>
                    <td className="py-2 pr-3 text-slate-700">{humanAuthorRole(p.authorRole)}</td>
                    <td className="py-2 pr-3 text-slate-700">
                      {p.sintaRank ?? p.scopusQuartile ?? "—"}
                    </td>
                    <td className="py-2 pr-3">
                      <form action={deletePublicationAction}>
                        <input type="hidden" name="id" value={p.id} />
                        <button
                          type="submit"
                          className="text-xs text-rose-600 hover:underline"
                        >
                          Hapus
                        </button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold text-slate-900">Tambah Publikasi</h2>
        <form action={createPublicationAction} className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label htmlFor="title" className="block text-xs font-medium text-slate-700">
              Judul <span className="text-rose-600">*</span>
            </label>
            <input
              id="title"
              name="title"
              required
              maxLength={300}
              className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <div>
            <label htmlFor="kind" className="block text-xs font-medium text-slate-700">
              Jenis <span className="text-rose-600">*</span>
            </label>
            <select
              id="kind"
              name="kind"
              required
              className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              defaultValue="JURNAL_NASIONAL"
            >
              {PUBLICATION_KINDS.map((k) => (
                <option key={k} value={k}>
                  {humanPublicationKind(k)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="year" className="block text-xs font-medium text-slate-700">
              Tahun <span className="text-rose-600">*</span>
            </label>
            <input
              id="year"
              name="year"
              type="number"
              min={1950}
              max={new Date().getFullYear() + 1}
              required
              defaultValue={new Date().getFullYear()}
              className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="venue" className="block text-xs font-medium text-slate-700">
              Nama Jurnal / Prosiding / Penerbit <span className="text-rose-600">*</span>
            </label>
            <input
              id="venue"
              name="venue"
              required
              maxLength={300}
              className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <div>
            <label htmlFor="doi" className="block text-xs font-medium text-slate-700">
              DOI
            </label>
            <input
              id="doi"
              name="doi"
              maxLength={200}
              className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="10.1234/abc.2025.01"
            />
          </div>
          <div>
            <label htmlFor="url" className="block text-xs font-medium text-slate-700">
              URL
            </label>
            <input
              id="url"
              name="url"
              type="url"
              maxLength={500}
              className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <div>
            <label htmlFor="authorRole" className="block text-xs font-medium text-slate-700">
              Peran Penulis <span className="text-rose-600">*</span>
            </label>
            <select
              id="authorRole"
              name="authorRole"
              required
              className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              defaultValue="FIRST_AUTHOR"
            >
              {AUTHOR_ROLES.map((r) => (
                <option key={r} value={r}>
                  {humanAuthorRole(r)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="sintaRank" className="block text-xs font-medium text-slate-700">
              Peringkat SINTA (jurnal terakreditasi)
            </label>
            <select
              id="sintaRank"
              name="sintaRank"
              className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              defaultValue=""
            >
              <option value="">— Tidak berlaku —</option>
              {SINTA_RANKS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="scopusQuartile" className="block text-xs font-medium text-slate-700">
              Kuartil Scopus (jurnal bereputasi)
            </label>
            <select
              id="scopusQuartile"
              name="scopusQuartile"
              className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              defaultValue=""
            >
              <option value="">— Tidak berlaku —</option>
              {SCOPUS_QUARTILES.map((q) => (
                <option key={q} value={q}>
                  {q}
                </option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="coauthors" className="block text-xs font-medium text-slate-700">
              Co-author (pisahkan dengan koma)
            </label>
            <input
              id="coauthors"
              name="coauthors"
              maxLength={500}
              className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="Opsional"
            />
          </div>
          <div className="sm:col-span-2 flex justify-end">
            <button
              type="submit"
              className="rounded-md bg-[var(--brand)] px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[var(--brand-dark)]"
            >
              Simpan Publikasi
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

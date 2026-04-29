import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { formatDateID } from "@/lib/format";

export const dynamic = "force-dynamic";

/**
 * Placeholder "Rumah" Perbaruan Kontrak for KONTRAK / HONORER employees.
 *
 * KGB does not apply to these employees, so their self-service hub lives
 * here instead of /my-requests. Actual renewal workflow (upload kontrak
 * baru, tracking masa berlaku, persetujuan Rektor, dsb.) will be built
 * in a future PR — this page is intentionally a stub so the role has a
 * dashboard of its own from day one.
 */
export default async function KontrakPage() {
  const session = await requireUser();

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    include: {
      employee: {
        include: {
          staffDetail: { include: { payGrade: true } },
          dosenDetail: { include: { academicRank: true } },
        },
      },
    },
  });

  if (!user?.employee) {
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <h1 className="text-2xl font-bold text-slate-900">
          Perbaruan Kontrak
        </h1>
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          Akun Anda belum tertaut dengan data pegawai. Hubungi Bagian
          Kepegawaian.
        </div>
      </div>
    );
  }

  const emp = user.employee;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <div className="text-xs text-slate-500">
          <Link href="/dashboard" className="hover:underline">Beranda</Link> /
          Perbaruan Kontrak
        </div>
        <h1 className="mt-1 text-2xl font-bold text-slate-900">
          Perbaruan Kontrak
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Halaman ini khusus untuk pegawai dengan status hubungan kerja{" "}
          <span className="font-medium">Kontrak</span> atau{" "}
          <span className="font-medium">Honorer</span>.
        </p>
      </div>

      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-slate-900">
          Informasi Kontrak Anda
        </h2>
        <dl className="mt-3 grid grid-cols-1 gap-x-6 gap-y-2 text-sm md:grid-cols-2">
          <div>
            <dt className="text-xs text-slate-500">Nama</dt>
            <dd className="font-medium text-slate-900">{emp.fullName}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">NIP / NIS</dt>
            <dd className="font-mono text-slate-900">{emp.nip}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">Status Hubungan Kerja</dt>
            <dd className="text-slate-900">{emp.employmentStatus}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">TMT Kontrak</dt>
            <dd className="text-slate-900">{formatDateID(emp.hireDate)}</dd>
          </div>
          {emp.type === "STAFF" && emp.staffDetail && (
            <>
              <div>
                <dt className="text-xs text-slate-500">Unit Kerja</dt>
                <dd className="text-slate-900">{emp.staffDetail.unit}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Jabatan</dt>
                <dd className="text-slate-900">{emp.staffDetail.position}</dd>
              </div>
            </>
          )}
          {emp.type === "DOSEN" && emp.dosenDetail && (
            <>
              <div>
                <dt className="text-xs text-slate-500">Fakultas</dt>
                <dd className="text-slate-900">{emp.dosenDetail.faculty}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Program Studi</dt>
                <dd className="text-slate-900">
                  {emp.dosenDetail.studyProgram}
                </dd>
              </div>
            </>
          )}
        </dl>
      </section>

      <section className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-6 text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-200 text-xl">
          🏗️
        </div>
        <h2 className="text-sm font-semibold text-slate-900">
          Modul Perbaruan Kontrak sedang disiapkan
        </h2>
        <p className="mx-auto mt-1 max-w-md text-sm text-slate-600">
          Nanti di halaman ini Anda dapat mengunggah draf kontrak baru,
          memantau masa berlaku kontrak yang sedang berjalan, dan menerima
          notifikasi saat kontrak Anda mendekati masa habis. Sementara itu,
          silakan hubungi Bagian Kepegawaian untuk urusan kontrak.
        </p>
        <p className="mt-3 text-xs text-slate-500">
          Anda tetap dapat memperbarui data pribadi Anda di halaman{" "}
          <Link
            href="/profile"
            className="font-medium text-[var(--brand)] hover:underline"
          >
            Profil Saya
          </Link>
          .
        </p>
      </section>
    </div>
  );
}

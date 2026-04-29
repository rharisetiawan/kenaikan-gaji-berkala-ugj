import Link from "next/link";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function AdminOverviewPage() {
  const [userCount, activeUserCount, employeeCount, officialCount] =
    await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { isActive: true } }),
      prisma.employee.count(),
      prisma.orgOfficial.count(),
    ]);

  const cards: Array<{
    href: string;
    title: string;
    desc: string;
    stat: string;
  }> = [
    {
      href: "/admin/pegawai/baru",
      title: "Tambah Pegawai",
      desc: "Buat data pegawai baru beserta akun login awal.",
      stat: `${employeeCount} pegawai terdaftar`,
    },
    {
      href: "/admin/users",
      title: "Akun Pengguna",
      desc: "Reset kata sandi, ubah peran, aktifkan/nonaktifkan akun.",
      stat: `${activeUserCount} aktif / ${userCount} total`,
    },
    {
      href: "/admin/pejabat",
      title: "Pejabat",
      desc: "Atur nama Rektor & Ketua Yayasan yang tercetak di surat.",
      stat: `${officialCount} pejabat terisi`,
    },
    {
      href: "/admin/pengaturan",
      title: "Pengaturan",
      desc: "Kop surat PDF dan aturan KGB (persen kenaikan, ambang kinerja, BKD).",
      stat: "Berlaku global",
    },
  ];

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-slate-900">Panel Administrator</h1>
      <p className="text-sm text-slate-600">
        Menu khusus untuk hak akses tertinggi. Gunakan dengan hati-hati.
      </p>
      <div className="grid gap-3 md:grid-cols-3">
        {cards.map((c) => (
          <Link
            key={c.href}
            href={c.href}
            className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm transition hover:border-rose-300 hover:shadow"
          >
            <div className="text-sm font-semibold text-slate-900">{c.title}</div>
            <div className="mt-1 text-xs text-slate-600">{c.desc}</div>
            <div className="mt-3 text-xs font-medium text-rose-700">{c.stat}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}

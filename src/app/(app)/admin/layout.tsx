import Link from "next/link";
import { requireRole } from "@/lib/auth";

/**
 * All pages under /admin/* require ADMIN. Children render inside a shared
 * sub-nav so Rektor/Yayasan/HR users who accidentally reach an admin URL
 * land on /dashboard instead (requireRole redirects on mismatch).
 */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireRole(["ADMIN"]);

  const sections: Array<{ href: string; label: string; blurb: string }> = [
    {
      href: "/admin",
      label: "Ringkasan",
      blurb: "Pusat administrasi sistem",
    },
    {
      href: "/admin/pegawai/baru",
      label: "Tambah Pegawai",
      blurb: "Buat data pegawai + akun baru",
    },
    {
      href: "/admin/users",
      label: "Akun Pengguna",
      blurb: "Reset kata sandi, ubah peran, aktifkan/nonaktifkan",
    },
    {
      href: "/admin/pejabat",
      label: "Pejabat",
      blurb: "Nama Rektor & Ketua Yayasan di surat",
    },
  ];

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
        <div className="font-semibold">Area Administrator</div>
        <div className="text-xs">
          Perubahan di halaman ini berdampak pada seluruh sistem. Pastikan Anda
          login sebagai ADMIN dengan alasan yang jelas.
        </div>
      </div>

      <nav className="flex flex-wrap gap-2 text-sm">
        {sections.map((s) => (
          <Link
            key={s.href}
            href={s.href}
            className="rounded-md border border-slate-300 bg-white px-3 py-1.5 font-medium text-slate-700 hover:border-rose-400 hover:text-rose-700"
          >
            {s.label}
          </Link>
        ))}
      </nav>

      {children}
    </div>
  );
}

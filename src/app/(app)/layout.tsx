import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { logoutAction } from "@/app/login/actions";
import { NavLink } from "./NavLink";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();

  return (
    <div className="flex min-h-screen flex-col">
      <header className="bg-[var(--brand)] text-white shadow">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
          <Link href="/dashboard" className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-[var(--brand)] font-bold">
              UG
            </div>
            <div className="leading-tight">
              <div className="text-sm font-semibold">SIM KGB</div>
              <div className="text-xs text-blue-100">Universitas Gajayana</div>
            </div>
          </Link>
          <nav className="flex items-center gap-1 text-sm">
            <NavLink href="/dashboard">Beranda</NavLink>
            <NavLink href="/employees">Data Pegawai</NavLink>
            <NavLink href="/evaluations">Evaluasi</NavLink>
            <NavLink href="/increments">Riwayat KGB</NavLink>
          </nav>
          <form action={logoutAction} className="flex items-center gap-3">
            <div className="text-right text-xs">
              <div className="font-medium">{user.name}</div>
              <div className="text-blue-100">{user.role}</div>
            </div>
            <button
              type="submit"
              className="rounded-md border border-white/30 px-3 py-1.5 text-xs font-medium hover:bg-white/10"
            >
              Keluar
            </button>
          </form>
        </div>
      </header>
      <main className="flex-1">
        <div className="mx-auto max-w-7xl px-4 py-6">{children}</div>
      </main>
      <footer className="border-t border-slate-200 bg-white py-4 text-center text-xs text-slate-500">
        © {new Date().getFullYear()} Biro Sumber Daya Manusia - Universitas Gajayana Malang
      </footer>
    </div>
  );
}

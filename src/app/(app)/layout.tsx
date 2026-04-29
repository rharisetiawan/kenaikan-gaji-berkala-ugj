import Image from "next/image";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { logoutAction } from "@/app/login/actions";
import { Sidebar } from "./Sidebar";
import type { UserRole } from "@prisma/client";

function humanRole(role: UserRole): string {
  switch (role) {
    case "ADMIN":
      return "Administrator";
    case "HR":
      return "Bagian Kepegawaian";
    case "RECTOR":
      return "Rektor";
    case "FOUNDATION":
      return "Yayasan";
    case "EMPLOYEE":
      return "Pegawai";
  }
}

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 bg-[var(--brand)] text-white shadow">
          <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 pl-16 lg:pl-4">
            <Link href="/dashboard" className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white p-0.5 shadow-sm">
                <Image
                  src="/brand/uniga-logo.png"
                  alt="Logo Universitas Gajayana Malang"
                  width={36}
                  height={36}
                  className="h-9 w-9 object-contain"
                />
              </div>
              <div className="leading-tight">
                <div className="text-sm font-semibold">SIM KGB</div>
                <div className="text-xs text-blue-100">
                  Universitas Gajayana Malang
                </div>
              </div>
            </Link>
            <form action={logoutAction} className="flex items-center gap-3">
              <div className="text-right text-xs">
                <div className="font-medium">{user.name}</div>
                <div className="text-blue-100">{humanRole(user.role)}</div>
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
          © {new Date().getFullYear()} Universitas Gajayana Malang · Powered by www.weverx.com
        </footer>
      </div>
    </div>
  );
}

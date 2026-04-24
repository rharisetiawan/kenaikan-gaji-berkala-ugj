import Image from "next/image";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { logoutAction } from "@/app/login/actions";
import { prisma } from "@/lib/prisma";
import { NavLink } from "./NavLink";
import type { UserRole } from "@prisma/client";

interface NavItem {
  href: string;
  label: string;
  roles: UserRole[];
  // Optional predicate that must also be true for this link to appear.
  // Used e.g. to surface the KGB link only for TETAP employees and the
  // Kontrak link only for KONTRAK / HONORER employees.
  showIf?: (ctx: { employmentStatus: string | null }) => boolean;
}

const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Beranda", roles: ["ADMIN", "HR", "RECTOR", "FOUNDATION", "EMPLOYEE"] },
  {
    href: "/my-requests",
    label: "Pengajuan KGB Saya",
    roles: ["EMPLOYEE", "ADMIN"],
    showIf: ({ employmentStatus }) =>
      employmentStatus === null || employmentStatus === "TETAP",
  },
  {
    href: "/kontrak",
    label: "Perbaruan Kontrak",
    roles: ["EMPLOYEE", "ADMIN"],
    showIf: ({ employmentStatus }) =>
      employmentStatus === "KONTRAK" || employmentStatus === "HONORER",
  },
  { href: "/hr", label: "Verifikasi Kepegawaian", roles: ["HR", "ADMIN"] },
  { href: "/hr/kelengkapan", label: "Kelengkapan Data", roles: ["HR", "ADMIN"] },
  { href: "/rector", label: "Tanda Tangan Rektor", roles: ["RECTOR", "ADMIN"] },
  { href: "/foundation", label: "Persetujuan Yayasan", roles: ["FOUNDATION", "ADMIN"] },
  { href: "/employees", label: "Data Pegawai", roles: ["HR", "ADMIN"] },
  { href: "/evaluations", label: "Evaluasi", roles: ["HR", "ADMIN"] },
  { href: "/increments", label: "Riwayat KGB", roles: ["HR", "ADMIN", "RECTOR", "FOUNDATION"] },
  {
    href: "/profile",
    label: "Profil Saya",
    roles: ["ADMIN", "HR", "RECTOR", "FOUNDATION", "EMPLOYEE"],
  },
];

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

  // Look up the employee's employmentStatus once per request so we can hide
  // role-appropriate-but-status-inappropriate links (KGB vs. Kontrak).
  // HR / RECTOR / FOUNDATION / ADMIN accounts often have no Employee row
  // attached, in which case we pass null and keep default visibility.
  let employmentStatus: string | null = null;
  if (user.role === "EMPLOYEE") {
    const dbUser = await prisma.user.findUnique({
      where: { id: user.userId },
      select: { employee: { select: { employmentStatus: true } } },
    });
    employmentStatus = dbUser?.employee?.employmentStatus ?? null;
  }

  const visibleNav = NAV_ITEMS.filter((item) => {
    if (!item.roles.includes(user.role)) return false;
    if (item.showIf && !item.showIf({ employmentStatus })) return false;
    return true;
  });

  return (
    <div className="flex min-h-screen flex-col">
      <header className="bg-[var(--brand)] text-white shadow">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <Link href="/dashboard" className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-white p-0.5 shadow-sm">
              <Image
                src="/brand/uniga-logo.png"
                alt="Logo Universitas Gajayana Malang"
                width={40}
                height={40}
                className="h-10 w-10 object-contain"
              />
            </div>
            <div className="leading-tight">
              <div className="text-sm font-semibold">SIM KGB</div>
              <div className="text-xs text-blue-100">Universitas Gajayana Malang</div>
            </div>
          </Link>
          <nav className="order-3 flex w-full flex-wrap items-center gap-1 text-sm lg:order-2 lg:w-auto">
            {visibleNav.map((item) => (
              <NavLink key={item.href} href={item.href}>
                {item.label}
              </NavLink>
            ))}
          </nav>
          <form action={logoutAction} className="order-2 flex items-center gap-3 lg:order-3">
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
        © {new Date().getFullYear()} Bagian Kepegawaian · Universitas Gajayana Malang ·
        www.unigamalang.ac.id
      </footer>
    </div>
  );
}

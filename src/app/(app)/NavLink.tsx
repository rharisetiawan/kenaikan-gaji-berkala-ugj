"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  const pathname = usePathname();
  const active = pathname === href || pathname.startsWith(href + "/");
  return (
    <Link
      href={href}
      className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
        active ? "bg-white/15 text-white" : "text-blue-100 hover:bg-white/10"
      }`}
    >
      {children}
    </Link>
  );
}

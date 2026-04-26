"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useSyncExternalStore } from "react";
import {
  Home,
  FileText,
  FileClock,
  ClipboardCheck,
  Stamp,
  Building2,
  Users,
  User,
  Award,
  BookOpen,
  ListChecks,
  BarChart3,
  FileSpreadsheet,
  History,
  Shield,
  UserPlus,
  UserCog,
  Crown,
  Settings,
  ChevronDown,
  Menu,
  X,
} from "lucide-react";
import type { ResolvedNavGroup, ResolvedNavItem } from "./Sidebar";
import type { IconName } from "./nav-config";

const ICONS: Record<IconName, React.ComponentType<{ className?: string }>> = {
  Home,
  FileText,
  FileClock,
  ClipboardCheck,
  Stamp,
  Building2,
  Users,
  User,
  Award,
  BookOpen,
  ListChecks,
  BarChart3,
  FileSpreadsheet,
  History,
  Shield,
  UserPlus,
  UserCog,
  Crown,
  Settings,
};

const STORAGE_PREFIX = "kgb-sidebar-group:";

function isPathActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(href + "/");
}

const subscribeStorage = (cb: () => void) => {
  if (typeof window === "undefined") return () => {};
  window.addEventListener("storage", cb);
  return () => window.removeEventListener("storage", cb);
};

function useGroupOpen(groupId: string, defaultOpen: boolean): {
  isOpen: boolean;
  toggle: () => void;
} {
  const key = STORAGE_PREFIX + groupId;
  const stored = useSyncExternalStore(
    subscribeStorage,
    () => window.localStorage.getItem(key),
    () => null,
  );
  const isOpen = stored === "1" ? true : stored === "0" ? false : defaultOpen;
  const toggle = () => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(key, isOpen ? "0" : "1");
    // useSyncExternalStore only listens for `storage` events from OTHER
    // tabs; same-tab writes need a manual dispatch to wake the store.
    window.dispatchEvent(new StorageEvent("storage", { key }));
  };
  return { isOpen, toggle };
}

interface SidebarClientProps {
  groups: ResolvedNavGroup[];
}

export function SidebarClient({ groups }: SidebarClientProps) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const closeDrawer = () => setMobileOpen(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setMobileOpen((v) => !v)}
        className="fixed left-3 top-3 z-40 inline-flex items-center justify-center rounded-md border border-white/30 bg-[var(--brand)] p-2 text-white shadow lg:hidden"
        aria-label={mobileOpen ? "Tutup menu" : "Buka menu"}
      >
        {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </button>

      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/40 lg:hidden"
          onClick={closeDrawer}
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-30 w-64 transform overflow-y-auto border-r border-slate-200 bg-white pb-6 pt-4 shadow-sm transition-transform duration-200 lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 lg:shadow-none ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <nav className="flex flex-col gap-1 px-3">
          {groups.map((group) =>
            group.items.length === 1 ? (
              <FlatLink
                key={group.id}
                item={group.items[0]}
                pathname={pathname}
                onNavigate={closeDrawer}
              />
            ) : (
              <NavGroupBlock
                key={group.id}
                group={group}
                pathname={pathname}
                onNavigate={closeDrawer}
              />
            ),
          )}
        </nav>
      </aside>
    </>
  );
}

function NavGroupBlock({
  group,
  pathname,
  onNavigate,
}: {
  group: ResolvedNavGroup;
  pathname: string;
  onNavigate: () => void;
}) {
  const containsActive = group.items.some((item) =>
    isPathActive(pathname, item.href),
  );

  const { isOpen: storedOpen, toggle } = useGroupOpen(group.id, containsActive);

  const Icon = ICONS[group.icon];
  // Keep the user's current location visible: even if they manually
  // collapsed this group, we still expand it whenever it contains the
  // active route.
  const isOpen = storedOpen || containsActive;

  return (
    <div className="mt-1">
      <button
        type="button"
        onClick={toggle}
        className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs font-semibold uppercase tracking-wide transition ${
          containsActive
            ? "text-[var(--brand)]"
            : "text-slate-500 hover:bg-slate-100"
        }`}
        aria-expanded={isOpen}
      >
        <Icon className="h-4 w-4" />
        <span className="flex-1">{group.label}</span>
        <ChevronDown
          className={`h-4 w-4 transition-transform ${isOpen ? "" : "-rotate-90"}`}
        />
      </button>
      {isOpen && (
        <div className="mt-1 flex flex-col gap-0.5">
          {group.items.map((item) => (
            <SubLink
              key={item.href}
              item={item}
              pathname={pathname}
              onNavigate={onNavigate}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function FlatLink({
  item,
  pathname,
  onNavigate,
}: {
  item: ResolvedNavItem;
  pathname: string;
  onNavigate: () => void;
}) {
  const active = isPathActive(pathname, item.href);
  const Icon = ICONS[item.icon];
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      className={`mt-1 flex items-center gap-2 rounded-md px-2 py-2 text-sm font-medium transition ${
        active
          ? "bg-[var(--brand)] text-white"
          : "text-slate-700 hover:bg-slate-100"
      }`}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span>{item.label}</span>
    </Link>
  );
}

function SubLink({
  item,
  pathname,
  onNavigate,
}: {
  item: ResolvedNavItem;
  pathname: string;
  onNavigate: () => void;
}) {
  const active = isPathActive(pathname, item.href);
  const Icon = ICONS[item.icon];
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      className={`flex items-center gap-2 rounded-md py-1.5 pl-8 pr-2 text-sm transition ${
        active
          ? "bg-blue-50 font-medium text-[var(--brand)]"
          : "text-slate-700 hover:bg-slate-100"
      }`}
    >
      <Icon className="h-3.5 w-3.5 shrink-0 opacity-70" />
      <span>{item.label}</span>
    </Link>
  );
}

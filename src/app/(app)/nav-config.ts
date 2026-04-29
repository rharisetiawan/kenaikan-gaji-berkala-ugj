import type { UserRole } from "@prisma/client";

/**
 * Icon names from lucide-react. Strings only — actual components are
 * resolved on the client to keep this module RSC-safe.
 */
export type IconName =
  | "Home"
  | "FileText"
  | "FileClock"
  | "ClipboardCheck"
  | "Stamp"
  | "Building2"
  | "Users"
  | "User"
  | "Award"
  | "BookOpen"
  | "ListChecks"
  | "BarChart3"
  | "FileSpreadsheet"
  | "History"
  | "Shield"
  | "UserPlus"
  | "UserCog"
  | "Crown"
  | "DatabaseZap"
  | "Settings";

export interface NavItem {
  href: string;
  label: string;
  icon: IconName;
  roles: UserRole[];
  showIf?: (ctx: { employmentStatus: string | null }) => boolean;
}

export interface NavGroup {
  id: string; // localStorage key suffix
  label: string;
  icon: IconName;
  items: NavItem[];
}

export const NAV_GROUPS: NavGroup[] = [
  {
    id: "beranda",
    label: "Beranda",
    icon: "Home",
    items: [
      {
        href: "/dashboard",
        label: "Dashboard",
        icon: "Home",
        roles: ["ADMIN", "HR", "RECTOR", "FOUNDATION", "EMPLOYEE"],
      },
    ],
  },
  {
    id: "kgb",
    label: "Kenaikan Gaji Berkala",
    icon: "FileText",
    items: [
      {
        href: "/my-requests",
        label: "Pengajuan KGB Saya",
        icon: "FileText",
        roles: ["EMPLOYEE", "ADMIN"],
        showIf: ({ employmentStatus }) =>
          employmentStatus === null || employmentStatus === "TETAP",
      },
      {
        href: "/kontrak",
        label: "Perbaruan Kontrak",
        icon: "FileClock",
        roles: ["EMPLOYEE", "ADMIN"],
        showIf: ({ employmentStatus }) =>
          employmentStatus === null ||
          employmentStatus === "KONTRAK" ||
          employmentStatus === "HONORER",
      },
      {
        href: "/hr",
        label: "Verifikasi Kepegawaian",
        icon: "ClipboardCheck",
        roles: ["HR", "ADMIN"],
      },
      {
        href: "/rector",
        label: "Tanda Tangan Rektor",
        icon: "Stamp",
        roles: ["RECTOR", "ADMIN"],
      },
      {
        href: "/foundation",
        label: "Persetujuan Yayasan",
        icon: "Building2",
        roles: ["FOUNDATION", "ADMIN"],
      },
      {
        href: "/increments",
        label: "Riwayat KGB",
        icon: "History",
        roles: ["HR", "ADMIN", "RECTOR", "FOUNDATION"],
      },
    ],
  },
  {
    id: "hris",
    label: "Profil & HRIS",
    icon: "Users",
    items: [
      {
        href: "/profile",
        label: "Profil Saya",
        icon: "User",
        roles: ["ADMIN", "HR", "RECTOR", "FOUNDATION", "EMPLOYEE"],
      },
      {
        href: "/profile/sertifikasi",
        label: "Sertifikasi",
        icon: "Award",
        roles: ["ADMIN", "HR", "RECTOR", "FOUNDATION", "EMPLOYEE"],
      },
      {
        href: "/profile/publikasi",
        label: "Publikasi",
        icon: "BookOpen",
        roles: ["ADMIN", "HR", "RECTOR", "FOUNDATION", "EMPLOYEE"],
      },
      {
        href: "/employees",
        label: "Data Pegawai",
        icon: "Users",
        roles: ["HR", "ADMIN"],
      },
      {
        href: "/evaluations",
        label: "Evaluasi",
        icon: "BarChart3",
        roles: ["HR", "ADMIN"],
      },
      {
        href: "/hr/kelengkapan",
        label: "Kelengkapan Data",
        icon: "ListChecks",
        roles: ["HR", "ADMIN"],
      },
      {
        href: "/hr/export",
        label: "Export BAN-PT",
        icon: "FileSpreadsheet",
        roles: ["HR", "ADMIN"],
      },
    ],
  },
  {
    id: "admin",
    label: "Administrasi",
    icon: "Shield",
    items: [
      {
        href: "/admin",
        label: "Ringkasan Admin",
        icon: "Shield",
        roles: ["ADMIN"],
      },
      {
        href: "/admin/pegawai/baru",
        label: "Tambah Pegawai",
        icon: "UserPlus",
        roles: ["ADMIN"],
      },
      {
        href: "/admin/users",
        label: "Akun Pengguna",
        icon: "UserCog",
        roles: ["ADMIN"],
      },
      {
        href: "/admin/pejabat",
        label: "Pejabat",
        icon: "Crown",
        roles: ["ADMIN"],
      },
      {
        href: "/admin/master-data",
        label: "Tabel Gaji & Pangkat",
        icon: "DatabaseZap",
        roles: ["ADMIN"],
      },
      {
        href: "/admin/pengaturan",
        label: "Pengaturan",
        icon: "Settings",
        roles: ["ADMIN"],
      },
    ],
  },
];

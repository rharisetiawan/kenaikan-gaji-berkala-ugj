import { requireRole } from "@/lib/auth";

/**
 * All pages under /admin/* require ADMIN. The grouped sidebar already
 * surfaces every /admin/* destination — we just enforce the role guard
 * here and show a banner reminding the user they are in admin context.
 */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireRole(["ADMIN"]);

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
        <div className="font-semibold">Area Administrator</div>
        <div className="text-xs">
          Perubahan di halaman ini berdampak pada seluruh sistem. Pastikan Anda
          login sebagai ADMIN dengan alasan yang jelas.
        </div>
      </div>
      {children}
    </div>
  );
}

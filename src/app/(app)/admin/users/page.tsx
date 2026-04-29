import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { UserRowActions } from "./UserRowActions";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  const session = await requireRole(["ADMIN"]);

  const users = await prisma.user.findMany({
    orderBy: [{ role: "asc" }, { email: "asc" }],
    include: {
      employee: {
        select: { nip: true, fullName: true, employmentStatus: true },
      },
    },
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Akun Pengguna</h1>
        <p className="mt-1 text-sm text-slate-600">
          Kelola semua akun yang bisa login ke sistem: ubah peran, reset kata
          sandi, atau nonaktifkan akun. Akun pegawai (EMPLOYEE) otomatis
          terbuat saat ADMIN menambah pegawai baru.
        </p>
      </div>
      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
            <tr>
              <th className="px-3 py-2">Nama &amp; Email</th>
              <th className="px-3 py-2">Peran</th>
              <th className="px-3 py-2">Status Akun</th>
              <th className="px-3 py-2">Terkait Pegawai</th>
              <th className="px-3 py-2">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {users.map((u) => {
              const isSelf = u.id === session.userId;
              return (
                <tr key={u.id} className="align-top">
                  <td className="px-3 py-2">
                    <div className="font-medium text-slate-900">{u.name}</div>
                    <div className="text-xs text-slate-500">{u.email}</div>
                    {isSelf && (
                      <div className="mt-1 inline-block rounded bg-slate-200 px-1.5 py-0.5 text-[10px] font-medium text-slate-700">
                        Akun Anda
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2 text-xs font-medium text-slate-700">
                    {u.role}
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ${
                        u.isActive
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-rose-100 text-rose-800"
                      }`}
                    >
                      {u.isActive ? "Aktif" : "Nonaktif"}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-xs text-slate-600">
                    {u.employee ? (
                      <>
                        <div>{u.employee.fullName}</div>
                        <div className="font-mono text-[11px] text-slate-500">
                          {u.employee.nip}
                        </div>
                        <div className="text-[10px] text-slate-500">
                          {u.employee.employmentStatus}
                        </div>
                      </>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <UserRowActions
                      userId={u.id}
                      currentRole={u.role}
                      isActive={u.isActive}
                      isSelf={isSelf}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

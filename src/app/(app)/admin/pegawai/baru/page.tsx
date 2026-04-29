import { prisma } from "@/lib/prisma";
import { NewEmployeeForm } from "./NewEmployeeForm";

export const dynamic = "force-dynamic";

export default async function NewEmployeePage() {
  const [ranks, grades] = await Promise.all([
    prisma.academicRank.findMany({
      orderBy: { id: "asc" },
      select: { id: true, name: true },
    }),
    prisma.payGrade.findMany({
      orderBy: { code: "asc" },
      select: { id: true, code: true, name: true },
    }),
  ]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Tambah Pegawai</h1>
        <p className="mt-1 text-sm text-slate-600">
          Lengkapi data pegawai baru. Akun login otomatis dibuat dengan
          peran <strong>PEGAWAI</strong>. Kata sandi sementara akan ditampilkan
          satu kali setelah penyimpanan.
        </p>
      </div>
      <NewEmployeeForm ranks={ranks} grades={grades} />
    </div>
  );
}

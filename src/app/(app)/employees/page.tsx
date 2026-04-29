import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { loadAllEmployeesWithDetails, evaluateAll } from "@/lib/employees";
import { formatDateID, formatRupiah, formatServiceLength } from "@/lib/format";
import { humanEligibilityStatus } from "@/lib/eligibility";
import { getKgbRules } from "@/lib/app-settings";

export const dynamic = "force-dynamic";

export default async function EmployeesPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; q?: string }>;
}) {
  await requireRole(["ADMIN", "HR"]);
  const params = await searchParams;
  const typeFilter = params.type === "DOSEN" || params.type === "STAFF" ? params.type : undefined;
  const q = (params.q ?? "").trim().toLowerCase();

  const all = await loadAllEmployeesWithDetails();
  const rules = await getKgbRules();
  const evaluations = evaluateAll(all, new Date(), rules);

  const filtered = evaluations.filter(({ employee }) => {
    if (typeFilter && employee.type !== typeFilter) return false;
    if (q) {
      const hay = `${employee.nip} ${employee.fullName} ${employee.email ?? ""}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Data Pegawai</h1>
          <p className="text-sm text-slate-600">
            Dosen dan Tenaga Kependidikan yang tercatat dalam sistem.
          </p>
        </div>
        <div className="text-xs text-slate-500">
          {filtered.length} dari {all.length} pegawai ditampilkan.
        </div>
      </div>

      <form className="flex flex-wrap items-end gap-3 rounded-md border border-slate-200 bg-white p-3 shadow-sm">
        <div>
          <label className="block text-xs font-medium text-slate-600">Cari</label>
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="Nama atau NIP..."
            className="mt-1 w-64 rounded-md border border-slate-300 px-2 py-1.5 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600">Jenis Pegawai</label>
          <select
            name="type"
            defaultValue={typeFilter ?? ""}
            className="mt-1 rounded-md border border-slate-300 px-2 py-1.5 text-sm"
          >
            <option value="">Semua</option>
            <option value="DOSEN">Dosen</option>
            <option value="STAFF">Tenaga Kependidikan</option>
          </select>
        </div>
        <button
          type="submit"
          className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-700"
        >
          Terapkan
        </button>
        <Link href="/employees" className="text-sm text-slate-600 hover:underline">
          Reset
        </Link>
      </form>

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50">
            <tr>
              <Th>NIP</Th>
              <Th>Nama</Th>
              <Th>Jenis</Th>
              <Th>Jabatan / Golongan</Th>
              <Th>Masa Kerja</Th>
              <Th>Gaji Pokok</Th>
              <Th>TMT Berikutnya</Th>
              <Th>Status KGB</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-slate-500">
                  Tidak ada data yang cocok.
                </td>
              </tr>
            ) : (
              filtered.map(({ employee, eligibility }) => (
                <tr key={employee.id} className="hover:bg-slate-50">
                  <td className="px-4 py-2 font-mono text-xs text-slate-700">{employee.nip}</td>
                  <td className="px-4 py-2">
                    <Link href={`/employees/${employee.id}`} className="font-medium text-slate-900 hover:underline">
                      {employee.fullName}
                    </Link>
                    {employee.email && <div className="text-xs text-slate-500">{employee.email}</div>}
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex flex-col gap-1">
                      {employee.type === "DOSEN" ? (
                        <span className="inline-block rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800 w-fit">Dosen</span>
                      ) : (
                        <span className="inline-block rounded-full bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-800 w-fit">Tendik</span>
                      )}
                      <EmploymentBadge status={employee.employmentStatus} />
                    </div>
                  </td>
                  <td className="px-4 py-2 text-slate-700">
                    {employee.type === "DOSEN"
                      ? employee.dosenDetail?.academicRank.name ?? "-"
                      : `${employee.staffDetail?.payGrade.code ?? ""} ${employee.staffDetail?.payGrade.name ?? ""}`}
                  </td>
                  <td className="px-4 py-2 text-slate-700">{formatServiceLength(employee.hireDate)}</td>
                  <td className="px-4 py-2 text-slate-700">{formatRupiah(employee.currentBaseSalary)}</td>
                  <td className="px-4 py-2 text-slate-700">{formatDateID(eligibility.projectedEffectiveDate)}</td>
                  <td className="px-4 py-2">
                    <EligibilityBadge status={eligibility.status} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function EligibilityBadge({ status }: { status: "ELIGIBLE" | "NOT_YET" | "BLOCKED" | "INSUFFICIENT_DATA" }) {
  const label = humanEligibilityStatus(status);
  const className =
    status === "ELIGIBLE"
      ? "bg-emerald-100 text-emerald-800"
      : status === "NOT_YET"
      ? "bg-slate-100 text-slate-700"
      : status === "BLOCKED"
      ? "bg-red-100 text-red-800"
      : "bg-amber-100 text-amber-800";
  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${className}`}>{label}</span>;
}

function EmploymentBadge({ status }: { status: "TETAP" | "KONTRAK" | "HONORER" }) {
  const cls =
    status === "TETAP"
      ? "bg-emerald-50 text-emerald-800 border-emerald-200"
      : status === "KONTRAK"
      ? "bg-amber-50 text-amber-800 border-amber-200"
      : "bg-slate-50 text-slate-700 border-slate-200";
  return (
    <span
      className={`inline-block w-fit rounded-full border px-2 py-0.5 text-[10px] font-medium ${cls}`}
    >
      {status}
    </span>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
      {children}
    </th>
  );
}

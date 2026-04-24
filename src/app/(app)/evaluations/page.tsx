import Link from "next/link";
import { loadAllEmployeesWithDetails, evaluateAll } from "@/lib/employees";
import { formatDateID } from "@/lib/format";
import { humanEligibilityStatus } from "@/lib/eligibility";

export const dynamic = "force-dynamic";

export default async function EvaluationsPage() {
  const today = new Date();
  const employees = await loadAllEmployeesWithDetails();
  const evaluations = evaluateAll(employees, today);

  const grouped = {
    ELIGIBLE: evaluations.filter((e) => e.eligibility.status === "ELIGIBLE"),
    BLOCKED: evaluations.filter((e) => e.eligibility.status === "BLOCKED"),
    NOT_YET: evaluations.filter((e) => e.eligibility.status === "NOT_YET"),
    INSUFFICIENT_DATA: evaluations.filter((e) => e.eligibility.status === "INSUFFICIENT_DATA"),
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Evaluasi Kelayakan KGB</h1>
        <p className="text-sm text-slate-600">
          Hasil perhitungan kelayakan kenaikan gaji berkala per pegawai beserta alasannya.
        </p>
      </div>
      {(["ELIGIBLE", "BLOCKED", "NOT_YET", "INSUFFICIENT_DATA"] as const).map((status) => (
        <section key={status} className="rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-5 py-3">
            <h2 className="text-base font-semibold text-slate-900">
              {humanEligibilityStatus(status)} <span className="text-slate-500">({grouped[status].length})</span>
            </h2>
          </div>
          <ul className="divide-y divide-slate-100">
            {grouped[status].length === 0 ? (
              <li className="px-5 py-4 text-sm text-slate-500">Tidak ada pegawai.</li>
            ) : (
              grouped[status].map(({ employee, eligibility }) => (
                <li key={employee.id} className="flex items-start justify-between gap-4 px-5 py-3">
                  <div>
                    <Link href={`/employees/${employee.id}`} className="font-medium text-slate-900 hover:underline">
                      {employee.fullName}
                    </Link>
                    <div className="text-xs text-slate-500">
                      {employee.type === "DOSEN" ? "Dosen" : "Tenaga Kependidikan"} &middot; TMT proyeksi {formatDateID(eligibility.projectedEffectiveDate)}
                    </div>
                    <ul className="mt-1 list-disc pl-5 text-xs text-slate-600">
                      {eligibility.reasons.slice(0, 3).map((r, i) => (
                        <li key={i}>{r}</li>
                      ))}
                    </ul>
                  </div>
                </li>
              ))
            )}
          </ul>
        </section>
      ))}
    </div>
  );
}

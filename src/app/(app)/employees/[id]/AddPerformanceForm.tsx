"use client";

import { useActionState } from "react";
import { addPerformanceScoreAction, type ActionState } from "./actions";

export function AddPerformanceForm({ employeeId }: { employeeId: string }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    addPerformanceScoreAction,
    {},
  );
  const thisYear = new Date().getFullYear();
  return (
    <form action={formAction} className="grid grid-cols-2 gap-2 text-sm md:grid-cols-5">
      <input type="hidden" name="employeeId" value={employeeId} />
      <input
        name="year"
        type="number"
        defaultValue={thisYear}
        min={2000}
        required
        className="rounded-md border border-slate-300 px-2 py-1.5"
      />
      <input
        name="score"
        type="number"
        step="0.1"
        min={0}
        max={100}
        placeholder="Nilai 0-100"
        required
        className="rounded-md border border-slate-300 px-2 py-1.5"
      />
      <select
        name="rating"
        required
        defaultValue="GOOD"
        className="col-span-2 rounded-md border border-slate-300 px-2 py-1.5"
      >
        <option value="EXCELLENT">Sangat Baik</option>
        <option value="GOOD">Baik</option>
        <option value="SUFFICIENT">Cukup</option>
        <option value="POOR">Kurang</option>
        <option value="VERY_POOR">Sangat Kurang</option>
      </select>
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-slate-900 px-3 py-1.5 font-medium text-white hover:bg-slate-700 disabled:opacity-60"
      >
        {pending ? "..." : "Simpan"}
      </button>
      {state.error && <p className="col-span-5 text-xs text-red-700">{state.error}</p>}
      {state.success && <p className="col-span-5 text-xs text-emerald-700">{state.success}</p>}
    </form>
  );
}

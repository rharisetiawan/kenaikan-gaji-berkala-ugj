"use client";

import { useActionState } from "react";
import { addBkdAction, type ActionState } from "./actions";

export function AddBkdForm({ employeeId }: { employeeId: string }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    addBkdAction,
    {},
  );
  const thisYear = new Date().getFullYear();
  return (
    <form action={formAction} className="grid grid-cols-2 gap-2 text-sm md:grid-cols-5">
      <input type="hidden" name="employeeId" value={employeeId} />
      <input
        name="academicYear"
        placeholder={`${thisYear - 1}/${thisYear}`}
        defaultValue={`${thisYear}/${thisYear + 1}`}
        required
        className="rounded-md border border-slate-300 px-2 py-1.5"
      />
      <select
        name="semester"
        required
        className="rounded-md border border-slate-300 px-2 py-1.5"
        defaultValue="GANJIL"
      >
        <option value="GANJIL">Ganjil</option>
        <option value="GENAP">Genap</option>
      </select>
      <input
        name="sksLoad"
        type="number"
        step="0.1"
        placeholder="SKS"
        required
        className="rounded-md border border-slate-300 px-2 py-1.5"
      />
      <select
        name="status"
        required
        defaultValue="PASS"
        className="rounded-md border border-slate-300 px-2 py-1.5"
      >
        <option value="PASS">Lulus</option>
        <option value="FAIL">Tidak Lulus</option>
        <option value="PENDING">Pending</option>
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

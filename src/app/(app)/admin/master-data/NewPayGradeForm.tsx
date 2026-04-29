"use client";

import { useActionState } from "react";
import { createPayGradeAction, type MasterDataState } from "./actions";

export function NewPayGradeForm() {
  const [state, formAction, pending] = useActionState<MasterDataState, FormData>(
    createPayGradeAction,
    {},
  );
  return (
    <form
      action={formAction}
      className="flex flex-wrap items-end gap-2 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-3"
    >
      <div className="flex flex-col">
        <label className="text-[11px] uppercase tracking-wide text-slate-500">
          Kode
        </label>
        <input
          name="code"
          placeholder="III/d"
          className="rounded border border-slate-300 px-2 py-1 text-sm"
          required
        />
      </div>
      <div className="flex flex-col">
        <label className="text-[11px] uppercase tracking-wide text-slate-500">
          Nama
        </label>
        <input
          name="name"
          placeholder="Penata Tingkat I"
          className="rounded border border-slate-300 px-2 py-1 text-sm"
          required
        />
      </div>
      <div className="flex flex-col">
        <label className="text-[11px] uppercase tracking-wide text-slate-500">
          Gaji Pokok (Rp)
        </label>
        <input
          name="baseSalary"
          placeholder="3.500.000"
          inputMode="numeric"
          className="rounded border border-slate-300 px-2 py-1 text-right font-mono text-sm"
          required
        />
      </div>
      <div className="flex flex-col">
        <label className="text-[11px] uppercase tracking-wide text-slate-500">
          Level
        </label>
        <input
          name="level"
          placeholder="8"
          inputMode="numeric"
          className="w-20 rounded border border-slate-300 px-2 py-1 text-right text-sm"
          required
        />
      </div>
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-[var(--brand)] px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 disabled:opacity-60"
      >
        {pending ? "…" : "Tambah"}
      </button>
      {state.error && <span className="text-xs text-rose-600">{state.error}</span>}
      {state.success && <span className="text-xs text-emerald-700">{state.success}</span>}
    </form>
  );
}

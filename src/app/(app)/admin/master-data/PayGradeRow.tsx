"use client";

import { useActionState, useState } from "react";
import { updatePayGradeAction, type MasterDataState } from "./actions";

interface PayGradeRowProps {
  id: number;
  code: string;
  initialName: string;
  initialBaseSalary: number;
  initialLevel: number;
}

const formatRupiahInput = (n: number) =>
  new Intl.NumberFormat("id-ID").format(n);

export function PayGradeRow({
  id,
  code,
  initialName,
  initialBaseSalary,
  initialLevel,
}: PayGradeRowProps) {
  const [state, formAction, pending] = useActionState<MasterDataState, FormData>(
    updatePayGradeAction,
    {},
  );
  const [name, setName] = useState(initialName);
  const [baseSalary, setBaseSalary] = useState(formatRupiahInput(initialBaseSalary));
  const [level, setLevel] = useState(String(initialLevel));
  return (
    <tr className="border-t border-slate-200">
      <td className="px-3 py-2 font-mono text-xs text-slate-700">{code}</td>
      <td className="px-3 py-2">
        <form id={`pg-${id}`} action={formAction} className="contents">
          <input type="hidden" name="id" value={id} />
          <input
            name="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
            required
          />
        </form>
      </td>
      <td className="px-3 py-2">
        <input
          form={`pg-${id}`}
          name="baseSalary"
          value={baseSalary}
          onChange={(e) => setBaseSalary(e.target.value)}
          inputMode="numeric"
          className="w-full rounded border border-slate-300 px-2 py-1 text-right font-mono text-sm"
          required
        />
      </td>
      <td className="px-3 py-2">
        <input
          form={`pg-${id}`}
          name="level"
          value={level}
          onChange={(e) => setLevel(e.target.value)}
          inputMode="numeric"
          className="w-20 rounded border border-slate-300 px-2 py-1 text-right text-sm"
          required
        />
      </td>
      <td className="px-3 py-2">
        <button
          form={`pg-${id}`}
          type="submit"
          disabled={pending}
          className="rounded-md bg-[var(--brand)] px-3 py-1 text-xs font-medium text-white hover:opacity-90 disabled:opacity-60"
        >
          {pending ? "…" : "Simpan"}
        </button>
        {state.error && (
          <div className="mt-1 text-xs text-rose-600">{state.error}</div>
        )}
        {state.success && (
          <div className="mt-1 text-xs text-emerald-700">{state.success}</div>
        )}
      </td>
    </tr>
  );
}

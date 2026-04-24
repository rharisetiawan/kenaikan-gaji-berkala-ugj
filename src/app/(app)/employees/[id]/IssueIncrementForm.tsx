"use client";

import { useActionState } from "react";
import { issueIncrementAction, type ActionState } from "./actions";

export function IssueIncrementForm({
  employeeId,
  projectedEffectiveDate,
  projectedNewSalary,
  suggestedDecreeNumber,
}: {
  employeeId: string;
  projectedEffectiveDate: string;
  projectedNewSalary: number;
  suggestedDecreeNumber: string;
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    issueIncrementAction,
    {},
  );
  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="employeeId" value={employeeId} />
      <div className="grid gap-3 md:grid-cols-2">
        <Field label="Nomor SK" name="decreeNumber" defaultValue={suggestedDecreeNumber} required />
        <Field
          label="Tanggal SK"
          name="decreeDate"
          type="date"
          defaultValue={new Date().toISOString().slice(0, 10)}
          required
        />
        <Field
          label="TMT Berlaku"
          name="effectiveDate"
          type="date"
          defaultValue={projectedEffectiveDate}
          required
        />
        <Field
          label="Gaji Pokok Baru (Rp)"
          name="newSalary"
          type="number"
          defaultValue={String(projectedNewSalary)}
        />
        <Field
          label="Penandatangan (Nama)"
          name="signedByName"
          defaultValue="Prof. Dr. Hj. Endah Lestari, M.Si."
          required
        />
        <Field
          label="Jabatan Penandatangan"
          name="signedByPosition"
          defaultValue="Rektor Universitas Gajayana"
          required
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-600">Dasar / Catatan</label>
        <textarea
          name="reason"
          rows={2}
          className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
          defaultValue="Kenaikan Gaji Berkala sesuai peraturan kepegawaian Universitas Gajayana."
        />
      </div>
      {state.error && <p className="text-sm text-red-700">{state.error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
      >
        {pending ? "Memproses..." : "Terbitkan SK Kenaikan Gaji"}
      </button>
    </form>
  );
}

function Field({
  label,
  name,
  type = "text",
  defaultValue,
  required,
}: {
  label: string;
  name: string;
  type?: string;
  defaultValue?: string;
  required?: boolean;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-600">{label}</label>
      <input
        name={name}
        type={type}
        defaultValue={defaultValue}
        required={required}
        className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
      />
    </div>
  );
}

"use client";

import { useActionState } from "react";
import { updateOfficialAction, type UpdateOfficialState } from "./actions";
import type { OfficialRole } from "@prisma/client";

interface Props {
  role: OfficialRole;
  heading: string;
  subheading: string;
  defaultName: string;
  defaultTitle: string;
  defaultNip: string;
}

export function OfficialForm({
  role,
  heading,
  subheading,
  defaultName,
  defaultTitle,
  defaultNip,
}: Props) {
  const [state, formAction, isPending] = useActionState<
    UpdateOfficialState,
    FormData
  >(updateOfficialAction, {});

  return (
    <form
      action={formAction}
      className="space-y-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
    >
      <div>
        <div className="text-sm font-semibold text-slate-900">{heading}</div>
        <div className="text-xs text-slate-500">{subheading}</div>
      </div>
      <input type="hidden" name="role" value={role} />

      <label className="block">
        <span className="block text-xs font-medium text-slate-700">Nama Lengkap *</span>
        <input
          type="text"
          name="name"
          required
          defaultValue={defaultName}
          className="mt-1 block w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm shadow-sm focus:border-rose-500 focus:outline-none focus:ring-1 focus:ring-rose-500"
        />
      </label>

      <label className="block">
        <span className="block text-xs font-medium text-slate-700">Jabatan Lengkap *</span>
        <input
          type="text"
          name="title"
          required
          defaultValue={defaultTitle}
          className="mt-1 block w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm shadow-sm focus:border-rose-500 focus:outline-none focus:ring-1 focus:ring-rose-500"
        />
        <span className="mt-1 block text-xs text-slate-500">
          Tercetak di bawah nama, mis. &ldquo;Rektor Universitas Gajayana Malang&rdquo;.
        </span>
      </label>

      <label className="block">
        <span className="block text-xs font-medium text-slate-700">NIP / NIS (opsional)</span>
        <input
          type="text"
          name="nip"
          defaultValue={defaultNip}
          className="mt-1 block w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-mono shadow-sm focus:border-rose-500 focus:outline-none focus:ring-1 focus:ring-rose-500"
        />
      </label>

      {state.error && (
        <div className="rounded-md border border-rose-300 bg-rose-50 px-3 py-2 text-xs text-rose-800">
          {state.error}
        </div>
      )}
      {state.success && (
        <div className="rounded-md border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
          {state.success}
        </div>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="rounded-md bg-rose-700 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-rose-800 disabled:opacity-60"
      >
        {isPending ? "Menyimpan..." : "Simpan"}
      </button>
    </form>
  );
}

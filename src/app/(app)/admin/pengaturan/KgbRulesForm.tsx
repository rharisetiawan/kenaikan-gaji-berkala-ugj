"use client";

import { useActionState } from "react";
import {
  updateKgbRulesAction,
  type UpdateAppSettingsState,
} from "./actions";

interface Props {
  defaultIncrementPercent: number; // fraction, e.g. 0.03 → shown as 3
  defaultStaffMinPerformanceScore: number;
  defaultDosenRequiredBkdPasses: number;
}

export function KgbRulesForm({
  defaultIncrementPercent,
  defaultStaffMinPerformanceScore,
  defaultDosenRequiredBkdPasses,
}: Props) {
  const [state, formAction, isPending] = useActionState<
    UpdateAppSettingsState,
    FormData
  >(updateKgbRulesAction, {});

  return (
    <form
      action={formAction}
      className="space-y-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
    >
      <div>
        <div className="text-sm font-semibold text-slate-900">Aturan KGB</div>
        <div className="text-xs text-slate-500">
          Mengubah nilai di sini langsung berpengaruh pada perhitungan kenaikan
          gaji, syarat minimum kinerja, dan syarat BKD Dosen di seluruh sistem.
        </div>
      </div>

      <label className="block">
        <span className="block text-xs font-medium text-slate-700">
          Persentase kenaikan per siklus (%)
        </span>
        <input
          type="number"
          name="incrementPercent"
          step="0.01"
          min={0}
          max={100}
          required
          defaultValue={(defaultIncrementPercent * 100).toFixed(2)}
          className="mt-1 block w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm shadow-sm focus:border-rose-500 focus:outline-none focus:ring-1 focus:ring-rose-500"
        />
        <span className="mt-1 block text-xs text-slate-500">
          Default: 3 (artinya 3% dari gaji pokok setiap 2 tahun).
        </span>
      </label>

      <label className="block">
        <span className="block text-xs font-medium text-slate-700">
          Nilai kinerja minimum Tendik
        </span>
        <input
          type="number"
          name="staffMinPerformanceScore"
          step="1"
          min={0}
          max={100}
          required
          defaultValue={defaultStaffMinPerformanceScore}
          className="mt-1 block w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm shadow-sm focus:border-rose-500 focus:outline-none focus:ring-1 focus:ring-rose-500"
        />
        <span className="mt-1 block text-xs text-slate-500">
          Nilai 0–100. Tendik dengan penilaian tahunan di bawah ambang ini
          akan masuk status &ldquo;Terkendala Syarat&rdquo;.
        </span>
      </label>

      <label className="block">
        <span className="block text-xs font-medium text-slate-700">
          Jumlah semester BKD wajib LULUS (Dosen)
        </span>
        <input
          type="number"
          name="dosenRequiredBkdPasses"
          step="1"
          min={1}
          max={6}
          required
          defaultValue={defaultDosenRequiredBkdPasses}
          className="mt-1 block w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm shadow-sm focus:border-rose-500 focus:outline-none focus:ring-1 focus:ring-rose-500"
        />
        <span className="mt-1 block text-xs text-slate-500">
          Jumlah semester BKD terakhir yang harus berstatus LULUS. Default: 2.
        </span>
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
        {isPending ? "Menyimpan..." : "Simpan Aturan"}
      </button>
    </form>
  );
}

"use client";

import { useActionState } from "react";
import {
  uploadLetterheadAction,
  clearLetterheadAction,
  type UpdateAppSettingsState,
} from "./actions";

interface Props {
  currentUrl: string | null;
}

export function LetterheadForm({ currentUrl }: Props) {
  const [state, formAction, isPending] = useActionState<
    UpdateAppSettingsState,
    FormData
  >(uploadLetterheadAction, {});

  return (
    <div className="space-y-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div>
        <div className="text-sm font-semibold text-slate-900">Kop Surat</div>
        <div className="text-xs text-slate-500">
          Unggah gambar kop surat resmi (PNG/JPG/WEBP, maks 10 MB) yang akan
          otomatis dicetak di bagian atas Surat Pengantar dan SK Penetapan
          Berkala. Rasio lebar:tinggi yang ideal sekitar 8:1 (mengikuti
          format A4 landscape).
        </div>
      </div>

      {currentUrl ? (
        <div className="space-y-2">
          <div className="text-xs font-medium text-slate-700">
            Kop surat saat ini:
          </div>
          <div className="overflow-hidden rounded-md border border-slate-200 bg-slate-50 p-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={currentUrl}
              alt="Kop surat saat ini"
              className="max-h-32 w-full object-contain"
            />
          </div>
          <form action={clearLetterheadAction}>
            <button
              type="submit"
              className="text-xs font-medium text-rose-700 underline hover:text-rose-900"
            >
              Hapus kop surat (kembali ke header teks)
            </button>
          </form>
        </div>
      ) : (
        <div className="rounded-md border border-dashed border-slate-300 bg-slate-50 px-3 py-4 text-center text-xs text-slate-500">
          Belum ada kop surat. PDF saat ini memakai header teks standar.
        </div>
      )}

      <form action={formAction} className="space-y-3">
        <label className="block">
          <span className="block text-xs font-medium text-slate-700">
            Unggah kop surat baru
          </span>
          <input
            type="file"
            name="letterhead"
            accept="image/png,image/jpeg,image/webp"
            required
            className="mt-1 block w-full text-sm text-slate-700 file:mr-3 file:rounded-md file:border-0 file:bg-rose-600 file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-white hover:file:bg-rose-700"
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
          {isPending ? "Mengunggah..." : "Unggah Kop Surat"}
        </button>
      </form>
    </div>
  );
}

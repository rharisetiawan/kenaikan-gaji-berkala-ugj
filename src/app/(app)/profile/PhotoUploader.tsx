"use client";

import { useActionState } from "react";
import { EmployeeAvatar } from "@/components/EmployeeAvatar";
import { uploadMyPhotoAction, type PhotoUploadState } from "./actions";

interface PhotoUploaderProps {
  employeeId: string;
  fullName: string;
  hasPhoto: boolean;
  photoVersion?: string | number | null;
}

export function PhotoUploader({
  employeeId,
  fullName,
  hasPhoto,
  photoVersion,
}: PhotoUploaderProps) {
  const [state, formAction, pending] = useActionState<PhotoUploadState, FormData>(
    uploadMyPhotoAction,
    {},
  );
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex items-start gap-4">
        <EmployeeAvatar
          employeeId={employeeId}
          fullName={fullName}
          hasPhoto={hasPhoto}
          version={photoVersion ?? null}
          size={96}
        />
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-slate-900">Foto Profil</div>
          <p className="mt-1 text-xs text-slate-600">
            JPG, PNG, atau WEBP. Maksimum 5 MB. Disarankan rasio 1:1 (persegi).
          </p>
          <form action={formAction} className="mt-3 flex flex-wrap items-center gap-2">
            <input
              type="file"
              name="photo"
              accept="image/jpeg,image/png,image/webp"
              required
              className="block max-w-xs text-xs file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-slate-700 hover:file:bg-slate-200"
            />
            <button
              type="submit"
              disabled={pending}
              className="rounded-md bg-[var(--brand)] px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 disabled:opacity-60"
            >
              {pending ? "Mengunggah…" : hasPhoto ? "Ganti Foto" : "Unggah Foto"}
            </button>
          </form>
          {state.error && (
            <p className="mt-2 text-xs text-rose-600">{state.error}</p>
          )}
          {state.success && (
            <p className="mt-2 text-xs text-emerald-700">{state.success}</p>
          )}
        </div>
      </div>
    </div>
  );
}

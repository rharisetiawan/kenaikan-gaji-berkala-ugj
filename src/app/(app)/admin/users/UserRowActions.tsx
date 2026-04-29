"use client";

import { useActionState } from "react";
import {
  resetUserPasswordAction,
  setUserActiveAction,
  setUserRoleAction,
  type UserActionState,
} from "./actions";
import type { UserRole } from "@prisma/client";

const ROLE_OPTIONS: Array<{ value: UserRole; label: string }> = [
  { value: "ADMIN", label: "ADMIN" },
  { value: "HR", label: "HR" },
  { value: "RECTOR", label: "REKTOR" },
  { value: "FOUNDATION", label: "YAYASAN" },
  { value: "EMPLOYEE", label: "PEGAWAI" },
];

export function UserRowActions({
  userId,
  currentRole,
  isActive,
  isSelf,
}: {
  userId: string;
  currentRole: UserRole;
  isActive: boolean;
  isSelf: boolean;
}) {
  const [resetState, resetAction, resetPending] = useActionState<
    UserActionState,
    FormData
  >(resetUserPasswordAction, {});
  const [activeState, activeAction, activePending] = useActionState<
    UserActionState,
    FormData
  >(setUserActiveAction, {});
  const [roleState, roleAction, rolePending] = useActionState<
    UserActionState,
    FormData
  >(setUserRoleAction, {});

  const latestError =
    resetState.error ?? activeState.error ?? roleState.error ?? null;
  const latestSuccess =
    resetState.success ?? activeState.success ?? roleState.success ?? null;

  return (
    <div className="space-y-2 text-xs">
      <div className="flex flex-wrap items-center gap-2">
        <form action={roleAction} className="flex items-center gap-1">
          <input type="hidden" name="userId" value={userId} />
          <select
            name="role"
            defaultValue={currentRole}
            disabled={rolePending}
            className="rounded border border-slate-300 bg-white px-2 py-1 text-xs"
          >
            {ROLE_OPTIONS.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
          <button
            type="submit"
            disabled={rolePending}
            className="rounded bg-slate-700 px-2 py-1 font-medium text-white hover:bg-slate-800 disabled:opacity-60"
          >
            Simpan Peran
          </button>
        </form>

        <form action={resetAction}>
          <input type="hidden" name="userId" value={userId} />
          <button
            type="submit"
            disabled={resetPending}
            className="rounded bg-amber-600 px-2 py-1 font-medium text-white hover:bg-amber-700 disabled:opacity-60"
          >
            {resetPending ? "Reset..." : "Reset Password"}
          </button>
        </form>

        <form action={activeAction}>
          <input type="hidden" name="userId" value={userId} />
          <input
            type="hidden"
            name="isActive"
            value={String(!isActive)}
          />
          <button
            type="submit"
            disabled={activePending || isSelf}
            title={isSelf ? "Tidak bisa menonaktifkan akun sendiri" : undefined}
            className={`rounded px-2 py-1 font-medium text-white disabled:opacity-40 ${
              isActive
                ? "bg-rose-600 hover:bg-rose-700"
                : "bg-emerald-600 hover:bg-emerald-700"
            }`}
          >
            {isActive ? "Nonaktifkan" : "Aktifkan"}
          </button>
        </form>
      </div>

      {resetState.generatedPassword && (
        <div className="rounded border border-amber-300 bg-amber-50 px-2 py-1 text-amber-900">
          Kata sandi baru:{" "}
          <code className="font-mono font-semibold">
            {resetState.generatedPassword}
          </code>
          <div className="text-[10px] text-amber-700">
            Salin dan berikan ke pengguna. Kata sandi ini tidak disimpan
            terenkripsi; tidak akan muncul lagi.
          </div>
        </div>
      )}
      {latestError && (
        <div className="rounded border border-rose-300 bg-rose-50 px-2 py-1 text-rose-800">
          {latestError}
        </div>
      )}
      {latestSuccess && !resetState.generatedPassword && (
        <div className="rounded border border-emerald-300 bg-emerald-50 px-2 py-1 text-emerald-800">
          {latestSuccess}
        </div>
      )}
    </div>
  );
}

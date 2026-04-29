"use client";

import { useActionState, useState } from "react";
import { createEmployeeAction, type CreateEmployeeState } from "./actions";

interface RankOption {
  id: number;
  name: string;
}
interface GradeOption {
  id: number;
  code: string;
  name: string;
}

export function NewEmployeeForm({
  ranks,
  grades,
}: {
  ranks: RankOption[];
  grades: GradeOption[];
}) {
  const [type, setType] = useState<"DOSEN" | "STAFF">("STAFF");
  const [state, formAction, isPending] = useActionState<
    CreateEmployeeState,
    FormData
  >(createEmployeeAction, {});

  return (
    <form action={formAction} className="space-y-4">
      {state.error && (
        <div className="rounded-md border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-800">
          {state.error}
        </div>
      )}
      {state.success && state.newEmail && state.newPassword && (
        <div className="rounded-md border border-emerald-300 bg-emerald-50 px-3 py-3 text-sm text-emerald-900">
          <div className="font-semibold">{state.success}</div>
          <div className="mt-2 space-y-0.5">
            <div>
              Email login:{" "}
              <code className="font-mono font-semibold">{state.newEmail}</code>
            </div>
            <div>
              Kata sandi awal:{" "}
              <code className="font-mono font-semibold">
                {state.newPassword}
              </code>
            </div>
          </div>
          <div className="mt-2 text-xs text-emerald-800">
            Salin kredensial ini dan berikan ke pegawai. Kata sandi tidak akan
            ditampilkan lagi setelah Anda meninggalkan halaman.
          </div>
        </div>
      )}

      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-900">Data Dasar</h2>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <Field label="Tipe Pegawai *">
            <select
              name="type"
              required
              value={type}
              onChange={(e) => setType(e.target.value as "DOSEN" | "STAFF")}
              className={selectCls}
            >
              <option value="STAFF">Tenaga Kependidikan (Staf)</option>
              <option value="DOSEN">Dosen</option>
            </select>
          </Field>
          <Field label="Status Hubungan Kerja *">
            <select name="employmentStatus" required className={selectCls}>
              <option value="TETAP">Pegawai Tetap Yayasan</option>
              <option value="KONTRAK">Pegawai Kontrak</option>
              <option value="HONORER">Tenaga Honorer</option>
            </select>
          </Field>
          <Field label="NIP / NIS *">
            <input name="nip" required className={inputCls} />
          </Field>
          <Field label="Nama Lengkap (dengan gelar) *">
            <input name="fullName" required className={inputCls} />
          </Field>
          <Field label="Jenis Kelamin *">
            <select name="gender" required className={selectCls}>
              <option value="MALE">Laki-laki</option>
              <option value="FEMALE">Perempuan</option>
            </select>
          </Field>
          <Field label="Tanggal Lahir *">
            <input type="date" name="birthDate" required className={inputCls} />
          </Field>
          <Field label="Email (juga dipakai untuk login) *">
            <input type="email" name="email" required className={inputCls} />
          </Field>
          <Field label="TMT Mulai Kerja *">
            <input type="date" name="hireDate" required className={inputCls} />
          </Field>
          <Field label="Gaji Pokok Saat Ini (Rp) *">
            <input
              type="number"
              name="currentBaseSalary"
              required
              min={0}
              step={1000}
              className={inputCls}
            />
          </Field>
          <Field label="TMT Kenaikan Terakhir (opsional)">
            <input
              type="date"
              name="lastIncrementDate"
              className={inputCls}
            />
          </Field>
        </div>
      </section>

      {type === "DOSEN" ? (
        <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-900">Detail Dosen</h2>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <Field label="NIDN *">
              <input name="nidn" required className={inputCls} />
            </Field>
            <Field label="Jabatan Akademik *">
              <select name="academicRankId" required className={selectCls}>
                <option value="">— pilih —</option>
                {ranks.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Fakultas *">
              <input name="faculty" required className={inputCls} />
            </Field>
            <Field label="Program Studi *">
              <input name="studyProgram" required className={inputCls} />
            </Field>
          </div>
        </section>
      ) : (
        <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-900">Detail Staf</h2>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <Field label="Golongan / Pangkat *">
              <select name="payGradeId" required className={selectCls}>
                <option value="">— pilih —</option>
                {grades.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.code} — {g.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Unit Kerja *">
              <input name="unit" required className={inputCls} />
            </Field>
            <Field label="Jabatan *">
              <input name="position" required className={inputCls} />
            </Field>
          </div>
        </section>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="rounded-md bg-rose-700 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-rose-800 disabled:opacity-60"
      >
        {isPending ? "Menyimpan..." : "Simpan & Buat Akun"}
      </button>
    </form>
  );
}

const inputCls =
  "mt-1 block w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm shadow-sm focus:border-rose-500 focus:outline-none focus:ring-1 focus:ring-rose-500";
const selectCls = inputCls;

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-slate-700">{label}</span>
      {children}
    </label>
  );
}

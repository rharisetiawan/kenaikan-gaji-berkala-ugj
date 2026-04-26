import { requireRole } from "@/lib/auth";
import { getAppSettings } from "@/lib/app-settings";
import { KgbRulesForm } from "./KgbRulesForm";
import { LetterheadForm } from "./LetterheadForm";

export const dynamic = "force-dynamic";

/**
 * Single ADMIN-only page that controls two pieces of global state:
 *
 *   1. Kop Surat (letterhead image) — rendered at the top of every
 *      Surat Pengantar and SK Penetapan Berkala PDF.
 *   2. Aturan KGB — the three tunable rule variables (increment percent,
 *      min staff score, required Dosen BKD passes) that used to be
 *      hardcoded constants in src/lib/eligibility.ts.
 *
 * Both forms write to the AppSetting singleton row. Changes take effect
 * on the next render / next PDF generation; SK that were already issued
 * keep their original values because historical IncrementHistory rows
 * snapshot `incrementAmount` at issue time.
 */
export default async function AdminPengaturanPage() {
  await requireRole(["ADMIN"]);
  const settings = await getAppSettings();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">
          Pengaturan Sistem
        </h1>
        <p className="text-sm text-slate-600">
          Kop surat untuk PDF dan aturan kenaikan gaji berkala yang
          berlaku di seluruh sistem.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <LetterheadForm currentUrl={settings.letterheadUrl} />
        <KgbRulesForm
          defaultIncrementPercent={settings.incrementPercent}
          defaultStaffMinPerformanceScore={settings.staffMinPerformanceScore}
          defaultDosenRequiredBkdPasses={settings.dosenRequiredBkdPasses}
        />
      </div>

      <div className="rounded-md border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600">
        <p className="font-semibold text-slate-800">Catatan</p>
        <ul className="ml-5 mt-1 list-disc space-y-1">
          <li>
            Aturan KGB yang baru berlaku untuk pengajuan &amp; SK yang
            diterbitkan mulai saat disimpan. SK yang sudah terbit tidak
            berubah karena nominalnya sudah tersimpan di riwayat.
          </li>
          <li>
            Kop surat boleh dikosongkan — PDF otomatis kembali ke header
            teks institusional standar.
          </li>
          <li>
            Gambar kop surat disimpan di Vercel Blob dan dipanggil
            langsung oleh PDF; pastikan rasio &amp; resolusi sudah sesuai
            sebelum diunggah.
          </li>
        </ul>
      </div>
    </div>
  );
}

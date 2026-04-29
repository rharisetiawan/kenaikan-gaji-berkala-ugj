import { getOfficial } from "@/lib/officials";
import { OfficialForm } from "./OfficialForm";

export const dynamic = "force-dynamic";

export default async function AdminPejabatPage() {
  const [rector, foundation] = await Promise.all([
    getOfficial("RECTOR"),
    getOfficial("FOUNDATION_CHAIR"),
  ]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Pejabat</h1>
        <p className="mt-1 text-sm text-slate-600">
          Nama yang tertulis di sini otomatis dipakai di <strong>Surat Pengantar
          Rektor</strong> dan <strong>SK Penetapan Berkala</strong> untuk
          pengajuan yang diterbitkan setelah perubahan. SK yang sudah terbit
          tetap pakai nama saat tanda tangan sehingga bukti tidak berubah.
        </p>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <OfficialForm
          role="RECTOR"
          heading="Rektor"
          subheading="Penandatangan Surat Pengantar KGB."
          defaultName={rector.name}
          defaultTitle={rector.title}
          defaultNip={rector.nip ?? ""}
        />
        <OfficialForm
          role="FOUNDATION_CHAIR"
          heading="Ketua Yayasan"
          subheading="Penandatangan SK Penetapan Berkala."
          defaultName={foundation.name}
          defaultTitle={foundation.title}
          defaultNip={foundation.nip ?? ""}
        />
      </div>
    </div>
  );
}

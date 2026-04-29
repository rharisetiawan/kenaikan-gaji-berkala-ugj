/**
 * Penetapan Gaji Berkala (Yayasan → Rektor) — layout based on the
 * institutional template "Contoh Penetapan Berkala dari Yayasan.doc".
 *
 * This letter is the final "SK Berkala" in the workflow. It is issued by
 * Yayasan Pembina Pendidikan Gajayana after approving the Rektor's Surat
 * Pengantar. The template is a short numbered-item letter, not a formal
 * "MEMUTUSKAN" decree — this component reproduces that template exactly,
 * wiring each placeholder to the corresponding IncrementHistory/Employee
 * field.
 */
import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import type {
  IncrementHistory,
  Employee,
  DosenDetail,
  StaffDetail,
  AcademicRank,
  PayGrade,
  User,
} from "@prisma/client";
import { formatDateID, formatLongDateID } from "@/lib/format";
import { computeNextGolongan } from "@/lib/eligibility";

type IncrementWithRelations = IncrementHistory & {
  employee: Employee & {
    dosenDetail: (DosenDetail & { academicRank: AcademicRank }) | null;
    staffDetail: (StaffDetail & { payGrade: PayGrade }) | null;
  };
  generatedBy: User | null;
};

const styles = StyleSheet.create({
  page: {
    paddingTop: 48,
    paddingBottom: 60,
    paddingHorizontal: 60,
    fontSize: 11,
    fontFamily: "Helvetica",
    lineHeight: 1.55,
    color: "#111111",
  },
  header: {
    textAlign: "center",
    borderBottom: "2 solid #0a3b7a",
    paddingBottom: 10,
    marginBottom: 18,
  },
  hdrOrg: { fontSize: 14, fontFamily: "Helvetica-Bold" },
  hdrSub: { fontSize: 11, marginTop: 2 },
  hdrAddress: { fontSize: 9, marginTop: 2 },
  metaRow: { flexDirection: "row", marginBottom: 2 },
  metaLabel: { width: 70 },
  metaColon: { width: 10 },
  metaValue: { flex: 1 },
  title: {
    textAlign: "center",
    marginTop: 14,
    marginBottom: 2,
    fontSize: 12,
    fontFamily: "Helvetica-Bold",
    textDecoration: "underline",
  },
  subtitle: { textAlign: "center", marginBottom: 16, fontSize: 11 },
  paragraph: { marginBottom: 8, textAlign: "justify" },
  numRow: { flexDirection: "row", marginBottom: 2 },
  numNo: { width: 26 },
  numLabel: { width: 160 },
  numColon: { width: 10 },
  numValue: { flex: 1, fontFamily: "Helvetica-Bold" },
  subNote: { marginLeft: 196, marginTop: 1, marginBottom: 6, fontSize: 10, color: "#333" },
  bridgeLine: {
    marginTop: 10,
    marginBottom: 10,
    fontFamily: "Helvetica-Bold",
    textAlign: "justify",
  },
  signBox: { marginTop: 30, marginLeft: "55%", width: "45%" },
  signLine: { marginTop: 54, fontFamily: "Helvetica-Bold", textDecoration: "underline" },
  signPos: { marginTop: 2, fontSize: 10, color: "#444" },
  tembusan: { marginTop: 20, fontSize: 10 },
  tembusanItem: { marginLeft: 20 },
});

export function SuratKeputusanDocument({ record }: { record: IncrementWithRelations }) {
  const emp = record.employee;
  const golLabel =
    emp.type === "DOSEN"
      ? emp.dosenDetail?.academicRank.name ?? "-"
      : `${emp.staffDetail?.payGrade.name ?? "-"} / ${emp.staffDetail?.payGrade.code ?? "-"}`;
  // Gol. Baru (item 11): advance the letter within the same roman level;
  // stops at "/d" (see computeNextGolongan). Dosen is printed as-is.
  const golLabelBaru =
    emp.type === "DOSEN"
      ? golLabel
      : (() => {
          const baseCode = emp.staffDetail?.payGrade.code ?? null;
          const nextCode = computeNextGolongan(baseCode);
          if (!nextCode || !emp.staffDetail?.payGrade.name) return golLabel;
          return `${emp.staffDetail.payGrade.name} / ${nextCode}`;
        })();
  const unitLine =
    emp.type === "DOSEN"
      ? `${emp.dosenDetail?.faculty ?? "-"} / ${emp.dosenDetail?.studyProgram ?? "-"}`
      : emp.staffDetail?.unit ?? "-";
  const masaLama = masaKerjaOn(emp.hireDate, emp.lastIncrementDate ?? record.effectiveDate);
  const masaBaru = masaKerjaOn(emp.hireDate, record.effectiveDate);
  const nisUpper = (emp.nip ?? "").toUpperCase();
  const decreeDate = record.decreeDate ?? new Date();

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.hdrOrg}>YAYASAN PEMBINA PENDIDIKAN GAJAYANA</Text>
          <Text style={styles.hdrSub}>UNIVERSITAS GAJAYANA MALANG</Text>
          <Text style={styles.hdrAddress}>
            Jalan Mertojoyo Blok L, Merjosari, Kecamatan Lowokwaru, Kota Malang, Jawa Timur
          </Text>
          <Text style={styles.hdrAddress}>
            Telp. (0341) 000-0000 · Laman: www.unigamalang.ac.id · Surel: info@unigamalang.ac.id
          </Text>
        </View>

        <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 12 }}>
          <View style={{ width: "60%" }}>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Nomor</Text>
              <Text style={styles.metaColon}>:</Text>
              <Text style={styles.metaValue}>{record.decreeNumber ?? "-"}</Text>
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Lampiran</Text>
              <Text style={styles.metaColon}>:</Text>
              <Text style={styles.metaValue}>1 Berkas</Text>
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Perihal</Text>
              <Text style={styles.metaColon}>:</Text>
              <Text style={[styles.metaValue, { fontFamily: "Helvetica-Bold" }]}>
                PENETAPAN GAJI BERKALA
              </Text>
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}></Text>
              <Text style={styles.metaColon}></Text>
              <Text style={styles.metaValue}>Atas Nama {emp.fullName}</Text>
            </View>
          </View>
          <Text style={{ fontSize: 11 }}>{formatLongDateID(decreeDate)}</Text>
        </View>

        <View style={{ marginBottom: 16 }}>
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>KEPADA</Text>
            <Text style={styles.metaColon}>:</Text>
            <Text style={styles.metaValue}>Yth. Rektor Universitas Gajayana</Text>
          </View>
          <Text style={{ marginLeft: 80 }}>Di</Text>
          <Text style={{ marginLeft: 80, fontFamily: "Helvetica-Bold" }}>Malang</Text>
        </View>

        <Text style={styles.paragraph}>Dengan hormat,</Text>
        <Text style={styles.paragraph}>
          Dengan ini diberitahukan bahwa berdasarkan hasil penilaian pelaksanaan pekerjaan dan
          dipenuhinya masa kerja dan syarat-syarat lainnya kepada :
        </Text>

        <NumRow no="01." label="N a m a" value={emp.fullName.toUpperCase()} />
        <NumRow
          no="02."
          label={emp.type === "DOSEN" ? "NIDN / Nomor Induk" : "Nomor Induk Staf"}
          value={
            emp.type === "DOSEN"
              ? `${emp.dosenDetail?.nidn ?? "-"} / ${nisUpper}`
              : nisUpper
          }
        />
        {emp.type === "DOSEN" && (
          <DosenIdentifiers dosen={emp.dosenDetail} />
        )}
        <NumRow no="03." label="Pangkat / Golongan" value={golLabel.toUpperCase()} />
        <NumRow no="04." label="Tahun Masuk" value={formatLongDateID(emp.hireDate).toUpperCase()} />
        <NumRow
          no="05."
          label="Status"
          value={
            emp.employmentStatus === "TETAP"
              ? "PEGAWAI TETAP YAYASAN"
              : `PEGAWAI ${emp.employmentStatus} YAYASAN`
          }
        />
        <NumRow no="06." label="Masa Kerja" value={masaLama.toUpperCase()} />
        <NumRow no="07." label="Unit Kerja" value={unitLine.toUpperCase()} />
        <NumRow no="08." label="Gaji Pokok Lama" value={`Rp. ${formatRupiahPlain(record.previousSalary)}`} />
        {emp.lastIncrementDate && (
          <Text style={styles.subNote}>
            (Berdasarkan Surat Keputusan Penyesuaian Gaji Pokok Pegawai, tanggal{" "}
            {formatDateID(emp.lastIncrementDate)})
          </Text>
        )}

        <Text style={styles.bridgeLine}>Dapat diberikan kenaikan gaji berkala hingga memperoleh :</Text>

        <NumRow no="09." label="Gaji Pokok Baru" value={`Rp. ${formatRupiahPlain(record.newSalary)}`} />
        <NumRow no="10." label="Berdasarkan masa kerja" value={masaBaru.toUpperCase()} />
        <NumRow no="11." label="Dalam Pangkat/Gol." value={golLabelBaru.toUpperCase()} />
        <NumRow
          no="12."
          label="Mulai tanggal"
          value={formatLongDateID(record.effectiveDate).toUpperCase()}
        />

        <Text style={[styles.paragraph, { marginTop: 14 }]}>
          Demikian atas perhatiannya, kami ucapkan terima kasih.
        </Text>

        <View style={styles.signBox}>
          <Text>Ketua,</Text>
          <Text style={styles.signLine}>
            {record.signedByName ?? "Dr. Rosidi, SE, MM. Ak"}
          </Text>
          <Text style={styles.signPos}>
            {record.signedByPosition ?? "Ketua Yayasan Pembina Pendidikan Gajayana"}
          </Text>
        </View>

        <View style={styles.tembusan}>
          <Text>TEMBUSAN : disampaikan kepada :</Text>
          <Text style={styles.tembusanItem}>1. Yth. Kepala Biro Adm. Umum Universitas Gajayana Malang</Text>
          <Text style={styles.tembusanItem}>2. Yth. Kepala Bagian Keuangan Universitas Gajayana Malang</Text>
          <Text style={styles.tembusanItem}>3. Yth. Pegawai Yang Bersangkutan</Text>
          <Text style={styles.tembusanItem}>4. A r s i p</Text>
        </View>

        <Text style={{ marginTop: 14, fontSize: 9, color: "#555" }}>
          Dokumen ini dihasilkan oleh SIM KGB Universitas Gajayana Malang pada{" "}
          {formatDateID(new Date())}.
        </Text>
      </Page>
    </Document>
  );
}

function NumRow({ no, label, value }: { no: string; label: string; value: string }) {
  return (
    <View style={styles.numRow}>
      <Text style={styles.numNo}>{no}</Text>
      <Text style={styles.numLabel}>{label}</Text>
      <Text style={styles.numColon}>:</Text>
      <Text style={styles.numValue}>{value}</Text>
    </View>
  );
}

/**
 * Per BAN-PT requirements, Dosen records should surface their academic
 * research identifiers (Scopus / SINTA / ORCID / Google Scholar) on official
 * letters when available. Rendered as a sub-note under item 02 — keeps the
 * core 12-item template intact while making the SK accreditation-ready.
 */
function DosenIdentifiers({
  dosen,
}: {
  dosen: (DosenDetail & { academicRank: AcademicRank }) | null;
}) {
  if (!dosen) return null;
  const ids: string[] = [];
  if (dosen.scopusId) ids.push(`Scopus ID: ${dosen.scopusId}`);
  if (dosen.sintaId) ids.push(`SINTA ID: ${dosen.sintaId}`);
  if (dosen.orcid) ids.push(`ORCID: ${dosen.orcid}`);
  if (dosen.googleScholarId) ids.push(`Google Scholar: ${dosen.googleScholarId}`);
  if (ids.length === 0) return null;
  return (
    <Text style={styles.subNote}>
      ({ids.join(" · ")})
    </Text>
  );
}

function masaKerjaOn(start: Date, end: Date): string {
  let years = end.getFullYear() - start.getFullYear();
  let months = end.getMonth() - start.getMonth();
  if (end.getDate() < start.getDate()) months -= 1;
  if (months < 0) {
    years -= 1;
    months += 12;
  }
  years = Math.max(0, years);
  months = Math.max(0, months);
  return `${years} TAHUN ${String(months).padStart(2, "0")} BULAN`;
}

function formatRupiahPlain(n: number): string {
  // "Rp 1.234.567,00" without the "Rp" prefix; used inside "Rp. {value}" strings.
  const parts = Math.floor(n).toString().split("").reverse();
  const grouped: string[] = [];
  for (let i = 0; i < parts.length; i++) {
    if (i > 0 && i % 3 === 0) grouped.push(".");
    grouped.push(parts[i]);
  }
  return grouped.reverse().join("") + ",00";
}

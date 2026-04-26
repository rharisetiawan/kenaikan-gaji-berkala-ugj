/**
 * Surat Pengantar (Rektor → Yayasan) — layout based on the institutional
 * template "Surat Rektor - Pengantar ke Yayasan.doc". Keeps the brief
 * covering letter on page 1 and the "Lampiran" attachment table (one row
 * per employee included in this request) on page 2.
 */
import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import type {
  IncrementRequest,
  Employee,
  DosenDetail,
  StaffDetail,
  AcademicRank,
  PayGrade,
  User,
} from "@prisma/client";
import { formatDateID, formatRupiah } from "@/lib/format";
import { monthsOverdue } from "@/lib/rapel";
import { computeNextGolongan } from "@/lib/eligibility";

type RequestWithRelations = IncrementRequest & {
  employee: Employee & {
    dosenDetail: (DosenDetail & { academicRank: AcademicRank }) | null;
    staffDetail: (StaffDetail & { payGrade: PayGrade }) | null;
  };
  hrReviewedBy: User | null;
  rectorSignedBy: User | null;
};

const styles = StyleSheet.create({
  page: {
    paddingTop: 40,
    paddingBottom: 40,
    paddingHorizontal: 56,
    fontSize: 11,
    fontFamily: "Helvetica",
    lineHeight: 1.45,
    color: "#111111",
  },
  header: {
    textAlign: "center",
    borderBottom: "2 solid #0a3b7a",
    paddingBottom: 10,
    marginBottom: 14,
  },
  hdrSmall: { fontSize: 11 },
  hdrBig: { fontSize: 14, fontFamily: "Helvetica-Bold", marginTop: 2 },
  hdrAddress: { fontSize: 9, marginTop: 2 },
  metaRow: { flexDirection: "row", marginBottom: 2 },
  metaLabel: { width: 70 },
  metaColon: { width: 10 },
  metaValue: { flex: 1 },
  paragraph: { marginBottom: 10, textAlign: "justify" },
  signBox: { marginTop: 40, marginLeft: "55%", width: "45%" },
  signLine: { marginTop: 54, fontFamily: "Helvetica-Bold", textDecoration: "underline" },
  signPos: { marginTop: 2, fontSize: 10, color: "#444" },
  // Lampiran table
  lampHeader: { fontSize: 12, fontFamily: "Helvetica-Bold", marginBottom: 10 },
  lampMeta: { flexDirection: "row", marginBottom: 2 },
  table: { marginTop: 12, borderStyle: "solid", borderWidth: 0.5, borderColor: "#333" },
  tr: { flexDirection: "row" },
  th: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    backgroundColor: "#e8ecf3",
    borderStyle: "solid",
    borderColor: "#333",
    borderWidth: 0.5,
    padding: 3,
    textAlign: "center",
  },
  td: {
    fontSize: 8,
    borderStyle: "solid",
    borderColor: "#333",
    borderWidth: 0.5,
    padding: 3,
  },
  tdCenter: {
    fontSize: 8,
    borderStyle: "solid",
    borderColor: "#333",
    borderWidth: 0.5,
    padding: 3,
    textAlign: "center",
  },
  tdRight: {
    fontSize: 8,
    borderStyle: "solid",
    borderColor: "#333",
    borderWidth: 0.5,
    padding: 3,
    textAlign: "right",
  },
  footerNote: { marginTop: 24, fontSize: 9, color: "#555" },
});

// Column widths (percent) for the Lampiran table.
const COLW = {
  no: 24,
  nama: 95,
  nis: 55,
  golLama: 36,
  thnMasuk: 48,
  masaKerja: 42,
  unit: 78,
  gajiLama: 54,
  gajiBaru: 54,
  golBaru: 36,
  tmt: 48,
  rapel: 40,
};

export interface OfficialSnapshot {
  name: string;
  nip: string | null;
  title: string;
}

export function SuratPengantarDocument({
  record,
  rector,
}: {
  record: RequestWithRelations;
  rector?: OfficialSnapshot;
}) {
  const emp = record.employee;
  const unit =
    emp.type === "DOSEN"
      ? `${emp.dosenDetail?.faculty ?? "-"} / ${emp.dosenDetail?.studyProgram ?? "-"}`
      : `${emp.staffDetail?.unit ?? "-"}`;
  const golLama =
    emp.type === "DOSEN"
      ? emp.dosenDetail?.academicRank.name ?? "-"
      : emp.staffDetail?.payGrade.code ?? "-";
  // KGB advances the golongan letter (a→b→c→d) every 2 years within the
  // same roman numeral (golongan "level"). At "d" it stops — cross-level
  // promotion (II→III) requires a separate "kenaikan pangkat" flow based on
  // a new academic degree and is out of scope here. For Dosen entries,
  // academicRank.name isn't a golongan ladder, so we print "-" for now.
  const golBaru =
    emp.type === "DOSEN" ? "-" : computeNextGolongan(golLama) ?? golLama;
  const rapelMonths = monthsOverdue(record.projectedEffectiveDate);
  const masaKerja = masaKerjaFrom(emp.hireDate, new Date());

  const coverLetterDate = record.rectorSignedAt ?? record.coverLetterDate ?? new Date();

  return (
    <Document>
      {/* Page 1 — Cover letter (matches "Surat Rektor - Pengantar ke Yayasan.doc") */}
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.hdrSmall}>YAYASAN PEMBINA PENDIDIKAN GAJAYANA</Text>
          <Text style={styles.hdrBig}>UNIVERSITAS GAJAYANA MALANG</Text>
          <Text style={styles.hdrAddress}>
            Jalan Mertojoyo Blok L, Merjosari, Kecamatan Lowokwaru, Kota Malang, Jawa Timur
          </Text>
          <Text style={styles.hdrAddress}>
            Telp. (0341) 000-0000 · Laman: www.unigamalang.ac.id · Surel: info@unigamalang.ac.id
          </Text>
        </View>

        <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 12 }}>
          <View style={{ width: "55%" }}>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Nomor</Text>
              <Text style={styles.metaColon}>:</Text>
              <Text style={styles.metaValue}>{record.coverLetterNumber ?? "-"}</Text>
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Lampiran</Text>
              <Text style={styles.metaColon}>:</Text>
              <Text style={styles.metaValue}>1 (satu) set</Text>
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Perihal</Text>
              <Text style={styles.metaColon}>:</Text>
              <Text style={[styles.metaValue, { fontFamily: "Helvetica-Bold" }]}>
                USULAN PENETAPAN GAJI BERKALA
              </Text>
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}></Text>
              <Text style={styles.metaColon}></Text>
              <Text style={styles.metaValue}>Atas Nama terlampir</Text>
            </View>
          </View>
          <Text style={{ fontSize: 11 }}>Malang, {formatDateID(coverLetterDate)}</Text>
        </View>

        <View style={{ marginBottom: 16 }}>
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>KEPADA</Text>
            <Text style={styles.metaColon}>:</Text>
            <Text style={styles.metaValue}>Yth. Ketua Yayasan Pendidikan Gajayana</Text>
          </View>
          <Text style={{ marginLeft: 80 }}>Di</Text>
          <Text style={{ marginLeft: 80, fontFamily: "Helvetica-Bold" }}>Malang</Text>
        </View>

        <Text style={styles.paragraph}>Dengan hormat,</Text>
        <Text style={styles.paragraph}>
          Dengan ini diberitahukan bahwa berdasarkan hasil penilaian pelaksanaan pekerjaan dan
          dipenuhinya masa kerja dan syarat-syarat lainnya kepada nama terlampir.
        </Text>
        <Text style={styles.paragraph}>
          Demikian atas perhatiannya, kami ucapkan terima kasih.
        </Text>

        <View style={styles.signBox}>
          <Text>Rektor,</Text>
          <Text style={styles.signLine}>
            {record.rectorSignedBy?.name ??
              rector?.name ??
              "Prof. Dr. Ernani Hadiyati, S.E., M.M."}
          </Text>
          <Text style={styles.signPos}>NIP. {rector?.nip ?? "—"}</Text>
        </View>

        <Text style={styles.footerNote}>
          Dokumen ini dihasilkan oleh SIM KGB Universitas Gajayana Malang pada{" "}
          {formatDateID(new Date())}.
        </Text>
      </Page>

      {/* Page 2 — Lampiran (attachment table) */}
      <Page size="A4" orientation="landscape" style={styles.page}>
        <Text style={styles.lampHeader}>
          Lampiran Surat No. : {record.coverLetterNumber ?? "-"}
        </Text>

        <View style={styles.table}>
          <View style={styles.tr}>
            <Text style={[styles.th, { width: `${COLW.no}%` }]}>No.</Text>
            <Text style={[styles.th, { width: `${COLW.nama}%` }]}>Nama</Text>
            <Text style={[styles.th, { width: `${COLW.nis}%` }]}>NIS</Text>
            <Text style={[styles.th, { width: `${COLW.golLama}%` }]}>Gol. Lama</Text>
            <Text style={[styles.th, { width: `${COLW.thnMasuk}%` }]}>Tahun Masuk</Text>
            <Text style={[styles.th, { width: `${COLW.masaKerja}%` }]}>Masa Kerja</Text>
            <Text style={[styles.th, { width: `${COLW.unit}%` }]}>Unit Kerja</Text>
            <Text style={[styles.th, { width: `${COLW.gajiLama}%` }]}>Gaji Pokok Lama</Text>
            <Text style={[styles.th, { width: `${COLW.gajiBaru}%` }]}>Gaji Pokok Baru</Text>
            <Text style={[styles.th, { width: `${COLW.golBaru}%` }]}>Gol. Baru</Text>
            <Text style={[styles.th, { width: `${COLW.tmt}%` }]}>TMT</Text>
            <Text style={[styles.th, { width: `${COLW.rapel}%` }]}>
              Total Rapel{"\n"}(bln)
            </Text>
          </View>
          <View style={styles.tr}>
            <Text style={[styles.tdCenter, { width: `${COLW.no}%` }]}>1</Text>
            <Text style={[styles.td, { width: `${COLW.nama}%` }]}>{emp.fullName}</Text>
            <Text style={[styles.tdCenter, { width: `${COLW.nis}%` }]}>{emp.nip}</Text>
            <Text style={[styles.tdCenter, { width: `${COLW.golLama}%` }]}>{golLama}</Text>
            <Text style={[styles.tdCenter, { width: `${COLW.thnMasuk}%` }]}>
              {formatDateID(emp.hireDate)}
            </Text>
            <Text style={[styles.tdCenter, { width: `${COLW.masaKerja}%` }]}>{masaKerja}</Text>
            <Text style={[styles.td, { width: `${COLW.unit}%` }]}>{unit}</Text>
            <Text style={[styles.tdRight, { width: `${COLW.gajiLama}%` }]}>
              {formatRupiah(record.currentSalary)}
            </Text>
            <Text style={[styles.tdRight, { width: `${COLW.gajiBaru}%` }]}>
              {formatRupiah(record.projectedNewSalary)}
            </Text>
            <Text style={[styles.tdCenter, { width: `${COLW.golBaru}%` }]}>{golBaru}</Text>
            <Text style={[styles.tdCenter, { width: `${COLW.tmt}%` }]}>
              {formatDateID(record.projectedEffectiveDate)}
            </Text>
            <Text style={[styles.tdCenter, { width: `${COLW.rapel}%` }]}>{rapelMonths}</Text>
          </View>
        </View>

        <View style={{ marginTop: 22 }}>
          <Text style={{ marginLeft: "55%" }}>Rektor,</Text>
          <Text
            style={{
              marginLeft: "55%",
              marginTop: 46,
              fontFamily: "Helvetica-Bold",
              textDecoration: "underline",
            }}
          >
            {record.rectorSignedBy?.name ??
              rector?.name ??
              "Prof. Dr. Ernani Hadiyati, S.E., M.M."}
          </Text>
          <Text style={{ marginLeft: "55%", fontSize: 10, color: "#444" }}>
            NIP. {rector?.nip ?? "—"}
          </Text>
        </View>
      </Page>
    </Document>
  );
}

function masaKerjaFrom(start: Date, end: Date): string {
  let years = end.getFullYear() - start.getFullYear();
  let months = end.getMonth() - start.getMonth();
  if (end.getDate() < start.getDate()) months -= 1;
  if (months < 0) {
    years -= 1;
    months += 12;
  }
  years = Math.max(0, years);
  months = Math.max(0, months);
  return `${String(years).padStart(2, "0")} th ${String(months).padStart(2, "0")} bln`;
}

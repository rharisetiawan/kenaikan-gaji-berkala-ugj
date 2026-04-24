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
import { formatDateID, formatLongDateID, formatRupiah } from "@/lib/format";

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
    paddingBottom: 60,
    paddingHorizontal: 60,
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
  metaLabel: { width: 60 },
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
  subtitle: {
    textAlign: "center",
    marginBottom: 16,
    fontSize: 11,
  },
  paragraph: { marginBottom: 8, textAlign: "justify" },
  row: { flexDirection: "row", marginBottom: 1 },
  rowLabel: { width: 140 },
  rowColon: { width: 10 },
  rowValue: { flex: 1, fontFamily: "Helvetica-Bold" },
  signBox: { marginTop: 40, marginLeft: "55%", width: "45%" },
  signLine: { marginTop: 54, fontFamily: "Helvetica-Bold", textDecoration: "underline" },
  footerNote: { marginTop: 24, fontSize: 9, color: "#555" },
});

export function SuratPengantarDocument({ record }: { record: RequestWithRelations }) {
  const emp = record.employee;
  const employeeType = emp.type === "DOSEN" ? "Dosen Tetap" : "Tenaga Kependidikan";
  const jabatan =
    emp.type === "DOSEN"
      ? emp.dosenDetail?.academicRank.name ?? "-"
      : `${emp.staffDetail?.payGrade.code ?? "-"} (${emp.staffDetail?.payGrade.name ?? "-"})`;
  const unit =
    emp.type === "DOSEN"
      ? `${emp.dosenDetail?.faculty ?? "-"} - Program Studi ${emp.dosenDetail?.studyProgram ?? "-"}`
      : `${emp.staffDetail?.unit ?? "-"} - ${emp.staffDetail?.position ?? "-"}`;

  return (
    <Document>
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

        <View style={{ marginBottom: 16 }}>
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Nomor</Text>
            <Text style={styles.metaColon}>:</Text>
            <Text style={styles.metaValue}>{record.coverLetterNumber ?? "-"}</Text>
          </View>
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Lampiran</Text>
            <Text style={styles.metaColon}>:</Text>
            <Text style={styles.metaValue}>1 (satu) berkas usulan</Text>
          </View>
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Perihal</Text>
            <Text style={styles.metaColon}>:</Text>
            <Text style={[styles.metaValue, { fontFamily: "Helvetica-Bold" }]}>
              Usulan Kenaikan Gaji Berkala a.n. {emp.fullName}
            </Text>
          </View>
        </View>

        <View style={{ marginBottom: 16 }}>
          <Text>Kepada Yth.</Text>
          <Text style={{ fontFamily: "Helvetica-Bold" }}>
            Ketua Yayasan Pembina Pendidikan Gajayana
          </Text>
          <Text>di Malang</Text>
        </View>

        <Text style={styles.paragraph}>
          Dengan hormat, sehubungan dengan telah terpenuhinya persyaratan Kenaikan Gaji Berkala
          (KGB) reguler setiap dua tahun bagi pegawai Universitas Gajayana Malang, bersama ini
          kami mengajukan usulan Kenaikan Gaji Berkala atas nama pegawai berikut:
        </Text>

        <View style={{ marginBottom: 10 }}>
          <Row label="Nama" value={emp.fullName} />
          <Row label="NIP" value={emp.nip} />
          {emp.type === "DOSEN" && <Row label="NIDN" value={emp.dosenDetail?.nidn ?? "-"} />}
          <Row label="Status Pegawai" value={employeeType} />
          <Row label={emp.type === "DOSEN" ? "Jabatan Akademik" : "Golongan"} value={jabatan} />
          <Row label={emp.type === "DOSEN" ? "Fakultas / Prodi" : "Unit Kerja"} value={unit} />
          <Row label="TMT Mulai Kerja" value={formatDateID(emp.hireDate)} />
          <Row
            label="TMT KGB Berikutnya"
            value={formatDateID(record.projectedEffectiveDate)}
          />
          <Row label="Gaji Pokok Lama" value={formatRupiah(record.currentSalary)} />
          <Row label="Gaji Pokok Baru" value={formatRupiah(record.projectedNewSalary)} />
          <Row label="Kenaikan" value={formatRupiah(record.incrementAmount)} />
        </View>

        <Text style={styles.paragraph}>
          Berkas pendukung (SKP yang ditandatangani atasan langsung, SK Berkala terakhir
          {emp.type === "DOSEN" ? ", dan Bukti Tridharma aktif" : ""}) telah diverifikasi oleh
          Bagian Kepegawaian pada tanggal{" "}
          {record.hrReviewedAt ? formatDateID(record.hrReviewedAt) : "-"} dan dinyatakan lengkap.
        </Text>

        <Text style={styles.paragraph}>
          Sehubungan dengan hal tersebut, kami mohon Yayasan berkenan menerbitkan Surat Keputusan
          Kenaikan Gaji Berkala yang bersangkutan. Atas perhatian dan kerja sama Yayasan, kami
          ucapkan terima kasih.
        </Text>

        <View style={styles.signBox}>
          <Text>Ditetapkan di : Malang</Text>
          <Text>
            Pada tanggal :{" "}
            {record.rectorSignedAt
              ? formatLongDateID(record.rectorSignedAt)
              : record.coverLetterDate
                ? formatLongDateID(record.coverLetterDate)
                : "-"}
          </Text>
          <Text style={{ marginTop: 8 }}>Rektor Universitas Gajayana Malang</Text>
          <Text style={styles.signLine}>
            {record.rectorSignedBy?.name ?? "Rektor Universitas Gajayana Malang"}
          </Text>
        </View>

        <Text style={styles.footerNote}>
          Tembusan: 1) Yth. Ketua Yayasan Pembina Pendidikan Gajayana; 2) Bagian Kepegawaian
          Universitas Gajayana Malang; 3) Pegawai yang bersangkutan; 4) Arsip. · Dokumen ini
          dihasilkan oleh SIM KGB Universitas Gajayana Malang pada{" "}
          {formatDateID(new Date())}.
        </Text>
      </Page>
    </Document>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowColon}>:</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import type { IncrementHistory, Employee, DosenDetail, StaffDetail, AcademicRank, PayGrade, User } from "@prisma/client";
import { formatDateID, formatLongDateID, formatRupiah, terbilangRupiah } from "@/lib/format";

type IncrementWithRelations = IncrementHistory & {
  employee: Employee & {
    dosenDetail: (DosenDetail & { academicRank: AcademicRank }) | null;
    staffDetail: (StaffDetail & { payGrade: PayGrade }) | null;
  };
  generatedBy: User | null;
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
  hdrBig: {
    fontSize: 14,
    fontFamily: "Helvetica-Bold",
    marginTop: 2,
  },
  hdrAddress: { fontSize: 9, marginTop: 2 },
  title: {
    textAlign: "center",
    marginTop: 12,
    marginBottom: 2,
    fontSize: 12,
    fontFamily: "Helvetica-Bold",
    textDecoration: "underline",
  },
  subtitle: {
    textAlign: "center",
    marginBottom: 2,
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
  },
  number: { textAlign: "center", marginBottom: 14, fontSize: 11 },
  sectionHeading: {
    fontFamily: "Helvetica-Bold",
    marginTop: 6,
    marginBottom: 2,
  },
  paragraph: { marginBottom: 6, textAlign: "justify" },
  row: { flexDirection: "row", marginBottom: 1 },
  rowLabel: { width: 130 },
  rowColon: { width: 10 },
  rowValue: { flex: 1, fontFamily: "Helvetica-Bold" },
  considerItem: { flexDirection: "row", marginBottom: 4 },
  considerLabel: { width: 18 },
  memutuskan: {
    marginTop: 12,
    marginBottom: 8,
    textAlign: "center",
    fontFamily: "Helvetica-Bold",
    textDecoration: "underline",
  },
  dictum: {
    marginBottom: 6,
    textAlign: "justify",
  },
  signBox: {
    marginTop: 30,
    marginLeft: "55%",
    width: "45%",
  },
  signLine: { marginTop: 54, fontFamily: "Helvetica-Bold", textDecoration: "underline" },
  footerNote: {
    marginTop: 24,
    fontSize: 9,
    color: "#555",
  },
});

export function SuratKeputusanDocument({ record }: { record: IncrementWithRelations }) {
  const emp = record.employee;
  const employeeType = emp.type === "DOSEN" ? "Dosen Tetap" : "Tenaga Kependidikan";
  const jabatanLine =
    emp.type === "DOSEN"
      ? emp.dosenDetail?.academicRank.name ?? "-"
      : `${emp.staffDetail?.payGrade.code ?? "-"} (${emp.staffDetail?.payGrade.name ?? "-"})`;
  const unitLine =
    emp.type === "DOSEN"
      ? `${emp.dosenDetail?.faculty ?? "-"} - Program Studi ${emp.dosenDetail?.studyProgram ?? "-"}`
      : `${emp.staffDetail?.unit ?? "-"} - ${emp.staffDetail?.position ?? "-"}`;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.hdrSmall}>YAYASAN PEMBINA PENDIDIKAN GAJAYANA</Text>
          <Text style={styles.hdrBig}>UNIVERSITAS GAJAYANA</Text>
          <Text style={styles.hdrAddress}>
            Jalan Mertojoyo Blok L, Merjosari, Kecamatan Lowokwaru, Kota Malang, Jawa Timur
          </Text>
          <Text style={styles.hdrAddress}>
            Telp. (0341) 000-0000 · Laman: www.unigamalang.ac.id · Surel: info@unigamalang.ac.id
          </Text>
        </View>

        <Text style={styles.title}>KEPUTUSAN REKTOR UNIVERSITAS GAJAYANA</Text>
        <Text style={styles.subtitle}>
          TENTANG KENAIKAN GAJI BERKALA {employeeType.toUpperCase()}
        </Text>
        <Text style={styles.number}>Nomor: {record.decreeNumber ?? "-"}</Text>

        <Text style={styles.sectionHeading}>REKTOR UNIVERSITAS GAJAYANA,</Text>

        <Text style={styles.sectionHeading}>Menimbang:</Text>
        <View style={styles.considerItem}>
          <Text style={styles.considerLabel}>a.</Text>
          <Text style={{ flex: 1, textAlign: "justify" }}>
            bahwa saudara/saudari yang namanya tercantum dalam keputusan ini telah memenuhi syarat untuk
            diberikan Kenaikan Gaji Berkala (KGB) berdasarkan masa kerja dan evaluasi kinerja;
          </Text>
        </View>
        <View style={styles.considerItem}>
          <Text style={styles.considerLabel}>b.</Text>
          <Text style={{ flex: 1, textAlign: "justify" }}>
            bahwa berdasarkan pertimbangan sebagaimana dimaksud pada huruf a, perlu ditetapkan Keputusan
            Rektor tentang Kenaikan Gaji Berkala yang bersangkutan.
          </Text>
        </View>

        <Text style={styles.sectionHeading}>Mengingat:</Text>
        <View style={styles.considerItem}>
          <Text style={styles.considerLabel}>1.</Text>
          <Text style={{ flex: 1, textAlign: "justify" }}>
            Undang-Undang Nomor 12 Tahun 2012 tentang Pendidikan Tinggi;
          </Text>
        </View>
        <View style={styles.considerItem}>
          <Text style={styles.considerLabel}>2.</Text>
          <Text style={{ flex: 1, textAlign: "justify" }}>
            Peraturan Kepegawaian Universitas Gajayana tentang Penggajian Pegawai;
          </Text>
        </View>
        <View style={styles.considerItem}>
          <Text style={styles.considerLabel}>3.</Text>
          <Text style={{ flex: 1, textAlign: "justify" }}>
            Statuta Universitas Gajayana yang berlaku.
          </Text>
        </View>

        <Text style={styles.memutuskan}>MEMUTUSKAN</Text>

        <Text style={styles.paragraph}>
          <Text style={{ fontFamily: "Helvetica-Bold" }}>Menetapkan:</Text> Keputusan Rektor Universitas Gajayana
          tentang Kenaikan Gaji Berkala bagi pegawai sebagaimana tersebut di bawah ini.
        </Text>

        <Text style={styles.sectionHeading}>KESATU:</Text>
        <Text style={styles.dictum}>
          Memberikan Kenaikan Gaji Berkala kepada pegawai Universitas Gajayana sebagai berikut:
        </Text>

        <View style={{ marginBottom: 6 }}>
          <Row label="Nama" value={emp.fullName} />
          <Row label="NIP" value={emp.nip} />
          {emp.type === "DOSEN" && emp.dosenDetail && (
            <Row label="NIDN" value={emp.dosenDetail.nidn} />
          )}
          <Row label="Tempat/Tgl. Lahir" value={`${formatDateID(emp.birthDate)}`} />
          <Row label="Jenis Kelamin" value={emp.gender === "MALE" ? "Laki-laki" : "Perempuan"} />
          <Row label="Status Pegawai" value={employeeType} />
          <Row label={emp.type === "DOSEN" ? "Jabatan Akademik" : "Golongan Ruang"} value={jabatanLine} />
          <Row label={emp.type === "DOSEN" ? "Fakultas / Prodi" : "Unit Kerja"} value={unitLine} />
          <Row label="TMT Mulai Kerja" value={formatDateID(emp.hireDate)} />
        </View>

        <Text style={styles.sectionHeading}>KEDUA:</Text>
        <Text style={styles.dictum}>
          Menetapkan gaji pokok baru terhitung mulai tanggal {" "}
          <Text style={{ fontFamily: "Helvetica-Bold" }}>{formatLongDateID(record.effectiveDate)}</Text>
          , dengan rincian sebagai berikut:
        </Text>
        <View style={{ marginBottom: 6 }}>
          <Row label="Gaji Pokok Lama" value={formatRupiah(record.previousSalary)} />
          <Row label="Kenaikan" value={formatRupiah(record.incrementAmount)} />
          <Row label="Gaji Pokok Baru" value={formatRupiah(record.newSalary)} />
          <Row
            label="Terbilang"
            value={capitalize(terbilangRupiah(record.newSalary))}
          />
        </View>

        <Text style={styles.sectionHeading}>KETIGA:</Text>
        <Text style={styles.dictum}>
          {record.reason ?? "Kenaikan Gaji Berkala ini diberikan sebagai penghargaan atas masa kerja dan kinerja yang telah dijalankan."}
        </Text>

        <Text style={styles.sectionHeading}>KEEMPAT:</Text>
        <Text style={styles.dictum}>
          Keputusan ini mulai berlaku pada tanggal ditetapkan, dengan ketentuan apabila di kemudian hari terdapat
          kekeliruan akan diadakan perbaikan sebagaimana mestinya.
        </Text>

        <View style={styles.signBox}>
          <Text>Ditetapkan di : Malang</Text>
          <Text>Pada tanggal : {formatLongDateID(record.decreeDate)}</Text>
          <Text style={{ marginTop: 8 }}>{record.signedByPosition ?? "Rektor Universitas Gajayana"}</Text>
          <Text style={styles.signLine}>{record.signedByName ?? "_____________________"}</Text>
        </View>

        <Text style={styles.footerNote}>
          Tembusan: 1) Yth. Biro SDM UGJ; 2) Yth. Biro Keuangan UGJ; 3) Arsip. · Dokumen ini dihasilkan oleh SIM
          KGB pada {formatDateID(new Date())}.
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

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

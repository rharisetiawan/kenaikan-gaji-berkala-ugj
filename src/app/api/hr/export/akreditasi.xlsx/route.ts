import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  humanAuthorRole,
  humanCertificationCategory,
  humanPublicationKind,
} from "@/lib/hris";

function fmtDate(d: Date | null | undefined): string {
  if (!d) return "";
  return d.toISOString().slice(0, 10);
}

function humanEmploymentStatus(s: string): string {
  switch (s) {
    case "TETAP": return "Tetap";
    case "KONTRAK": return "Kontrak";
    case "HONORER": return "Honorer";
    default: return s;
  }
}

function humanGender(g: string | null): string {
  if (g === "MALE") return "Laki-laki";
  if (g === "FEMALE") return "Perempuan";
  return "";
}

export async function GET() {
  await requireRole(["HR", "ADMIN"]);

  const [dosenList, staffList, certs, pubs] = await Promise.all([
    prisma.employee.findMany({
      where: { type: "DOSEN" },
      include: {
        dosenDetail: { include: { academicRank: true } },
      },
      orderBy: { fullName: "asc" },
    }),
    prisma.employee.findMany({
      where: { type: "STAFF" },
      include: {
        staffDetail: { include: { payGrade: true } },
      },
      orderBy: { fullName: "asc" },
    }),
    prisma.certification.findMany({
      include: { employee: { select: { nip: true, fullName: true, type: true } } },
      orderBy: [{ issueDate: "desc" }],
    }),
    prisma.publication.findMany({
      include: {
        dosenDetail: {
          include: { employee: { select: { nip: true, fullName: true } } },
        },
      },
      orderBy: [{ year: "desc" }],
    }),
  ]);

  const wb = new ExcelJS.Workbook();
  wb.creator = "SIM KGB — Universitas Gajayana Malang";
  wb.created = new Date();

  // ─────────────────────────────────────── Sheet: Dosen
  const sDosen = wb.addWorksheet("Dosen");
  sDosen.columns = [
    { header: "No", key: "no", width: 5 },
    { header: "NIDN", key: "nidn", width: 14 },
    { header: "NIP", key: "nip", width: 20 },
    { header: "Nama Lengkap", key: "name", width: 36 },
    { header: "Jabatan Akademik", key: "rank", width: 18 },
    { header: "Fakultas", key: "faculty", width: 22 },
    { header: "Program Studi", key: "prodi", width: 22 },
    { header: "Pendidikan Terakhir", key: "edu", width: 16 },
    { header: "NIK (KTP)", key: "nik", width: 20 },
    { header: "ORCID", key: "orcid", width: 22 },
    { header: "Scopus ID", key: "scopus", width: 16 },
    { header: "SINTA ID", key: "sinta", width: 14 },
    { header: "Google Scholar", key: "gs", width: 22 },
    { header: "Status Hub. Kerja", key: "empstatus", width: 16 },
    { header: "TMT", key: "tmt", width: 12 },
  ];
  dosenList.forEach((e, i) => {
    sDosen.addRow({
      no: i + 1,
      nidn: e.dosenDetail?.nidn ?? "",
      nip: e.nip,
      name: e.fullName,
      rank: e.dosenDetail?.academicRank.name ?? "",
      faculty: e.dosenDetail?.faculty ?? "",
      prodi: e.dosenDetail?.studyProgram ?? "",
      edu: e.lastEducation ?? "",
      nik: e.nik ?? "",
      orcid: e.dosenDetail?.orcid ?? "",
      scopus: e.dosenDetail?.scopusId ?? "",
      sinta: e.dosenDetail?.sintaId ?? "",
      gs: e.dosenDetail?.googleScholarId ?? "",
      empstatus: humanEmploymentStatus(e.employmentStatus),
      tmt: fmtDate(e.hireDate),
    });
  });
  sDosen.getRow(1).font = { bold: true };
  sDosen.views = [{ state: "frozen", ySplit: 1 }];

  // ─────────────────────────────────────── Sheet: Tenaga Kependidikan
  const sStaff = wb.addWorksheet("Tenaga Kependidikan");
  sStaff.columns = [
    { header: "No", key: "no", width: 5 },
    { header: "NIP / NIS", key: "nip", width: 20 },
    { header: "Nama Lengkap", key: "name", width: 36 },
    { header: "Unit Kerja", key: "unit", width: 24 },
    { header: "Jabatan", key: "position", width: 22 },
    { header: "Golongan", key: "golongan", width: 10 },
    { header: "Pangkat", key: "pangkat", width: 22 },
    { header: "Pendidikan Terakhir", key: "edu", width: 16 },
    { header: "NIK (KTP)", key: "nik", width: 20 },
    { header: "Tanggal Lahir", key: "dob", width: 14 },
    { header: "Jenis Kelamin", key: "gender", width: 14 },
    { header: "Status Hub. Kerja", key: "empstatus", width: 16 },
    { header: "TMT", key: "tmt", width: 12 },
  ];
  staffList.forEach((e, i) => {
    sStaff.addRow({
      no: i + 1,
      nip: e.nip,
      name: e.fullName,
      unit: e.staffDetail?.unit ?? "",
      position: e.staffDetail?.position ?? "",
      golongan: e.staffDetail?.payGrade.code ?? "",
      pangkat: e.staffDetail?.payGrade.name ?? "",
      edu: e.lastEducation ?? "",
      nik: e.nik ?? "",
      dob: fmtDate(e.birthDate),
      gender: humanGender(e.gender),
      empstatus: humanEmploymentStatus(e.employmentStatus),
      tmt: fmtDate(e.hireDate),
    });
  });
  sStaff.getRow(1).font = { bold: true };
  sStaff.views = [{ state: "frozen", ySplit: 1 }];

  // ─────────────────────────────────────── Sheet: Sertifikasi
  const sCert = wb.addWorksheet("Sertifikasi");
  sCert.columns = [
    { header: "No", key: "no", width: 5 },
    { header: "NIP", key: "nip", width: 20 },
    { header: "Nama Pegawai", key: "emp", width: 36 },
    { header: "Tipe", key: "type", width: 10 },
    { header: "Nama Sertifikat", key: "name", width: 36 },
    { header: "Kategori", key: "category", width: 22 },
    { header: "Penerbit", key: "issuer", width: 30 },
    { header: "Nomor", key: "num", width: 18 },
    { header: "Terbit", key: "issue", width: 12 },
    { header: "Kadaluwarsa", key: "expiry", width: 12 },
    { header: "Terverifikasi", key: "verified", width: 12 },
  ];
  certs.forEach((c, i) => {
    sCert.addRow({
      no: i + 1,
      nip: c.employee.nip,
      emp: c.employee.fullName,
      type: c.employee.type,
      name: c.name,
      category: humanCertificationCategory(c.category),
      issuer: c.issuer,
      num: c.certificateNumber ?? "",
      issue: fmtDate(c.issueDate),
      expiry: fmtDate(c.expiryDate),
      verified: c.verified ? "Ya" : "Belum",
    });
  });
  sCert.getRow(1).font = { bold: true };
  sCert.views = [{ state: "frozen", ySplit: 1 }];

  // ─────────────────────────────────────── Sheet: Publikasi
  const sPub = wb.addWorksheet("Publikasi");
  sPub.columns = [
    { header: "No", key: "no", width: 5 },
    { header: "NIP Dosen", key: "nip", width: 20 },
    { header: "Nama Dosen", key: "dosen", width: 30 },
    { header: "Tahun", key: "year", width: 8 },
    { header: "Jenis", key: "kind", width: 28 },
    { header: "Judul", key: "title", width: 50 },
    { header: "Venue", key: "venue", width: 30 },
    { header: "Peran", key: "role", width: 20 },
    { header: "DOI", key: "doi", width: 22 },
    { header: "URL", key: "url", width: 30 },
    { header: "SINTA", key: "sinta", width: 8 },
    { header: "Scopus Q", key: "quartile", width: 10 },
    { header: "Terverifikasi", key: "verified", width: 12 },
  ];
  pubs.forEach((p, i) => {
    sPub.addRow({
      no: i + 1,
      nip: p.dosenDetail.employee.nip,
      dosen: p.dosenDetail.employee.fullName,
      year: p.year,
      kind: humanPublicationKind(p.kind),
      title: p.title,
      venue: p.venue,
      role: humanAuthorRole(p.authorRole),
      doi: p.doi ?? "",
      url: p.url ?? "",
      sinta: p.sintaRank ?? "",
      quartile: p.scopusQuartile ?? "",
      verified: p.verified ? "Ya" : "Belum",
    });
  });
  sPub.getRow(1).font = { bold: true };
  sPub.views = [{ state: "frozen", ySplit: 1 }];

  const buffer = await wb.xlsx.writeBuffer();
  const timestamp = new Date().toISOString().slice(0, 10);

  return new NextResponse(new Uint8Array(buffer as ArrayBuffer), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="akreditasi-unigamalang-${timestamp}.xlsx"`,
      "Cache-Control": "private, max-age=0, must-revalidate",
    },
  });
}

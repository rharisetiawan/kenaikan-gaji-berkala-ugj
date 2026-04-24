import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";
import { computeNextIncrementDate } from "../src/lib/eligibility";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is not set");
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

async function main() {
  console.log("Seeding reference data...");

  // Academic ranks (Jabatan Akademik)
  const ranks = await Promise.all([
    prisma.academicRank.upsert({
      where: { code: "ASISTEN_AHLI" },
      update: {},
      create: { code: "ASISTEN_AHLI", name: "Asisten Ahli", minServiceYears: 2, functionalAllowance: 1_100_000 },
    }),
    prisma.academicRank.upsert({
      where: { code: "LEKTOR" },
      update: {},
      create: { code: "LEKTOR", name: "Lektor", minServiceYears: 4, functionalAllowance: 2_000_000 },
    }),
    prisma.academicRank.upsert({
      where: { code: "LEKTOR_KEPALA" },
      update: {},
      create: { code: "LEKTOR_KEPALA", name: "Lektor Kepala", minServiceYears: 8, functionalAllowance: 3_500_000 },
    }),
    prisma.academicRank.upsert({
      where: { code: "GURU_BESAR" },
      update: {},
      create: { code: "GURU_BESAR", name: "Guru Besar", minServiceYears: 12, functionalAllowance: 5_500_000 },
    }),
  ]);

  // Pay grades (Golongan) - simplified ladder. Golongan I is included because
  // the legacy REKAP BERKALA rekap import contains staff at I/d; baseSalary
  // values in that range are placeholders (the imported rows overwrite the
  // salary on the Employee row directly).
  const gradeDefs: Array<{ code: string; name: string; baseSalary: number; level: number }> = [
    { code: "I/a", name: "Juru Muda", baseSalary: 1_685_000, level: -3 },
    { code: "I/b", name: "Juru Muda Tingkat I", baseSalary: 1_761_000, level: -2 },
    { code: "I/c", name: "Juru", baseSalary: 1_840_000, level: -1 },
    { code: "I/d", name: "Juru Tingkat I", baseSalary: 1_921_000, level: 0 },
    { code: "II/a", name: "Pengatur Muda", baseSalary: 2_184_000, level: 1 },
    { code: "II/b", name: "Pengatur Muda Tingkat I", baseSalary: 2_385_000, level: 2 },
    { code: "II/c", name: "Pengatur", baseSalary: 2_487_000, level: 3 },
    { code: "II/d", name: "Pengatur Tingkat I", baseSalary: 2_592_000, level: 4 },
    { code: "III/a", name: "Penata Muda", baseSalary: 2_785_000, level: 5 },
    { code: "III/b", name: "Penata Muda Tingkat I", baseSalary: 2_903_000, level: 6 },
    { code: "III/c", name: "Penata", baseSalary: 3_026_000, level: 7 },
    { code: "III/d", name: "Penata Tingkat I", baseSalary: 3_154_000, level: 8 },
    { code: "IV/a", name: "Pembina", baseSalary: 3_287_000, level: 9 },
    { code: "IV/b", name: "Pembina Tingkat I", baseSalary: 3_426_000, level: 10 },
    { code: "IV/c", name: "Pembina Utama Muda", baseSalary: 3_571_000, level: 11 },
  ];
  const grades = await Promise.all(
    gradeDefs.map((g) =>
      prisma.payGrade.upsert({ where: { code: g.code }, update: {}, create: g }),
    ),
  );

  // Admin & HR users
  console.log("Seeding users...");
  await prisma.user.upsert({
    where: { email: "admin@unigamalang.ac.id" },
    update: {},
    create: {
      email: "admin@unigamalang.ac.id",
      passwordHash: await bcrypt.hash("admin123", 10),
      name: "Administrator SDM",
      role: "ADMIN",
    },
  });
  await prisma.user.upsert({
    where: { email: "hr@unigamalang.ac.id" },
    update: {},
    create: {
      email: "hr@unigamalang.ac.id",
      passwordHash: await bcrypt.hash("hr12345", 10),
      name: "Staf Bagian Kepegawaian",
      role: "HR",
    },
  });
  await prisma.user.upsert({
    where: { email: "rektor@unigamalang.ac.id" },
    update: {},
    create: {
      email: "rektor@unigamalang.ac.id",
      passwordHash: await bcrypt.hash("rektor123", 10),
      name: "Prof. Dr. Hj. Ernani Hadiyati, S.E., M.S.",
      role: "RECTOR",
    },
  });
  await prisma.user.upsert({
    where: { email: "yayasan@unigamalang.ac.id" },
    update: {},
    create: {
      email: "yayasan@unigamalang.ac.id",
      passwordHash: await bcrypt.hash("yayasan123", 10),
      name: "Sekretaris Yayasan Pembina Pendidikan Gajayana",
      role: "FOUNDATION",
    },
  });

  console.log("Seeding employees...");

  const today = new Date();

  interface DosenSeed {
    nip: string;
    nidn: string;
    fullName: string;
    gender: "MALE" | "FEMALE";
    birthDate: string;
    email: string;
    hireDate: string;
    lastIncrementDate: string | null;
    baseSalary: number;
    rankCode: "ASISTEN_AHLI" | "LEKTOR" | "LEKTOR_KEPALA" | "GURU_BESAR";
    faculty: string;
    studyProgram: string;
    bkd: Array<{ year: string; semester: "GANJIL" | "GENAP"; sksLoad: number; status: "PASS" | "FAIL" | "PENDING" }>;
  }

  const dosen: DosenSeed[] = [
    {
      nip: "197305101999031002",
      nidn: "0710057301",
      fullName: "Dr. Ir. Bambang Setiawan, M.T.",
      gender: "MALE",
      birthDate: "1973-05-10",
      email: "bambang.setiawan@unigamalang.ac.id",
      hireDate: "1999-03-01",
      lastIncrementDate: "2024-03-01",
      baseSalary: 5_980_000,
      rankCode: "LEKTOR_KEPALA",
      faculty: "Fakultas Teknik",
      studyProgram: "Teknik Informatika",
      bkd: [
        { year: "2024/2025", semester: "GENAP", sksLoad: 14, status: "PASS" },
        { year: "2025/2026", semester: "GANJIL", sksLoad: 15, status: "PASS" },
      ],
    },
    {
      nip: "198208152008012011",
      nidn: "0815088201",
      fullName: "Dr. Siti Nurhaliza, S.E., M.M.",
      gender: "FEMALE",
      birthDate: "1982-08-15",
      email: "siti.nurhaliza@unigamalang.ac.id",
      hireDate: "2008-01-02",
      lastIncrementDate: "2024-05-01",
      baseSalary: 4_720_000,
      rankCode: "LEKTOR",
      faculty: "Fakultas Ekonomi dan Bisnis",
      studyProgram: "Manajemen",
      bkd: [
        { year: "2024/2025", semester: "GENAP", sksLoad: 12, status: "PASS" },
        { year: "2025/2026", semester: "GANJIL", sksLoad: 13, status: "PASS" },
      ],
    },
    {
      nip: "199103052018031004",
      nidn: "0305039101",
      fullName: "Rizky Pratama, S.Kom., M.Kom.",
      gender: "MALE",
      birthDate: "1991-03-05",
      email: "rizky.pratama@unigamalang.ac.id",
      hireDate: "2018-03-01",
      lastIncrementDate: "2024-03-01",
      baseSalary: 3_710_000,
      rankCode: "ASISTEN_AHLI",
      faculty: "Fakultas Teknik",
      studyProgram: "Sistem Informasi",
      bkd: [
        { year: "2024/2025", semester: "GENAP", sksLoad: 16, status: "PASS" },
        { year: "2025/2026", semester: "GANJIL", sksLoad: 16, status: "FAIL" },
      ],
    },
    {
      nip: "196501011990031005",
      nidn: "0101016501",
      fullName: "Prof. Dr. H. Abdul Rachman, M.Hum.",
      gender: "MALE",
      birthDate: "1965-01-01",
      email: "abdul.rachman@unigamalang.ac.id",
      hireDate: "1990-03-01",
      lastIncrementDate: "2024-03-01",
      baseSalary: 6_810_000,
      rankCode: "GURU_BESAR",
      faculty: "Fakultas Hukum",
      studyProgram: "Ilmu Hukum",
      bkd: [
        { year: "2024/2025", semester: "GENAP", sksLoad: 12, status: "PASS" },
        { year: "2025/2026", semester: "GANJIL", sksLoad: 12, status: "PASS" },
      ],
    },
    {
      nip: "198711112015041003",
      nidn: "1111118701",
      fullName: "Dewi Anggraeni, S.Pd., M.Pd.",
      gender: "FEMALE",
      birthDate: "1987-11-11",
      email: "dewi.anggraeni@unigamalang.ac.id",
      hireDate: "2015-04-01",
      lastIncrementDate: "2024-04-01",
      baseSalary: 4_120_000,
      rankCode: "LEKTOR",
      faculty: "Fakultas Keguruan dan Ilmu Pendidikan",
      studyProgram: "Pendidikan Bahasa Inggris",
      bkd: [
        { year: "2024/2025", semester: "GENAP", sksLoad: 14, status: "PASS" },
        { year: "2025/2026", semester: "GANJIL", sksLoad: 14, status: "PASS" },
      ],
    },
  ];

  for (const d of dosen) {
    const rank = ranks.find((r) => r.code === d.rankCode)!;
    const hire = new Date(d.hireDate);
    const last = d.lastIncrementDate ? new Date(d.lastIncrementDate) : null;
    const nextIncrement = computeNextIncrementDate({ hireDate: hire, lastIncrementDate: last });
    const employee = await prisma.employee.upsert({
      where: { nip: d.nip },
      update: { email: d.email, fullName: d.fullName },
      create: {
        nip: d.nip,
        fullName: d.fullName,
        gender: d.gender,
        birthDate: new Date(d.birthDate),
        email: d.email,
        type: "DOSEN",
        hireDate: hire,
        currentBaseSalary: d.baseSalary,
        lastIncrementDate: last,
        nextIncrementDate: nextIncrement,
        status: "ACTIVE",
        dosenDetail: {
          create: {
            nidn: d.nidn,
            academicRankId: rank.id,
            lastRankDate: new Date(d.hireDate),
            faculty: d.faculty,
            studyProgram: d.studyProgram,
          },
        },
      },
    });
    for (const b of d.bkd) {
      await prisma.bkdEvaluation.upsert({
        where: {
          employeeId_academicYear_semester: {
            employeeId: employee.id,
            academicYear: b.year,
            semester: b.semester,
          },
        },
        update: {},
        create: {
          employeeId: employee.id,
          academicYear: b.year,
          semester: b.semester,
          sksLoad: b.sksLoad,
          status: b.status,
        },
      });
    }
  }

  interface StaffSeed {
    nip: string;
    fullName: string;
    gender: "MALE" | "FEMALE";
    birthDate: string;
    email: string;
    hireDate: string;
    lastIncrementDate: string | null;
    baseSalary: number;
    gradeCode: string;
    unit: string;
    position: string;
    scores: Array<{ year: number; score: number; rating: "EXCELLENT" | "GOOD" | "SUFFICIENT" | "POOR" | "VERY_POOR" }>;
  }

  const staff: StaffSeed[] = [
    {
      nip: "198503212010011007",
      fullName: "Hari Setiawan, S.Kom.",
      gender: "MALE",
      birthDate: "1985-03-21",
      email: "hari.setiawan@unigamalang.ac.id",
      hireDate: "2010-01-01",
      lastIncrementDate: "2024-01-01",
      baseSalary: 3_026_000,
      gradeCode: "III/c",
      unit: "Biro Administrasi Umum",
      position: "Kepala Sub Bagian Kepegawaian",
      scores: [
        { year: today.getFullYear() - 1, score: 86.5, rating: "EXCELLENT" },
      ],
    },
    {
      nip: "199007122016022005",
      fullName: "Rina Kartika, A.Md.",
      gender: "FEMALE",
      birthDate: "1990-07-12",
      email: "rina.kartika@unigamalang.ac.id",
      hireDate: "2016-02-01",
      lastIncrementDate: "2024-02-01",
      baseSalary: 2_487_000,
      gradeCode: "II/c",
      unit: "Perpustakaan",
      position: "Pustakawan Pelaksana",
      scores: [
        { year: today.getFullYear() - 1, score: 78.0, rating: "GOOD" },
      ],
    },
    {
      nip: "198212202009031009",
      fullName: "Budi Santosa, S.E.",
      gender: "MALE",
      birthDate: "1982-12-20",
      email: "budi.santosa@unigamalang.ac.id",
      hireDate: "2009-03-15",
      lastIncrementDate: "2024-03-15",
      baseSalary: 2_903_000,
      gradeCode: "III/b",
      unit: "Biro Keuangan",
      position: "Bendahara Pengeluaran",
      scores: [
        { year: today.getFullYear() - 1, score: 70.0, rating: "SUFFICIENT" },
      ],
    },
    {
      nip: "199506082019042012",
      fullName: "Fitria Ramadhani, S.Pd.",
      gender: "FEMALE",
      birthDate: "1995-06-08",
      email: "fitria.r@unigamalang.ac.id",
      hireDate: "2019-04-01",
      lastIncrementDate: null,
      baseSalary: 2_785_000,
      gradeCode: "III/a",
      unit: "Biro Akademik",
      position: "Staf Layanan Akademik",
      scores: [
        { year: today.getFullYear() - 1, score: 84.0, rating: "EXCELLENT" },
      ],
    },
    {
      nip: "198001152005011003",
      fullName: "Agus Wibowo, S.Kom., M.T.",
      gender: "MALE",
      birthDate: "1980-01-15",
      email: "agus.wibowo@unigamalang.ac.id",
      hireDate: "2005-01-01",
      lastIncrementDate: "2024-01-01",
      baseSalary: 3_287_000,
      gradeCode: "IV/a",
      unit: "Pusat Sistem Informasi",
      position: "Kepala PSI",
      scores: [
        { year: today.getFullYear() - 1, score: 90.0, rating: "EXCELLENT" },
      ],
    },
  ];

  for (const s of staff) {
    const grade = grades.find((g) => g.code === s.gradeCode)!;
    const hire = new Date(s.hireDate);
    const last = s.lastIncrementDate ? new Date(s.lastIncrementDate) : null;
    const nextIncrement = computeNextIncrementDate({ hireDate: hire, lastIncrementDate: last });
    const employee = await prisma.employee.upsert({
      where: { nip: s.nip },
      update: { email: s.email, fullName: s.fullName },
      create: {
        nip: s.nip,
        fullName: s.fullName,
        gender: s.gender,
        birthDate: new Date(s.birthDate),
        email: s.email,
        type: "STAFF",
        hireDate: hire,
        currentBaseSalary: s.baseSalary,
        lastIncrementDate: last,
        nextIncrementDate: nextIncrement,
        status: "ACTIVE",
        staffDetail: {
          create: {
            payGradeId: grade.id,
            lastGradeDate: new Date(s.hireDate),
            unit: s.unit,
            position: s.position,
          },
        },
      },
    });
    for (const p of s.scores) {
      await prisma.performanceScore.upsert({
        where: { employeeId_year: { employeeId: employee.id, year: p.year } },
        update: {},
        create: {
          employeeId: employee.id,
          year: p.year,
          score: p.score,
          rating: p.rating,
        },
      });
    }
  }

  // One historical increment record
  const firstEmployee = await prisma.employee.findFirst({ where: { nip: "197305101999031002" } });
  if (firstEmployee) {
    const admin = await prisma.user.findUnique({ where: { email: "admin@unigamalang.ac.id" } });
    await prisma.incrementHistory.upsert({
      where: { decreeNumber: "001/SK.KGB/UGJ/III/2024" },
      update: {},
      create: {
        employeeId: firstEmployee.id,
        previousSalary: 5_805_000,
        newSalary: 5_980_000,
        incrementAmount: 175_000,
        effectiveDate: new Date("2024-03-01"),
        decreeNumber: "001/SK.KGB/UGJ/III/2024",
        decreeDate: new Date("2024-02-15"),
        signedByName: "Prof. Dr. Hj. Ernani Hadiyati, S.E., M.S.",
        signedByPosition: "Rektor Universitas Gajayana Malang",
        reason: "Kenaikan gaji berkala reguler setiap dua tahun.",
        status: "ISSUED",
        generatedById: admin?.id,
      },
    });
  }

  // Link each employee with a self-service user account.
  console.log("Seeding employee user accounts...");
  const defaultEmployeePassword = await bcrypt.hash("pegawai123", 10);
  const allEmployees = await prisma.employee.findMany({ where: { email: { not: null } } });
  for (const emp of allEmployees) {
    if (!emp.email) continue;
    const existing = await prisma.user.findUnique({ where: { email: emp.email } });
    if (existing) continue;
    await prisma.user.create({
      data: {
        email: emp.email,
        passwordHash: defaultEmployeePassword,
        name: emp.fullName,
        role: "EMPLOYEE",
        employeeId: emp.id,
      },
    });
  }

  console.log("Seed complete.");
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });

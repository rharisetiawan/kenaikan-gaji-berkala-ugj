# SIM Kenaikan Gaji Berkala — Universitas Gajayana

Aplikasi web untuk mengelola **Kenaikan Gaji Berkala (KGB)** Dosen dan Tenaga
Kependidikan di Universitas Gajayana. Aplikasi ini menghitung kelayakan KGB
secara otomatis, menyoroti pegawai yang akan naik gaji dalam 3 bulan ke depan,
dan menerbitkan **Surat Keputusan (SK)** dalam format PDF.

> **Catatan konvensi:** nama model basis data, kolom, variabel, dan fungsi
> ditulis dalam bahasa Inggris. Seluruh antarmuka pengguna, label dasbor, dan
> isi dokumen PDF ditulis dalam **Bahasa Indonesia**.

## Fitur Utama

- **Dasbor KGB** — menghitung dan menyoroti pegawai yang layak naik gaji dalam
  3 bulan mendatang, lengkap dengan estimasi tambahan beban gaji bulanan.
- **Evaluasi kelayakan otomatis**
  - **Dosen**: Masa Kerja + Jabatan Akademik + hasil BKD dua semester terakhir.
  - **Tenaga Kependidikan**: Golongan + Nilai Kinerja Tahunan.
- **Manajemen data pegawai**: biodata, Jabatan Akademik (Asisten Ahli → Guru
  Besar), Golongan (II/a → IV/c), BKD, penilaian kinerja tahunan.
- **Riwayat KGB** lengkap sebagai jejak audit, termasuk gaji lama/baru, TMT,
  nomor SK, penandatangan, dan dasar penerbitan.
- **Generator SK PDF** — mencetak Surat Keputusan Rektor dalam Bahasa
  Indonesia, termasuk nominal gaji dan nilai terbilang.
- **Autentikasi** cookie + JWT (peran `ADMIN`, `HR`, `VIEWER`).

## Tumpukan Teknologi

- [Next.js 16](https://nextjs.org/) (App Router, Server Components, Server
  Actions)
- TypeScript + Tailwind CSS v4
- Prisma 7 + PostgreSQL (via `@prisma/adapter-pg`)
- [`@react-pdf/renderer`](https://react-pdf.org/) untuk pembuatan PDF SK
- `jose` untuk JWT, `bcryptjs` untuk hashing password

## Struktur Direktori

```
prisma/
  schema.prisma         # Skema basis data (bahasa Inggris)
  seed.ts               # Data contoh (5 dosen + 5 tendik)
src/
  app/
    (app)/              # Halaman berbasis autentikasi
      dashboard/        # Beranda dengan ringkasan KGB
      employees/        # Daftar & detail pegawai
      evaluations/      # Rekap kelayakan KGB
      increments/       # Riwayat SK
    api/sk/[id]/        # Endpoint unduh PDF SK
    login/              # Halaman masuk
  lib/
    auth.ts             # Sesi cookie + JWT
    eligibility.ts      # Logika inti kelayakan KGB
    employees.ts        # Query pegawai + evaluasi
    format.ts           # Format tanggal, rupiah, terbilang (ID)
    pdf/                # Dokumen React-PDF untuk SK
    prisma.ts           # Instance Prisma Client
```

## Menjalankan Secara Lokal

### 1. Prasyarat

- Node.js 20+ (disarankan 22)
- PostgreSQL 14+ yang dapat diakses

### 2. Klon & pasang dependensi

```bash
git clone https://github.com/<org>/kenaikan-gaji-berkala-ugj.git
cd kenaikan-gaji-berkala-ugj
npm install
```

### 3. Konfigurasi environment

```bash
cp .env.example .env
# lalu sesuaikan DATABASE_URL dan AUTH_SECRET
```

### 4. Migrasi + data contoh

```bash
npx prisma migrate deploy
npx tsx prisma/seed.ts
```

### 5. Jalankan server pengembangan

```bash
npm run dev
# buka http://localhost:3000/login
```

### Akun Demo

| Peran      | Email                           | Kata Sandi  |
|------------|---------------------------------|-------------|
| ADMIN      | admin@unigamalang.ac.id         | admin123    |
| HR         | hr@unigamalang.ac.id            | hr12345     |
| RECTOR     | rektor@unigamalang.ac.id        | rektor123   |
| FOUNDATION | yayasan@unigamalang.ac.id       | yayasan123  |
| EMPLOYEE   | dewi.anggraeni@unigamalang.ac.id | pegawai123 |

Akun pegawai lain mengikuti pola `<nama>@unigamalang.ac.id` dengan kata sandi `pegawai123`.

## Logika Bisnis KGB (ringkasan)

- **Interval kenaikan:** setiap 2 tahun (`INCREMENT_INTERVAL_YEARS`) dihitung
  dari tanggal TMT terakhir (atau tanggal mulai kerja jika belum pernah naik).
- **Besaran kenaikan:** 3% dari gaji pokok berjalan
  (`INCREMENT_PERCENT`), dibulatkan ke kelipatan Rp 100.
- **Jendela waktu "ELIGIBLE":** TMT proyeksi berada ≤ 90 hari ke depan (atau
  sudah terlewati).
- **Syarat Dosen:** dua semester BKD terakhir berstatus `PASS`.
- **Syarat Tenaga Kependidikan:** nilai kinerja tahunan terakhir ≥ 76
  (`STAFF_MIN_PERFORMANCE_SCORE`).

Semua ambang batas dan parameter tersentralisasi di
[`src/lib/eligibility.ts`](src/lib/eligibility.ts) sehingga mudah disesuaikan
dengan kebijakan internal universitas.

## Peringatan Keamanan

- Ganti `AUTH_SECRET` dengan nilai acak yang kuat sebelum deploy produksi.
- Hash password tersimpan dengan `bcryptjs` (cost 10).
- Seluruh Server Action memeriksa peran (`ADMIN`/`HR`/`RECTOR`/`FOUNDATION`) sebelum mengubah data.
- Rute PDF `/api/sk/[id]` dan `/api/requests/[id]/surat-pengantar.pdf` memerlukan sesi valid.
- Berkas unggahan pegawai disimpan di direktori `uploads/` (diabaikan oleh git) dan disajikan
  melalui `/api/documents/[id]` dengan pemeriksaan kepemilikan.

## Alur Persetujuan KGB

1. **Pegawai** (Dosen atau Tenaga Kependidikan) masuk ke portal `/my-requests`,
   mengunggah SKP, SK Berkala terakhir (dan Bukti Tridharma bila Dosen), lalu mengirim pengajuan.
2. **Bagian Kepegawaian (HR)** memverifikasi kelengkapan dokumen di `/hr`.
   Setelah disetujui, sistem otomatis membuat **Surat Pengantar Rektor**.
3. **Rektor** menandatangani Surat Pengantar di `/rector` dan meneruskannya ke Yayasan.
4. **Yayasan (Foundation)** menyetujui dan menerbitkan SK Kenaikan Gaji Berkala di `/foundation`;
   gaji pokok pegawai otomatis diperbarui.

## Lisensi

Internal — Universitas Gajayana Malang.

import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "HRIS Universitas Gajayana",
  description:
    "Sistem Informasi Kepegawaian Universitas Gajayana Malang — manajemen data pegawai, evaluasi kinerja, kenaikan gaji berkala, dan administrasi HR.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-slate-50 text-slate-900">
        {children}
      </body>
    </html>
  );
}

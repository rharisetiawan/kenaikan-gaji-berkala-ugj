import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SIM Kenaikan Gaji Berkala - Universitas Gajayana",
  description:
    "Sistem Informasi Manajemen Kenaikan Gaji Berkala Dosen dan Tenaga Kependidikan Universitas Gajayana.",
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

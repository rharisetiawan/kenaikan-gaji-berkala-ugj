import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { LoginForm } from "./LoginForm";

export default async function LoginPage() {
  const session = await getSession();
  if (session) redirect("/dashboard");

  return (
    <div className="flex min-h-screen flex-1 items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-[var(--brand)] text-white shadow">
            <span className="text-2xl font-bold">UG</span>
          </div>
          <h1 className="text-xl font-semibold text-slate-900">
            SIM Kenaikan Gaji Berkala
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Universitas Gajayana
          </p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-base font-semibold text-slate-800">Masuk ke Akun Anda</h2>
          <LoginForm />
          <div className="mt-6 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
            <p className="font-medium text-slate-700">Akun demo:</p>
            <p>Admin: <span className="font-mono">admin@ugj.ac.id</span> / <span className="font-mono">admin123</span></p>
            <p>SDM: <span className="font-mono">hr@ugj.ac.id</span> / <span className="font-mono">hr12345</span></p>
          </div>
        </div>
        <p className="mt-6 text-center text-xs text-slate-500">
          © {new Date().getFullYear()} Universitas Gajayana Malang
        </p>
      </div>
    </div>
  );
}

import Image from "next/image";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { LoginForm } from "./LoginForm";

export default async function LoginPage() {
  const session = await getSession();
  if (session) redirect("/dashboard");

  return (
    <div className="flex min-h-screen flex-1 items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-20 w-20 items-center justify-center">
            <Image
              src="/brand/uniga-logo.png"
              alt="Logo Universitas Gajayana Malang"
              width={96}
              height={96}
              className="h-20 w-20 object-contain drop-shadow-sm"
              priority
            />
          </div>
          <h1 className="text-xl font-semibold text-slate-900">
            SIM Kenaikan Gaji Berkala
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Universitas Gajayana Malang (UNIGA Malang)
          </p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-base font-semibold text-slate-800">Masuk ke Akun Anda</h2>
          <LoginForm />
          <div className="mt-6 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
            <p className="font-medium text-slate-700">Akun demo:</p>
            <ul className="mt-1 space-y-0.5">
              <li>
                Pegawai: <span className="font-mono">dewi.anggraeni@unigamalang.ac.id</span> /{" "}
                <span className="font-mono">pegawai123</span>
              </li>
              <li>
                Kepegawaian (HR): <span className="font-mono">hr@unigamalang.ac.id</span> /{" "}
                <span className="font-mono">hr12345</span>
              </li>
              <li>
                Rektor: <span className="font-mono">rektor@unigamalang.ac.id</span> /{" "}
                <span className="font-mono">rektor123</span>
              </li>
              <li>
                Yayasan: <span className="font-mono">yayasan@unigamalang.ac.id</span> /{" "}
                <span className="font-mono">yayasan123</span>
              </li>
              <li>
                Admin: <span className="font-mono">admin@unigamalang.ac.id</span> /{" "}
                <span className="font-mono">admin123</span>
              </li>
            </ul>
          </div>
        </div>
        <p className="mt-6 text-center text-xs text-slate-500">
          © {new Date().getFullYear()} Universitas Gajayana Malang · www.unigamalang.ac.id
        </p>
      </div>
    </div>
  );
}

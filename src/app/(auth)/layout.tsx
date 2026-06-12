import { LogoAssemblage } from "@/components/LogoAssemblage";

export default function AuthLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 py-8">
      <div className="mb-6 text-center">
        <div className="mb-3 flex justify-center">
          <LogoAssemblage />
        </div>
        <h1 className="text-lg font-semibold text-gray-800">
          Suivi des chantiers scolaires
        </h1>
        <p className="text-sm text-gray-500">
          Ministère de l&apos;Éducation Nationale — Côte d&apos;Ivoire
        </p>
      </div>
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-sm sm:p-8">
        {children}
      </div>
    </div>
  );
}

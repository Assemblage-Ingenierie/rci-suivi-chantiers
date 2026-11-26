import { Logo } from "@/components/Logo";
import { MARQUE } from "@/theme/marque";

export default function AuthLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 py-8">
      <div className="mb-6 flex flex-col items-center text-center">
        <Logo />
        <p className="mt-2 text-sm text-texte-2">{MARQUE.sousTitre}</p>
      </div>
      <div className="carte w-full max-w-md p-6 sm:p-8">{children}</div>
    </div>
  );
}

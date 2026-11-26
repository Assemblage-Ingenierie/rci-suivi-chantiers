import Image from "next/image";
import { MARQUE } from "@/theme/marque";

/** Logo de l'application : image si définie dans src/theme/marque.ts, sinon sigle texte. */
export function Logo({ surAccent = false }: { surAccent?: boolean }) {
  if (MARQUE.logo) {
    return (
      <Image
        src={MARQUE.logo.src}
        width={MARQUE.logo.largeur}
        height={MARQUE.logo.hauteur}
        alt={MARQUE.logo.alt}
        priority
      />
    );
  }
  return (
    <div className="select-none leading-none">
      <span
        className={`block text-xl font-bold tracking-wide ${surAccent ? "text-sur-accent" : "text-accent"}`}
      >
        {MARQUE.sigle}
      </span>
      <span className={`block text-sm ${surAccent ? "text-sur-accent/80" : "text-texte-2"}`}>
        {MARQUE.nomApplication}
      </span>
    </div>
  );
}

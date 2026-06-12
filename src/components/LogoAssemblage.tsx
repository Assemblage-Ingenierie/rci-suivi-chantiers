/** Logo texte Assemblage ingénierie (style PEEB Jordan). */
export function LogoAssemblage({ surFondSombre = false }: { surFondSombre?: boolean }) {
  return (
    <div className="select-none leading-none">
      <span
        className={`block text-xl font-bold tracking-tight ${
          surFondSombre ? "text-assemblage" : "text-assemblage"
        }`}
      >
        Assemblage
      </span>
      <span
        className={`block text-sm font-medium ${
          surFondSombre ? "text-white/80" : "text-gray-500"
        }`}
      >
        ingénierie
      </span>
    </div>
  );
}

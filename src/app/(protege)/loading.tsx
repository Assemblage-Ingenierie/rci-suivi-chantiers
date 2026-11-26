/**
 * Affiché immédiatement au clic sur un onglet, pendant que le serveur prépare
 * la page (données Supabase). Le menu reste affiché : seul le contenu attend.
 */
export default function Chargement() {
  return (
    <div className="mx-auto max-w-[1400px] p-4 lg:p-6" aria-busy="true" aria-live="polite">
      <p className="sr-only">Chargement…</p>
      <div className="animate-pulse space-y-4">
        <div className="space-y-2">
          <div className="h-7 w-64 rounded bg-surface-2" />
          <div className="h-4 w-96 max-w-full rounded bg-surface-2" />
        </div>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="carte h-24 bg-surface-2/60" />
          ))}
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="carte h-64 bg-surface-2/60" />
          <div className="carte h-64 bg-surface-2/60" />
        </div>
      </div>
    </div>
  );
}

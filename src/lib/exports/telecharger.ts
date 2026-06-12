/** Déclenche le téléchargement d'un Blob côté navigateur. */
export function telechargerBlob(blob: Blob, nomFichier: string) {
  const url = URL.createObjectURL(blob);
  const lien = document.createElement("a");
  lien.href = url;
  lien.download = nomFichier;
  document.body.appendChild(lien);
  lien.click();
  lien.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

/** Nom de fichier sûr : minuscules, sans accents ni caractères spéciaux. */
export function nomFichierSur(base: string): string {
  return base
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9-_ ]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .toLowerCase();
}

export function horodatage(): string {
  return new Date().toISOString().slice(0, 10);
}

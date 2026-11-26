/**
 * Connexion des CSTC par identifiant + code PIN.
 *
 * Supabase Auth exige un email : chaque compte CSTC reçoit un email technique
 * `<identifiant>@cstc.pateb.invalid`, jamais affiché ni utilisé pour écrire
 * (le domaine `.invalid` est réservé et ne peut recevoir aucun message).
 * Le PIN est le mot de passe Supabase : 6 chiffres (longueur minimale par
 * défaut des mots de passe Supabase).
 */
export const DOMAINE_CSTC = "cstc.pateb.invalid";
export const LONGUEUR_PIN = 6;

/** Identifiant : minuscules, chiffres et tirets, 3 à 40 caractères (cf. contrainte SQL). */
const FORMAT_IDENTIFIANT = /^[a-z0-9][a-z0-9-]{2,39}$/;

export function normaliserIdentifiant(saisie: string): string {
  return saisie.trim().toLowerCase();
}

export function identifiantValide(identifiant: string): boolean {
  return FORMAT_IDENTIFIANT.test(identifiant);
}

export function pinValide(pin: string): boolean {
  return new RegExp(`^\\d{${LONGUEUR_PIN}}$`).test(pin);
}

export function emailTechniqueCstc(identifiant: string): string {
  return `${normaliserIdentifiant(identifiant)}@${DOMAINE_CSTC}`;
}

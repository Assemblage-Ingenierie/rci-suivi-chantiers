import { redirect } from "next/navigation";

/** L'onglet « Difficultés » est devenu « Alertes » (anciens liens et favoris). */
export default function PageDifficultes() {
  redirect("/alertes");
}

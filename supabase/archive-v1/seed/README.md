# Seed de développement — appliqué le 12/06/2026

[seed.sql](seed.sql) a été exécuté sur le projet EXTERNAL. Un garde-fou empêche un double-seed (erreur si `chantierci_lots` n'est pas vide). Pour re-seeder : vider les tables `chantierci_*` et supprimer les utilisateurs `@chantierci.test`, puis relancer les 3 sections du fichier dans l'ordre.

## Comptes de test

Mot de passe commun : **`ChantierCI!2026`**

| Email | Rôle | Périmètre | Nom |
|---|---|---|---|
| `admin@chantierci.test` | admin | Tout | Clément DAVY |
| `national@chantierci.test` | national | Tout (lecture) + paiements | Serge BALLO |
| `regional.nord@chantierci.test` | regional | Région Nord (12 étab.) | Tidiane SANOGO |
| `regional.sud@chantierci.test` | regional | Région Sud (14 étab.) | Marie-Laure ABBÉ |
| `coges.nord@chantierci.test` | coges | Lot Nord (12 étab.) | Brahima KONÉ |
| `coges.sud@chantierci.test` | coges | Lot Sud (14 étab.) | Affoué KOUAMÉ |
| `coges.est@chantierci.test` | coges | Lot Est (11 étab.) | Kouadio N'ZI |
| `coges.ouest@chantierci.test` | coges | Lot Ouest (13 étab.) | Cécile GOHOU |

## Données générées

- **4 lots** : Nord / Sud / Est / Ouest (régions homonymes)
- **50 établissements** : provinces et départements réels (Poro, Tchologo, Abidjan, Sud-Comoé, San-Pédro, Indénié-Djuablin, Gontougo, Tonkpi, Haut-Sassandra…), coordonnées GPS réalistes pour la carte
- **Statuts** : 7 non démarrés / 26 en cours / 7 arrêtés / 10 réceptionnés
- **50 marchés** : 59 à 196 M XOF, 12 entreprises fictives (BTIC, SOGECI, CBCI…), numéros `2025-MEN-TRX-XXXX`
- **136 visites** : 1-2 (constats à 0 % pour les non démarrés) ou 2-5 par chantier, avancement strictement progressif, corps d'état dérivés de l'avancement global (pondération excavation 10 / fondation 15 / verticaux 25 / charpente 15 / couverture 15 / finition 20), raisons d'arrêt renseignées sur la dernière visite des chantiers arrêtés
- **106 paiements** : avance de démarrage + décomptes, total toujours ≤ montant du marché et cohérent avec l'avancement physique (85-100 % pour les réceptionnés), saisis par le compte national
- **4 commentaires régionaux** (lots Nord et Sud)

Vérifications passées : aucun dépassement de marché, aucune régression d'avancement, statut établissement = statut de la dernière visite, périmètres RLS corrects pour chaque persona.

## ⚠️ Effet de bord connu (projet partagé PEEB)

Le trigger PEEB `on_auth_user_created` a créé **8 profils PEEB `is_approved = true`** pour les comptes `@chantierci.test` (ils apparaissent dans l'admin PEEB comme viewers). Nettoyage possible côté PEEB, à votre main :

```sql
delete from public.profiles
where id in (select id from auth.users where email like '%@chantierci.test');
```

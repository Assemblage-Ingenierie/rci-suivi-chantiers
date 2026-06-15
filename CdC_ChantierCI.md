# Cahier des charges — Application de suivi de chantiers scolaires
**Projet :** Suivi de construction d'établissements scolaires — Côte d'Ivoire  
**Maître d'ouvrage :** Ministère de l'Éducation Nationale (MEN)  
**AMO :** Assemblage Ingénierie  
**Date :** Juin 2026  
**Version :** 2.0  
**État :** V1 livrée et déployée (Vercel + GitHub `Assemblage-Ingenierie/rci-suivi-chantiers`) ; évolutions v2 livrées.

---

## 0. Journal des versions

### Version 2.0 (juin 2026) — évolutions post-livraison
- **Nouveau rôle `men_viewer`** (MEN — Décideur) : lecture intégrale + exports, **aucune écriture**.
- **Archivage au lieu de suppression** des établissements **et** des fiches de visite (réversible). Les éléments archivés disparaissent des tableaux, du dashboard, de la carte et du mode hors ligne ; ils restent consultables et restaurables par l'admin.
- **Statut de l'établissement dérivé automatiquement** de la dernière visite non archivée (trigger base de données) — il n'est plus saisi à la main.
- **Édition des marchés** ouverte aux rôles national + admin (création, modification) ; **édition et suppression des paiements** ouvertes aux rôles national + admin.
- **Marché multi-établissements** : un même marché (entreprise + n°) peut couvrir plusieurs établissements, chacun avec son **montant propre** ; vue regroupée par n° de marché avec agrégats.
- **Création d'établissement** depuis l'interface (admin), en plus de l'import CSV.
- **Carte** : bouton d'agrandissement plein écran.
- **Dashboard** : graphique des visites de chantiers par personnel dans le temps (regroupable par jour / semaine / mois / trimestre).
- **Ergonomie mobile** : barre latérale repliable (menu hamburger + overlay) sur petits écrans.
- **Édition des fiches de visite** (côté COGES, y compris hors ligne, et correction par l'admin).

### Version 1.x (juin 2026) — livraison initiale
Application complète en 10 étapes (schéma + RLS, seed, auth, offline, COGES, dashboard MEN, marchés, régional, exports, admin).

---

## 1. Contexte et objectifs

### 1.1 Contexte
L'application supporte le suivi de **350 chantiers de construction scolaire** répartis sur le territoire ivoirien, financés et pilotés par le MEN. Les chantiers démarrent de façon échelonnée. Les acteurs terrain (COGES) opèrent souvent dans des zones à connectivité intermittente ou nulle.

### 1.2 Objectifs
- Centraliser les données de suivi de chantier (avancement physique, financier, incidents)
- Permettre la saisie terrain par des utilisateurs non-techniciens, y compris hors ligne
- Offrir une vision consolidée en temps réel aux niveaux régional et national
- Générer des rapports exportables (PDF, Word, Excel)

---

## 2. Stack technique

| Composant | Technologie |
|---|---|
| Frontend | Next.js 14 (App Router, TypeScript) |
| Backend / BDD | Supabase (PostgreSQL + Auth + Storage + RLS) |
| Hébergement | Vercel |
| Stockage photos | Supabase Storage (compression côté client avant upload) |
| Offline / sync | Service Worker + IndexedDB (Workbox ou idb) |
| Exports | jsPDF / SheetJS (xlsx) / docx-js |
| Cartographie | Leaflet + tuiles OpenStreetMap (gratuit, léger) |
| UI | Tailwind CSS — design inspiré PEEB Jordan (sidebar sombre, cartes blanches, accents rouges Assemblage) |

### 2.1 Contraintes de performance
- Cible : ~100 utilisateurs simultanés
- Interface mobile-first, chargement initial < 3 s sur 3G
- Compression images côté client avant upload : cible < 500 Ko/photo (`browser-image-compression`)
- Pagination côté serveur sur tous les tableaux (jamais de SELECT * sans LIMIT/OFFSET)
- Mode offline complet pour les COGES : saisie, draft, photos mises en queue de sync

### 2.2 Stratégie offline / synchronisation
- **Service Worker** intercepte les requêtes Supabase et les met en cache (lecture) ou en queue (écriture)
- Les données en lecture (liste des établissements du lot) sont pré-chargées dans **IndexedDB** à la première connexion et à chaque ouverture de session avec réseau disponible
- Les saisies de visites (formulaire + photos) sont stockées localement dans IndexedDB avec statut `pending_sync`
- Dès que la connexion est rétablie, une **background sync** envoie automatiquement les entrées en attente à Supabase
- Un badge visuel indique le nombre d'entrées en attente de synchronisation
- Un **bouton "Synchroniser maintenant"** est toujours visible quand des entrées sont en attente (comportement de base, tous navigateurs)
- La background sync automatique (sans action utilisateur) est activée si le navigateur la supporte (Chrome Android) — sur Safari iOS, le bouton manuel est le seul mécanisme
- L'`id` de chaque visite est généré **côté client** au moment de la saisie : la synchronisation est **idempotente** (un envoi en double est détecté et ignoré), ce qui évite les conflits de duplication
- Les visites mises en file peuvent être **modifiées** localement avant synchronisation ; une visite déjà synchronisée est modifiable directement (mise à jour serveur)
- La bibliothèque de compression d'images est **incluse statiquement** dans le bundle de l'interface COGES (et non chargée à la demande), afin que la prise de photos reste fonctionnelle même lors d'une première utilisation entièrement hors ligne

---

## 3. Modèle de données

### 3.1 Table `etablissements`
| Champ | Type | Notes |
|---|---|---|
| id | uuid PK | |
| nom | text | Nom de l'établissement |
| nom_directeur | text | |
| telephone | text | |
| email | text | |
| latitude | float | GPS |
| longitude | float | GPS |
| province | text | |
| departement | text | |
| village | text | |
| lot_id | uuid FK | FK vers `lots` |
| statut | enum | `non_demarre` / `en_cours` / `arrete` / `receptionne` — **dérivé automatiquement de la dernière visite non archivée** (trigger), non saisi manuellement |
| archive | boolean | défaut `false` — un établissement archivé est masqué partout (tableaux, dashboard, carte, hors ligne) mais restaurable par l'admin |
| created_at | timestamp | |

### 3.2 Table `marches_travaux`
Une ligne = la part d'un marché pour **un** établissement. Un même marché (même `nom_entreprise` + `numero_marche`) peut donc concerner **plusieurs établissements**, chacun avec son **propre montant** ; la vue Marchés permet de regrouper ces lignes par numéro de marché et d'en afficher les agrégats.

| Champ | Type | Notes |
|---|---|---|
| id | uuid PK | |
| etablissement_id | uuid FK | |
| nom_entreprise | text | |
| numero_marche | text | Peut être partagé entre plusieurs établissements |
| montant_marche | numeric | XOF — montant pour **cet** établissement |
| date_demarrage | date | |
| date_fin_estimative | date | |

### 3.3 Table `paiements`
| Champ | Type | Notes |
|---|---|---|
| id | uuid PK | |
| marche_id | uuid FK | FK vers `marches_travaux` |
| date_paiement | date | |
| montant | numeric | XOF |
| libelle | text | Ex. "Décompte n°1", "Avance de démarrage" |
| saisi_par | uuid FK | user_id — rôle MEN ou admin uniquement |
| created_at | timestamp | |

**Calculs dérivés (vues SQL ou côté client) :**
- `montant_paye` = SUM(paiements.montant) pour un marché donné
- `avancement_financier_pct` = montant_paye / montant_marche × 100
- `reste_a_payer` = montant_marche − montant_paye

### 3.4 Table `visites`
| Champ | Type | Notes |
|---|---|---|
| id | uuid PK | |
| etablissement_id | uuid FK | |
| date_visite | date | |
| nom_visiteur | text | Nom affiché |
| user_id | uuid FK | Compte Supabase Auth |
| statut_chantier | enum | `non_demarre` / `en_cours` / `arrete` / `receptionne` |
| avancement_reel_pct | integer | % réalisé / DQE initiale |
| pct_excavation | integer | 0–100 |
| pct_fondation | integer | 0–100 |
| pct_verticaux | integer | 0–100 |
| pct_charpente | integer | 0–100 |
| pct_couverture | integer | 0–100 |
| pct_finition | integer | 0–100 |
| commentaire | text | |
| raisons_arret | text[] | Multi-select |
| raison_arret_autre | text | Champ libre si "autre" sélectionné |
| sync_status | enum | `synced` / `pending_sync` (gestion offline) |
| archive | boolean | défaut `false` — une visite archivée est exclue de l'historique, des agrégats et du calcul du statut de l'établissement ; restaurable par l'admin |
| created_at | timestamp | |

**Valeurs `raisons_arret` :** `manque_effectif` / `manque_materiau` / `probleme_paiement` / `autre`

> Le statut de l'établissement (`etablissements.statut`) est recalculé automatiquement à chaque insertion / modification / archivage de visite : il reflète le `statut_chantier` de la dernière visite non archivée (à défaut, `non_demarre`).

### 3.5 Table `photos_visites`
| Champ | Type | Notes |
|---|---|---|
| id | uuid PK | |
| visite_id | uuid FK | |
| storage_path | text | Chemin Supabase Storage |
| url_public | text | URL signée |
| taille_ko | integer | Taille après compression |
| sync_status | enum | `synced` / `pending_sync` |
| created_at | timestamp | |

### 3.6 Table `lots`
| Champ | Type | Notes |
|---|---|---|
| id | uuid PK | |
| nom | text | Ex. "Lot Nord" |
| region | text | |

### 3.7 Table `profiles` (utilisateurs)
| Champ | Type | Notes |
|---|---|---|
| id | uuid PK | = Supabase Auth user id |
| nom_complet | text | |
| telephone | text | |
| email | text | Email dénormalisé (visible par l'admin) |
| role | enum | `coges` / `regional` / `national` / `men_viewer` / `admin` |
| lot_ids | uuid[] | Lots attribués (COGES et régional) |
| statut_compte | enum | `en_attente` / `actif` / `suspendu` |
| created_at | timestamp | |

---

## 4. Rôles et permissions

| Rôle | Établissements visibles | Saisie / édition visites | Saisie / édition paiements | Édition marchés | Exports | Archivage | Admin |
|---|---|---|---|---|---|---|---|
| **COGES** | Ses lots uniquement | Oui (les siennes) | Non | Non | Ses lots | Non | Non |
| **Régional** | Sa région | Non (lecture + commentaires) | Non | Non | Sa région | Non | Non |
| **National (MEN)** | Tous | Non | Oui | Oui | Tout | Non | Non |
| **MEN — Décideur** (`men_viewer`) | Tous | Non | Non | Non | Tout | Non | Non |
| **Admin** | Tous | Oui (toutes) | Oui | Oui | Tout | Oui | Oui |

- **MEN — Décideur (`men_viewer`)** : profil de consultation pour les décideurs. Accès en **lecture seule** identique au national (dashboard, suivi, marchés, carte, fiches, commentaires) + exports, **sans aucune action d'écriture** (aucun bouton de saisie / modification / suppression / archivage).
- L'**édition des marchés** (création, modification) et l'**édition / suppression des paiements** sont ouvertes aux rôles **national** et **admin**.
- L'**archivage / désarchivage** des établissements et des visites est réservé à l'**admin**.
- Permissions appliquées via **RLS Supabase** sur toutes les tables (les boutons masqués côté interface ne sont qu'un second niveau ; la base reste le rempart).

---

## 5. Fonctionnalités détaillées

### 5.1 Inscription et authentification
- Inscription par email + mot de passe (Supabase Auth)
- Après inscription : saisie du profil (nom, téléphone, rôle souhaité)
- Compte créé avec statut `en_attente` — aucun accès aux données avant validation
- L'admin valide le compte (et fixe son rôle réel) depuis l'interface admin ; la liste d'administration met en tête les comptes en attente
- *(La notification email automatique à l'admin lors d'une nouvelle inscription reste à activer — aucun fournisseur d'email configuré à ce stade ; cf. §8.)*
- Session protégée par JWT Supabase

> Le profil applicatif est créé par l'application à la première connexion (et non par un trigger sur `auth.users`), le projet Supabase étant mutualisé avec une autre application. La politique RLS force `statut_compte = en_attente` et `lot_ids = {}` : aucun privilège n'est auto-attribuable.

### 5.2 Interface COGES (mobile-first)
- Liste des établissements attribués, avec statut et avancement visible d'un coup d'œil
- Fiche établissement : infos générales + marché + historique des visites
- Formulaire nouvelle visite :
  - Date, statut, avancement par corps d'état (6 champs), avancement réel global
  - Upload multi-photos (compression auto < 500 Ko)
  - Commentaire libre
  - Si statut = "arrêté" : raisons en multi-select + champ texte
- **Édition d'une visite :** chaque visite de l'historique dispose d'un bouton « Modifier » (formulaire pré-rempli). Une visite en attente de synchronisation est corrigée localement ; une visite déjà synchronisée est mise à jour côté serveur.
- **Mode offline :** formulaire (création **et** édition) utilisable sans connexion, données stockées en IndexedDB, badge + bouton "Synchroniser maintenant" visibles dès qu'une entrée est en attente. La background sync automatique est activée si le navigateur la supporte (Chrome Android) ; le bouton manuel est le mécanisme de base valable sur tous les navigateurs dont Safari iOS
- **Navigation mobile :** barre latérale repliable (menu hamburger + overlay) sur petits écrans ; affichage fixe sur grand écran

### 5.3 Interface MEN — Dashboard national

#### Design
Inspiré du PEEB Jordan : sidebar de navigation sombre (fond #1C1C2E ou similaire), cartes de contenu blanches sur fond gris clair, accents couleur rouge Assemblage (#E8201A), typographie propre (Inter ou équivalent), icônes légères.

#### Bloc supérieur gauche : synthèse KPI
- Nombre d'établissements par statut
- Avancement financier global (montant payé / montant total des marchés)
- Filtres : lot, région

#### Bloc supérieur droit : carte interactive (Leaflet)
- Marqueurs pour tous les établissements
- **Mode Statut :** couleur par statut (gris = non démarré, bleu = en cours, orange = arrêté, vert = réceptionné)
- **Mode Avancement réel :** dégradé noir (0%) → rouge → orange → vert (100%)
- Filtre par lot
- Pop-up au clic : nom, statut, avancement physique, avancement financier, lien fiche
- **Bouton « Agrandir » :** affichage de la carte en plein écran (sélecteur de mode conservé, bouton de fermeture)

#### Bloc graphique : visites de chantiers par personnel
- Diagramme à barres empilées : abscisse = temps, ordonnée = nombre de visites, couleur par visiteur
- Regroupement temporel configurable : **jour / semaine / mois / trimestre**
- Les visiteurs les plus actifs sont détaillés, les autres regroupés sous « Autres »
- Exclut les visites archivées

#### Vue "Tableau de suivi des chantiers"
- Onglet dédié dans la navigation MEN
- Colonnes configurables (sélecteur show/hide)
- Champs disponibles : tous champs pertinents de `etablissements`, `marches_travaux`, `paiements` (agrégés), dernière visite
- Groupement par établissement (dernière visite par défaut, bouton "voir toutes les visites")
- Tri sur toutes les colonnes
- Filtres multi-select : lot, région, statut, entreprise, province, département
- Recherche textuelle : nom établissement, nom directeur, numéro de marché
- Pagination serveur (20 lignes / page)
- **Admin :** bouton « Nouvel établissement », colonne d'actions avec archivage / désarchivage par ligne, et bascule « Établissements archivés » pour consulter et restaurer les éléments archivés
- Les établissements archivés sont masqués par défaut

#### Vue "Marchés de travaux"
- Tableau de tous les marchés (350 lignes, pagination serveur)
- Colonnes : établissement, entreprise, numéro de marché, montant, date démarrage, date fin estimative, montant payé, avancement financier (%), reste à payer
- Filtres multi-select : lot, province, entreprise, statut chantier
- Recherche : nom établissement, numéro de marché
- Bouton "Voir les paiements" par ligne : expand inline listant les paiements enregistrés
- Saisie des paiements (rôle national/admin) : formulaire date + montant + libellé ; chaque paiement existant est **modifiable** et **supprimable** (avec confirmation)
- **Édition du marché** (rôle national/admin) : entreprise, n°, montant, dates — formulaire inline dans la ligne dépliée ; ajout d'un marché possible depuis la fiche d'un établissement qui n'en a pas encore
- **Vue groupée par n° de marché** (bascule) : regroupe les établissements partageant le même marché, avec montant total, montant payé et avancement financier agrégés, et le détail par établissement
- Export Excel et PDF du tableau (filtre actif)
- Les établissements archivés sont exclus de la vue

### 5.4 Interface Régionale
- Sous-ensemble du dashboard MEN restreint à la région de l'utilisateur
- Possibilité d'ajouter un commentaire sur un établissement (visible MEN + admin)

### 5.5 Exports

| Type | Format | Portée |
|---|---|---|
| Fiche de visite unique | PDF, Word (.docx) | 1 visite |
| Fiches de visites en batch | PDF multi-pages, ZIP de .docx | Sélection ou filtre actif |
| Tableau de suivi | Excel (.xlsx), PDF | Tout ou filtre actif |
| Tableau des marchés | Excel (.xlsx), PDF | Tout ou filtre actif |

- Les exports respectent les filtres et la sélection de colonnes actifs
- Les photos sont incluses dans les fiches de visite PDF/Word

### 5.6 Interface Admin
- Validation des comptes `en_attente`, modification de rôle (dont **MEN — Décideur**), suspension / réactivation
- Attribution des lots à un COGES ou responsable régional
- Gestion des lots (création, renommage, région)
- Import en masse des établissements (CSV) **et** création unitaire d'un établissement via formulaire
- Modification directe des fiches établissements
- **Archivage / désarchivage** des établissements (depuis le tableau de suivi) et des fiches de visite (depuis la fiche établissement) — alternative non destructive à la suppression

---

## 6. Seed de données (développement)

**50 établissements fictifs réalistes en Côte d'Ivoire :**
- Provinces et départements réels (Abidjan, Bouaké, Korhogo, San-Pédro, Man, Yamoussoukro, Daloa, Abengourou...)
- Noms plausibles ("EPP Adjouffou", "Collège Moderne de Katiola", "EPP Anonkoi 3"...)
- Entreprises ivoiriennes fictives vraisemblables (BTIC, SOGECI, CBCI...)
- Montants de marchés entre 50 M et 200 M XOF
- Statuts variés : ~15% non démarré, 50% en cours, 15% arrêté, 20% réceptionné
- 2 à 5 visites par établissement avec avancements cohérents et progressifs
- 1 à 4 paiements par marché, cohérents avec l'avancement physique
- 4 lots géographiques (Nord, Sud, Est, Ouest)
- Comptes de test : 4 COGES, 2 régionaux, 1 MEN national, 1 admin

---

## 7. Contraintes non-fonctionnelles

| Contrainte | Exigence |
|---|---|
| Langue | Français uniquement |
| Responsive | Mobile-first |
| Photos | Compression auto < 500 Ko avant upload |
| Performance | < 3 s sur 3G, pagination serveur systématique |
| Offline | Service Worker + IndexedDB + background sync |
| Sécurité | RLS sur toutes les tables, JWT Auth |
| Accessibilité | Contrastes suffisants, boutons larges (mobile terrain) |
| Navigateurs | Chrome/Safari mobile, Chrome/Firefox desktop |

---

## 8. Hors périmètre

- Notification email à l'admin lors d'une nouvelle inscription (à activer une fois un fournisseur d'email configuré)
- Notifications push
- Messagerie interne
- Intégration SIG externe
- Multi-langue
- Suppression définitive des établissements / visites (remplacée par l'archivage réversible)

---

## 9. Prompt de lancement — Claude Code

> **Note :** ce prompt correspond au lancement initial de la **V1** (10 étapes) et est conservé à titre historique. Les évolutions ultérieures sont décrites au **§0 (Journal des versions)** et intégrées dans les sections fonctionnelles ci-dessus.

```
Tu vas développer une application web complète de suivi de chantiers scolaires pour la Côte d'Ivoire, pour le Ministère de l'Éducation Nationale (MEN). L'AMO est Assemblage Ingénierie.

## Stack
- Next.js 14 (App Router, TypeScript)
- Supabase (PostgreSQL + Auth + Storage + RLS)
- Vercel (déploiement)
- Tailwind CSS
- Leaflet + OpenStreetMap (carte interactive, gratuit)
- jsPDF + SheetJS (xlsx) + docx-js (exports)
- browser-image-compression (compression photos avant upload)
- Workbox + idb (Service Worker + IndexedDB pour le mode offline)

## Design
Inspiré de l'application PEEB Jordan d'Assemblage Ingénierie :
- Sidebar de navigation sombre (fond #1C1C2E)
- Cartes de contenu blanches sur fond gris clair (#F2F2F2)
- Accents rouge Assemblage (#E8201A)
- Typographie Inter
- Icônes Lucide React
- Tableaux avec en-têtes sombres, lignes alternées, badges couleur pour les statuts

## Rôles utilisateur
4 rôles : `coges` (saisie terrain, accès restreint à ses lots), `regional` (lecture + commentaires, sa région), `national` (lecture globale + saisie paiements), `admin` (accès total + gestion utilisateurs).
Aucun accès aux données avant validation du compte par un admin (statut `en_attente`).
Toutes les permissions enforced par RLS Supabase.

## Modèle de données complet

### Table `lots`
- id uuid PK
- nom text
- region text

### Table `etablissements`
- id uuid PK
- nom text
- nom_directeur text
- telephone text
- email text
- latitude float
- longitude float
- province text
- departement text
- village text
- lot_id uuid FK -> lots
- statut enum ('non_demarre','en_cours','arrete','receptionne')
- created_at timestamp

### Table `marches_travaux`
- id uuid PK
- etablissement_id uuid FK -> etablissements
- nom_entreprise text
- numero_marche text
- montant_marche numeric (XOF)
- date_demarrage date
- date_fin_estimative date

### Table `paiements`
- id uuid PK
- marche_id uuid FK -> marches_travaux
- date_paiement date
- montant numeric (XOF)
- libelle text
- saisi_par uuid FK -> profiles
- created_at timestamp

### Table `visites`
- id uuid PK
- etablissement_id uuid FK -> etablissements
- date_visite date
- nom_visiteur text
- user_id uuid FK -> profiles
- statut_chantier enum ('non_demarre','en_cours','arrete','receptionne')
- avancement_reel_pct integer (0-100)
- pct_excavation integer
- pct_fondation integer
- pct_verticaux integer
- pct_charpente integer
- pct_couverture integer
- pct_finition integer
- commentaire text
- raisons_arret text[] -- valeurs: manque_effectif, manque_materiau, probleme_paiement, autre
- raison_arret_autre text
- sync_status enum ('synced','pending_sync')
- created_at timestamp

### Table `photos_visites`
- id uuid PK
- visite_id uuid FK -> visites
- storage_path text
- url_public text
- taille_ko integer
- sync_status enum ('synced','pending_sync')
- created_at timestamp

### Table `profiles`
- id uuid PK (= Supabase Auth user id)
- nom_complet text
- telephone text
- role enum ('coges','regional','national','admin')
- lot_ids uuid[]
- statut_compte enum ('en_attente','actif','suspendu')
- created_at timestamp

## Fonctionnalités à implémenter dans l'ordre suivant

1. **Schéma SQL + RLS** : migrations Supabase complètes, toutes les tables, politiques RLS par rôle, vues SQL pour avancement_financier_pct et montant_paye par marché

2. **Seed de données** : 50 établissements fictifs réalistes en Côte d'Ivoire (provinces/départements réels, noms plausibles, entreprises ivoiriennes fictives, marchés entre 50M et 200M XOF, statuts variés, 2-5 visites par établissement avec avancements progressifs, 1-4 paiements par marché, 4 lots géographiques Nord/Sud/Est/Ouest, comptes de test)

3. **Auth** : inscription email → profil → statut en_attente → notification admin → validation → accès

4. **Mode offline** : Service Worker (Workbox) + IndexedDB (idb) pour les COGES. Pré-chargement des établissements du lot. Queue de sync pour visites et photos. Badge + bouton "Synchroniser maintenant" toujours présents quand des entrées sont en attente (fonctionne sur tous les navigateurs, dont Safari iOS). Background sync automatique en bonus si le navigateur la supporte (Chrome Android).

5. **Interface COGES** : liste établissements (mobile-first), fiche établissement, formulaire visite avec upload photos compressées, fonctionnement offline

6. **Interface MEN — Dashboard** : KPI cards (statuts + avancement financier global), carte Leaflet avec 2 modes couleur (statut / avancement réel), tableau de suivi avec colonnes configurables / filtres multi-select / recherche / pagination serveur / exports

7. **Vue Marchés** : tableau des marchés avec paiements (voir détail + ajouter), avancement financier calculé, exports Excel/PDF

8. **Interface Régionale** : sous-ensemble dashboard MEN restreint à la région, ajout de commentaires

9. **Exports** : fiche visite PDF+Word (avec photos), batch, tableau suivi Excel/PDF, tableau marchés Excel/PDF

10. **Interface Admin** : validation comptes, attribution lots, gestion lots, import CSV établissements

## Contraintes techniques impératives
- Compression images côté client avant upload (browser-image-compression, cible < 500 Ko)
- Pagination serveur sur tous les tableaux (jamais de SELECT * sans LIMIT)
- Mobile-first, boutons larges, contrastes suffisants
- Tous les textes en français
- Pas de WidthType.PERCENTAGE dans les exports docx (utiliser DXA)

Commence par étape 1 : le schéma SQL complet avec les migrations Supabase et les politiques RLS.
```

---

*Document produit par Assemblage Ingénierie — Juin 2026*

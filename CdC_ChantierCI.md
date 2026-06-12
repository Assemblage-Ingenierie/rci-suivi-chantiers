# Cahier des charges — Application de suivi de chantiers scolaires
**Projet :** Suivi de construction d'établissements scolaires — Côte d'Ivoire  
**Maître d'ouvrage :** Ministère de l'Éducation Nationale (MEN)  
**AMO :** Assemblage Ingénierie  
**Date :** Juin 2026  
**Version :** 1.1

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
- En cas de conflit (même établissement modifié offline et online), la version la plus récente (timestamp) est conservée, avec alerte à l'utilisateur

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
| statut | enum | `non_demarre` / `en_cours` / `arrete` / `receptionne` |
| created_at | timestamp | |

### 3.2 Table `marches_travaux`
| Champ | Type | Notes |
|---|---|---|
| id | uuid PK | |
| etablissement_id | uuid FK | |
| nom_entreprise | text | |
| numero_marche | text | |
| montant_marche | numeric | XOF — montant total du marché |
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
| created_at | timestamp | |

**Valeurs `raisons_arret` :** `manque_effectif` / `manque_materiau` / `probleme_paiement` / `autre`

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
| role | enum | `coges` / `regional` / `national` / `admin` |
| lot_ids | uuid[] | Lots attribués (COGES et régional) |
| statut_compte | enum | `en_attente` / `actif` / `suspendu` |
| created_at | timestamp | |

---

## 4. Rôles et permissions

| Rôle | Établissements visibles | Saisie visites | Saisie paiements | Exports | Admin |
|---|---|---|---|---|---|
| **COGES** | Ses lots uniquement | Oui | Non | Ses lots | Non |
| **Régional** | Sa région | Non (lecture + commentaires) | Non | Sa région | Non |
| **National (MEN)** | Tous | Non | Oui | Tout | Non |
| **Admin** | Tous | Oui | Oui | Tout | Oui |

Permissions appliquées via **RLS Supabase** sur toutes les tables.

---

## 5. Fonctionnalités détaillées

### 5.1 Inscription et authentification
- Inscription par email + mot de passe (Supabase Auth)
- Après inscription : saisie du profil (nom, téléphone, rôle souhaité)
- Compte créé avec statut `en_attente` — aucun accès aux données avant validation
- L'admin reçoit une notification email et valide le compte depuis l'interface admin
- Session protégée par JWT Supabase

### 5.2 Interface COGES (mobile-first)
- Liste des établissements attribués, avec statut et avancement visible d'un coup d'œil
- Fiche établissement : infos générales + marché + historique des visites
- Formulaire nouvelle visite :
  - Date, statut, avancement par corps d'état (6 champs), avancement réel global
  - Upload multi-photos (compression auto < 500 Ko)
  - Commentaire libre
  - Si statut = "arrêté" : raisons en multi-select + champ texte
- **Mode offline :** formulaire utilisable sans connexion, données stockées en IndexedDB, badge + bouton "Synchroniser maintenant" visibles dès qu'une entrée est en attente. La background sync automatique est activée si le navigateur la supporte (Chrome Android) ; le bouton manuel est le mécanisme de base valable sur tous les navigateurs dont Safari iOS

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

#### Vue "Tableau de suivi des chantiers"
- Onglet dédié dans la navigation MEN
- Colonnes configurables (sélecteur show/hide)
- Champs disponibles : tous champs pertinents de `etablissements`, `marches_travaux`, `paiements` (agrégés), dernière visite
- Groupement par établissement (dernière visite par défaut, bouton "voir toutes les visites")
- Tri sur toutes les colonnes
- Filtres multi-select : lot, région, statut, entreprise, province, département
- Recherche textuelle : nom établissement, nom directeur, numéro de marché
- Pagination serveur (20 lignes / page)

#### Vue "Marchés de travaux"
- Tableau de tous les marchés (350 lignes, pagination serveur)
- Colonnes : établissement, entreprise, numéro de marché, montant, date démarrage, date fin estimative, montant payé, avancement financier (%), reste à payer
- Filtres multi-select : lot, province, entreprise, statut chantier
- Recherche : nom établissement, numéro de marché
- Bouton "Voir les paiements" par ligne : expand inline ou modale listant les paiements enregistrés
- Bouton "Ajouter un paiement" (rôle MEN/admin uniquement) : formulaire date + montant + libellé
- Export Excel et PDF du tableau (filtre actif)

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
- Validation des comptes `en_attente`, modification de rôle, suspension
- Attribution des lots à un COGES ou responsable régional
- Gestion des lots (création, renommage, région)
- Import en masse des établissements (CSV)
- Modification directe des fiches établissements

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

## 8. Hors périmètre (V1)

- Notifications push
- Messagerie interne
- Intégration SIG externe
- Multi-langue

---

## 9. Prompt de lancement — Claude Code

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

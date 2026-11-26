# Refonte PATEB — cahier des décisions

Document de travail : il fixe ce qui a été décidé avant de toucher au code.
Sources : DAO travaux PATEB (33 lots), annexe des EPP par lots MOE, maquettes
des trois formulaires (UG, CSTC, MOE). État au 24/11/2026.

## 1. Périmètre

| Élément | Valeur |
|---|---|
| Sites | **387** (1 salle de pré-primaire + 1 bloc latrines 3 cabines par site) |
| Salles | 369 avec électricité, 18 sans |
| Latrines | 276 sèches, 111 à eau |
| Lots de travaux | 33 (1 entreprise titulaire par lot) |
| Lots MOE | 4 (rattachement par **région**, donc par site) |
| Référence des sites | [`sites_reference.csv`](sites_reference.csv) |

Rattachement MOE : 1 = Bounkani, Gontougo, Indénié-Djuablin · 2 = Hambol, Béré,
Worodougou · 3 = Cavally, Nawa · 4 = Tchologo, Bagoué, Bafing, Kabadougou,
Folon, Gbôklé. Le lot de travaux 16 « Bafing et Béré 1 » est donc partagé
entre MOE 4 (sites du Bafing) et MOE 2 (sites du Béré).

## 2. Profils et droits

| Profil | Connexion | Voit | Saisit / modifie |
|---|---|---|---|
| **CSTC** | identifiant + code PIN | son site : formulaire + historique de ses envois | formulaire CSTC de son site |
| **MOE – contrôleur** | email | ses sites (affectés par l'admin) + historiques | formulaire MOE de ses sites |
| **MOE – chef de mission** | email | tous les sites de son lot MOE | formulaire MOE de tous ces sites, y compris **correction** des formulaires de ses contrôleurs |
| **UG** | email | tous les formulaires (CSTC, MOE, UG) + tableau de bord | formulaire UG ; **lecture seule** sur CSTC et MOE |
| **Admin** | email | tout | comptes, affectations, liste des sites, poids des lots |

- Les comptes CSTC sont **créés par l'admin** (identifiant généré, PIN à 4–6
  chiffres). Pas d'inscription libre pour ce profil.
- Les rôles actuels `regional` et `men_viewer` disparaissent.

## 3. Design

- **Un seul design** (mêmes composants, typographie, espacements) avec **une
  couleur d'accent par profil** : UG bordeaux, CSTC bleu, MOE orange, admin
  neutre (d'après les maquettes).
- Toutes les couleurs, la police et le logo sont définis **à un seul endroit**
  (fichier de thème avec des noms d'usage : `primaire`, `fond`, `succes`,
  `alerte`…). Changer la charte = modifier ce fichier.

## 4. Formulaires

### Principes communs
- Saisie **100 % hors ligne**, envoi automatique au retour du réseau.
- Photos géolocalisées et horodatées, compressées sur le téléphone.
- Avancements par **pas de 10 %**.
- Un **CSTC peut corriger** un formulaire déjà envoyé pendant **3 jours** après
  la date de visite ; ensuite il est verrouillé (règle appliquée aussi côté base).
- Fréquence : CSTC et MOE hebdomadaire ; UG 2 fois par mois (provisoire).

### Statuts uniformisés
Une seule liste pour toute l'application :

| Statut | CSTC voit | MOE / UG voient |
|---|---|---|
| `non_demarre` | Pas encore commencé | Non démarré |
| `en_cours` | Ouvriers au travail | En cours |
| `arrete` | Arrêté / abandonné | Arrêté |
| `termine` | Classe terminée | Travaux terminés |
| `receptionne` | — | Réceptionné |

Le statut « ralenti » a été retiré (distinction peu claire) : un chantier
lent reste « en cours » ; la lenteur se lit dans l'avancement, le retard
estimé et les problèmes signalés (effectif insuffisant, approvisionnement…).

« Personne sur place » devient une **observation** du jour (présence
d'ouvriers oui/non) et non un statut : une absence un jour donné ne veut pas
dire que le chantier est arrêté.

### Postes d'avancement alignés sur le DQE (UG et MOE)
Salle de classe : terrassements · gros œuvre (fondations) · gros œuvre
(élévation, enduits) · charpente bois · couverture · serrurerie · électricité
(masqué si site sans électricité) · menuiserie bois · faux-plafond · peinture.

Latrines (bloc séparé, contenu selon le type du site) : terrassements · gros
œuvre (fosses, élévation) · charpente / couverture · menuiserie · plomberie
(latrines à eau) ou ventilation (latrines sèches) · revêtements · peinture.

Le formulaire **CSTC reste simple et non aligné sur le DQE** ; il gagne une
question sur les latrines (pas commencées / en cours / terminées).

### Contrôle des quantités (UG)
Quantités prévues **préremplies depuis le DQE type**, selon le type de salle et
de latrines du site. Les « fenêtres » de la maquette sont remplacées par les
ouvrages du DQE : portes persiennées (2 vantaux, 1 vantail), claustras, mur en
agglos (m²), couverture (m²)…

## 5. Tableau de bord (UG)

- **Avancement de référence = MOE**, avec la mention « Source : MOE » sur
  chaque indicateur.
- **Avancement global pondéré** : Σ (poids du lot × avancement du lot) / Σ
  poids. Le **poids de chaque lot est paramétrable par l'admin** (valeur par
  défaut : nombre de sites du lot).
- **Graphiques** (voir [`maquette-graphique-avancement.html`](maquette-graphique-avancement.html)) :
  1. barre mosaïque des 33 lots (largeur = poids, hauteur = avancement) ;
  2. carte de chaleur lot × corps d'état ;
  3. *(plus tard, si un planning est saisi)* courbe en S réel / prévu.
- **Discordances** : alerte quand l'avancement UG et l'avancement MOE d'un
  même site diffèrent de **plus de 5 points**. La visite UG est comparée à la
  visite MOE **la plus proche dans le temps, à 7 jours près** ; sans visite
  MOE dans cet intervalle, pas de comparaison.

### Calcul de l'avancement
1. **Poste** : saisi par la MOE (pas de 10 %).
2. **Site** = Σ (poids du poste × avancement du poste), sur la salle puis les
   latrines, combinées selon le partage salle / latrines. Pour une salle sans
   électricité, le poids « électricité » est réparti sur les autres postes.
3. **Lot** = moyenne des sites du lot (tous les sites d'un lot ont le même
   programme : 1 salle + 1 bloc latrines).
4. **Global** = Σ (poids du lot × avancement du lot) / Σ poids.

Tous les poids sont **paramétrables par l'admin** (écran « Paramètres »).

### Poids par défaut (à ajuster quand les DQE chiffrés seront connus)
Estimations à partir des quantités du DQE type et de prix courants ; le DAO
ne donne pas de prix.

| Partage du site | Défaut |
|---|---|
| Salle de classe | 80 % |
| Bloc latrines | 20 % |

| Salle de classe | Défaut | | Latrines à eau | Défaut | | Latrines sèches | Défaut |
|---|---|---|---|---|---|---|---|
| Terrassements | 5 % | | Terrassements | 6 % | | Terrassements | 8 % |
| Gros œuvre – fondations | 18 % | | Gros œuvre (fosses, élévation) | 45 % | | Gros œuvre (fosses, élévation) | 60 % |
| Gros œuvre – élévation, enduits | 27 % | | Charpente, couverture | 8 % | | Charpente, couverture | 12 % |
| Ouvrages divers (marches, rampe, clôture, placards) | 4 % | | Menuiserie bois | 6 % | | Menuiserie bois | 8 % |
| Charpente bois | 6 % | | Plomberie, sanitaires | 20 % | | Ventilation des fosses | 4 % |
| Couverture | 9 % | | Revêtements durs | 7 % | | Peinture | 8 % |
| Serrurerie | 7 % | | Électricité | 3 % | | | |
| Électricité | 5 % | | Peinture | 5 % | | | |
| Menuiserie bois | 4 % | | | | | | |
| Faux-plafond | 6 % | | | | | | |
| Peinture | 9 % | | | | | | |
| **Total** | **100 %** | | **Total** | **100 %** | | **Total** | **100 %** |

Poids des lots par défaut : nombre de sites du lot.
- **Tableau de suivi** groupé par lot de travaux, lignes dépliables par site.
- Conservés de l'existant : **carte**, **commentaires**, **exports**.

## 6. Exports

Export par **source** (CSTC, MOE ou UG), filtré par :
- **lot** : lot de travaux pour CSTC et UG, lot MOE pour la MOE ;
- **période** : dates de visite (du … au …).

Formats existants conservés (Excel pour les données, PDF / Word pour les
fiches de visite avec photos).

## 7. Données

- Les données actuelles sont factices : **base repartie de zéro**, plus de
  migration à prévoir.
- La liste des sites est importée depuis `sites_reference.csv` et consultable
  dans un **onglet « Sites »** modifiable uniquement par l'admin.
- Points à vérifier dans la liste (colonne `a_verifier`) :
  - 4 orthographes différentes entre les deux tableaux du DAO (TEHINI 2A,
    TESSODOUO, SIGNAHALE, LABAKUYA) — l'orthographe du tableau d'allotissement
    a été retenue ;
  - L07-12 « EPP DE TENINDIERI », appelé « EPP CHATEAU 1 » dans l'avis ;
  - L12-09 « EPP OUANGOLOSSO 3 », remplacé dans l'avis par un site du lot 33 ;
  - **L24-01 : site sans nom** (le lot 24 compte 14 classes pour 13 sites
    nommés).
- Le tableau de l'avis d'appel d'offres recopie par erreur les sites du lot
  19 dans le lot 32 : il n'a pas été utilisé pour le lot 32 (localités
  absentes pour ce lot).

## 8. Décisions du 24/11/2026

- Chef de mission MOE : voit **et corrige** les formulaires de son lot MOE.
- Poids des corps d'état : paramétrables par l'admin, valeurs par défaut
  ci-dessus (§ 5).
- Comparaison UG / MOE : visite MOE la plus proche, à 7 jours près.
- Correction par un CSTC : possible pendant 3 jours.

## 9. Ordre de développement proposé

1. ✅ **Socle** : nouvelle base (sites, lots, rôles, droits), import de la liste
   des sites, thème unique, connexion par identifiant + PIN pour les CSTC.
   *(Branche `refonte/etape-1-socle` ; base à installer : voir `supabase/README.md`.)*
2. **Formulaires hors ligne** : CSTC, MOE, UG (latrines incluses, statuts
   uniformisés, quantités DQE préremplies), historique, correction sous 3 jours,
   app installable sur le téléphone.
3. **Administration** : comptes, affectations des sites, onglet « Sites »,
   paramètres de poids.
4. ✅ **Tableau de bord UG** : indicateurs, mosaïque, carte de chaleur,
   discordances, tableau de suivi par lot, carte, commentaires.
   *(Carte : sites placés au chef-lieu de leur département tant que leurs
   coordonnées GPS ne sont pas connues ; la position des photos
   géolocalisées prend le relais automatiquement.)*
5. **Exports** par source, lot et période.

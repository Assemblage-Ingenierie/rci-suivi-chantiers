-- ============================================================================
-- SEED — Suivi de chantiers scolaires Côte d'Ivoire (données de développement)
--
-- Contenu (CDC §6) :
--   - 4 lots géographiques (Nord / Sud / Est / Ouest)
--   - 8 comptes de test (4 COGES, 2 régionaux, 1 national, 1 admin)
--     mot de passe commun : ChantierCI!2026
--   - 50 établissements réalistes (provinces/départements réels)
--   - 1 marché par établissement (50 M à 200 M XOF, entreprises fictives)
--   - 1-2 visites (non démarrés) ou 2-5 visites (autres) à avancement progressif
--   - 0-4 paiements par marché, cohérents avec l'avancement physique
--   - quelques commentaires régionaux
--
-- Générateurs déterministes : hashtext(id) => relançable à l'identique sur une
-- base vide. Un garde-fou empêche un double-seed.
-- À exécuter en tant que postgres (SQL Editor / MCP), PAS via l'API.
-- ============================================================================

-- ============================== SECTION A ===================================
-- Garde-fou + lots + comptes de test
-- ============================================================================

do $$
begin
  if exists (select 1 from public.chantierci_lots) then
    raise exception 'Seed déjà appliqué : chantierci_lots n''est pas vide.';
  end if;
end $$;

insert into public.chantierci_lots (id, nom, region) values
  ('11111111-1111-4111-8111-000000000001', 'Lot Nord',  'Nord'),
  ('11111111-1111-4111-8111-000000000002', 'Lot Sud',   'Sud'),
  ('11111111-1111-4111-8111-000000000003', 'Lot Est',   'Est'),
  ('11111111-1111-4111-8111-000000000004', 'Lot Ouest', 'Ouest');

-- Comptes de test (auth.users + identities + profils chantierci).
-- NB : le trigger PEEB du projet partagé créera aussi un profil PEEB pour
-- chacun de ces comptes (cross-talk documenté dans supabase/README.md).
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change, email_change_token_new,
  email_change_token_current
)
select
  '00000000-0000-0000-0000-000000000000', v.id::uuid, 'authenticated',
  'authenticated', v.email,
  extensions.crypt('ChantierCI!2026', extensions.gen_salt('bf')), now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  jsonb_build_object('nom_complet', v.nom),
  now(), now(), '', '', '', '', ''
from (values
  ('22222222-2222-4222-8222-00000000000a', 'admin@chantierci.test',         'Clément DAVY'),
  ('22222222-2222-4222-8222-00000000000b', 'national@chantierci.test',      'Serge BALLO'),
  ('22222222-2222-4222-8222-00000000000c', 'regional.nord@chantierci.test', 'Tidiane SANOGO'),
  ('22222222-2222-4222-8222-00000000000d', 'regional.sud@chantierci.test',  'Marie-Laure ABBÉ'),
  ('22222222-2222-4222-8222-000000000001', 'coges.nord@chantierci.test',    'Brahima KONÉ'),
  ('22222222-2222-4222-8222-000000000002', 'coges.sud@chantierci.test',     'Affoué KOUAMÉ'),
  ('22222222-2222-4222-8222-000000000003', 'coges.est@chantierci.test',     'Kouadio N''ZI'),
  ('22222222-2222-4222-8222-000000000004', 'coges.ouest@chantierci.test',   'Cécile GOHOU')
) as v(id, email, nom);

insert into auth.identities (
  id, user_id, provider_id, identity_data, provider,
  last_sign_in_at, created_at, updated_at
)
select
  gen_random_uuid(), u.id, u.id::text,
  jsonb_build_object('sub', u.id::text, 'email', u.email,
                     'email_verified', true, 'phone_verified', false),
  'email', now(), now(), now()
from auth.users u
where u.email like '%@chantierci.test';

insert into public.chantierci_profiles (id, nom_complet, email, telephone, role, lot_ids, statut_compte) values
  ('22222222-2222-4222-8222-00000000000a', 'Clément DAVY',     'admin@chantierci.test',         '+225 07 00 00 00 01', 'admin',    '{}', 'actif'),
  ('22222222-2222-4222-8222-00000000000b', 'Serge BALLO',      'national@chantierci.test',      '+225 07 00 00 00 02', 'national', '{}', 'actif'),
  ('22222222-2222-4222-8222-00000000000c', 'Tidiane SANOGO',   'regional.nord@chantierci.test', '+225 07 00 00 00 03', 'regional', array['11111111-1111-4111-8111-000000000001']::uuid[], 'actif'),
  ('22222222-2222-4222-8222-00000000000d', 'Marie-Laure ABBÉ', 'regional.sud@chantierci.test',  '+225 07 00 00 00 04', 'regional', array['11111111-1111-4111-8111-000000000002']::uuid[], 'actif'),
  ('22222222-2222-4222-8222-000000000001', 'Brahima KONÉ',     'coges.nord@chantierci.test',    '+225 07 00 00 00 05', 'coges',    array['11111111-1111-4111-8111-000000000001']::uuid[], 'actif'),
  ('22222222-2222-4222-8222-000000000002', 'Affoué KOUAMÉ',    'coges.sud@chantierci.test',     '+225 07 00 00 00 06', 'coges',    array['11111111-1111-4111-8111-000000000002']::uuid[], 'actif'),
  ('22222222-2222-4222-8222-000000000003', 'Kouadio N''ZI',    'coges.est@chantierci.test',     '+225 07 00 00 00 07', 'coges',    array['11111111-1111-4111-8111-000000000003']::uuid[], 'actif'),
  ('22222222-2222-4222-8222-000000000004', 'Cécile GOHOU',     'coges.ouest@chantierci.test',   '+225 07 00 00 00 08', 'coges',    array['11111111-1111-4111-8111-000000000004']::uuid[], 'actif');

-- ============================== SECTION B ===================================
-- 50 établissements + marchés de travaux
-- ============================================================================

insert into public.chantierci_etablissements
  (nom, nom_directeur, telephone, email, latitude, longitude, province, departement, village, lot_id, statut)
values
  -- ---- Lot Nord (12) ----
  ('EPP Koko',                          'KONÉ Adama',          '+225 07 49 12 30 01', 'epp.koko@men.test',                9.4660, -5.6400, 'Poro',             'Korhogo',          'Koko',           '11111111-1111-4111-8111-000000000001', 'en_cours'),
  ('EPP Natiokobadara',                 'SILUÉ Kassoum',       '+225 05 86 22 41 02', 'epp.natiokobadara@men.test',       9.4910, -5.6630, 'Poro',             'Korhogo',          'Natiokobadara',  '11111111-1111-4111-8111-000000000001', 'en_cours'),
  ('Collège de Proximité de Napié',     'YÉO Madeleine',       '+225 07 58 33 52 03', 'cp.napie@men.test',                9.3010, -5.5520, 'Poro',             'Korhogo',          'Napié',          '11111111-1111-4111-8111-000000000001', 'arrete'),
  ('EPP Ferké Plateau',                 'OUATTARA Drissa',     '+225 01 71 44 63 04', 'epp.ferke.plateau@men.test',       9.6010, -5.1980, 'Tchologo',         'Ferkessédougou',   'Plateau',        '11111111-1111-4111-8111-000000000001', 'en_cours'),
  ('Groupe Scolaire de Kong',           'CISSÉ Mariam',        '+225 07 02 55 74 05', 'gs.kong@men.test',                 9.1500, -4.6200, 'Tchologo',         'Kong',             'Kong',           '11111111-1111-4111-8111-000000000001', 'non_demarre'),
  ('EPP Boundiali Centre',              'FOFANA Tiémoko',      '+225 05 13 66 85 06', 'epp.boundiali@men.test',           9.5210, -6.4890, 'Bagoué',           'Boundiali',        'Centre',         '11111111-1111-4111-8111-000000000001', 'receptionne'),
  ('EPP Kouto',                         'DOSSO Aïcha',         '+225 07 24 77 96 07', 'epp.kouto@men.test',               9.8900, -6.4100, 'Bagoué',           'Kouto',            'Kouto',          '11111111-1111-4111-8111-000000000001', 'en_cours'),
  ('Collège Moderne d''Odienné',        'DIOMANDÉ Vassiriki',  '+225 01 35 88 07 08', 'cm.odienne@men.test',              9.5100, -7.5640, 'Kabadougou',       'Odienné',          'Centre',         '11111111-1111-4111-8111-000000000001', 'en_cours'),
  ('EPP Madinani',                      'BAMBA Sita',          '+225 07 46 99 18 09', 'epp.madinani@men.test',            9.6200, -7.1800, 'Kabadougou',       'Madinani',         'Madinani',       '11111111-1111-4111-8111-000000000001', 'non_demarre'),
  ('Collège Moderne de Katiola',        'TRAORÉ Souleymane',   '+225 05 57 10 29 10', 'cm.katiola@men.test',              8.1400, -5.1010, 'Hambol',           'Katiola',          'Centre',         '11111111-1111-4111-8111-000000000001', 'receptionne'),
  ('EPP Niakaramandougou',              'SORO Pélagie',        '+225 07 68 21 40 11', 'epp.niakara@men.test',             8.6600, -5.2900, 'Hambol',           'Niakaramandougou', 'Niakara',        '11111111-1111-4111-8111-000000000001', 'en_cours'),
  ('EPP Tengréla',                      'COULIBALY Lacina',    '+225 01 79 32 51 12', 'epp.tengrela@men.test',           10.4800, -6.4100, 'Bagoué',           'Tengréla',         'Tengréla',       '11111111-1111-4111-8111-000000000001', 'arrete'),
  -- ---- Lot Sud (14) ----
  ('EPP Adjouffou 1',                   'AKA Bertin',          '+225 07 08 12 30 13', 'epp.adjouffou1@men.test',          5.2610, -3.9290, 'Abidjan',          'Port-Bouët',       'Adjouffou',      '11111111-1111-4111-8111-000000000002', 'en_cours'),
  ('EPP Anonkoi 3',                     'N''GUESSAN Estelle',  '+225 05 19 23 41 14', 'epp.anonkoi3@men.test',            5.4310, -4.0120, 'Abidjan',          'Abobo',            'Anonkoi-Kouté',  '11111111-1111-4111-8111-000000000002', 'en_cours'),
  ('Groupe Scolaire Niangon Sud',       'KOFFI Jean-Marc',     '+225 07 20 34 52 15', 'gs.niangon.sud@men.test',          5.3220, -4.0890, 'Abidjan',          'Yopougon',         'Niangon',        '11111111-1111-4111-8111-000000000002', 'receptionne'),
  ('EPP Abobo-Baoulé',                  'ASSI Henriette',      '+225 01 31 45 63 16', 'epp.abobo.baoule@men.test',        5.4180, -3.9620, 'Abidjan',          'Cocody',           'Abobo-Baoulé',   '11111111-1111-4111-8111-000000000002', 'en_cours'),
  ('Collège Moderne de Grand-Bassam',   'TANOH Maurice',       '+225 07 42 56 74 17', 'cm.grand.bassam@men.test',         5.2110, -3.7380, 'Sud-Comoé',        'Grand-Bassam',     'France',         '11111111-1111-4111-8111-000000000002', 'en_cours'),
  ('EPP Moossou',                       'EHOUMAN Solange',     '+225 05 53 67 85 18', 'epp.moossou@men.test',             5.2210, -3.7560, 'Sud-Comoé',        'Grand-Bassam',     'Moossou',        '11111111-1111-4111-8111-000000000002', 'non_demarre'),
  ('EPP Aboisso Château',               'KOUAMÉ Firmin',       '+225 07 64 78 96 19', 'epp.aboisso.chateau@men.test',     5.4710, -3.2070, 'Sud-Comoé',        'Aboisso',          'Château',        '11111111-1111-4111-8111-000000000002', 'receptionne'),
  ('EPP Dabou Lycée',                   'LATH Rosine',         '+225 01 75 89 07 20', 'epp.dabou.lycee@men.test',         5.3250, -4.3770, 'Grands-Ponts',     'Dabou',            'Lycée',          '11111111-1111-4111-8111-000000000002', 'en_cours'),
  ('Collège de Proximité de Jacqueville','AHOUSSI Norbert',    '+225 07 86 90 18 21', 'cp.jacqueville@men.test',          5.2060, -4.4140, 'Grands-Ponts',     'Jacqueville',      'Centre',         '11111111-1111-4111-8111-000000000002', 'arrete'),
  ('EPP Bardot',                        'GNAHORÉ Léa',         '+225 05 97 01 29 22', 'epp.bardot@men.test',              4.7590, -6.6510, 'San-Pédro',        'San-Pédro',        'Bardot',         '11111111-1111-4111-8111-000000000002', 'en_cours'),
  ('Lycée Moderne de San-Pédro 2',      'DJÉ Olivier',         '+225 07 18 12 40 23', 'lm.sanpedro2@men.test',            4.7680, -6.6320, 'San-Pédro',        'San-Pédro',        'Cité',           '11111111-1111-4111-8111-000000000002', 'en_cours'),
  ('EPP Sassandra Phare',               'KOUADIO Albertine',   '+225 01 29 23 51 24', 'epp.sassandra.phare@men.test',     4.9530, -6.0850, 'Gbôklé',           'Sassandra',        'Phare',          '11111111-1111-4111-8111-000000000002', 'non_demarre'),
  ('EPP Divo Konankro',                 'ZADI Hervé',          '+225 07 30 34 62 25', 'epp.divo.konankro@men.test',       5.8390, -5.3600, 'Lôh-Djiboua',      'Divo',             'Konankro',       '11111111-1111-4111-8111-000000000002', 'receptionne'),
  ('EPP Agboville Gare',                'ADOU Patricia',       '+225 05 41 45 73 26', 'epp.agboville.gare@men.test',      5.9280, -4.2130, 'Agnéby-Tiassa',    'Agboville',        'Gare',           '11111111-1111-4111-8111-000000000002', 'en_cours'),
  -- ---- Lot Est (11) ----
  ('EPP Abengourou Plateau',            'AMOIKON Didier',      '+225 07 52 56 84 27', 'epp.abengourou.plateau@men.test',  6.7290, -3.4960, 'Indénié-Djuablin', 'Abengourou',       'Plateau',        '11111111-1111-4111-8111-000000000003', 'en_cours'),
  ('Groupe Scolaire de Niablé',         'EBA Véronique',       '+225 01 63 67 95 28', 'gs.niable@men.test',               6.7860, -3.3010, 'Indénié-Djuablin', 'Abengourou',       'Niablé',         '11111111-1111-4111-8111-000000000003', 'en_cours'),
  ('Collège Moderne d''Agnibilékrou',   'KOUASSI Apollinaire', '+225 07 74 78 06 29', 'cm.agnibilekrou@men.test',         7.1290, -3.2040, 'Indénié-Djuablin', 'Agnibilékrou',     'Centre',         '11111111-1111-4111-8111-000000000003', 'receptionne'),
  ('EPP Bondoukou Zanzan',              'OUATTARA Ramata',     '+225 05 85 89 17 30', 'epp.bondoukou.zanzan@men.test',    8.0400, -2.8000, 'Gontougo',         'Bondoukou',        'Zanzan',         '11111111-1111-4111-8111-000000000003', 'en_cours'),
  ('EPP Tanda',                         'KONATÉ Issouf',       '+225 07 96 90 28 31', 'epp.tanda@men.test',               7.8030, -3.1680, 'Gontougo',         'Tanda',            'Tanda',          '11111111-1111-4111-8111-000000000003', 'arrete'),
  ('Collège de Proximité de Sandégué',  'BINI Carole',         '+225 01 07 01 39 32', 'cp.sandegue@men.test',             7.9700, -3.4500, 'Gontougo',         'Sandégué',         'Sandégué',       '11111111-1111-4111-8111-000000000003', 'non_demarre'),
  ('EPP Daoukro Commerce',              'N''DRI Pascal',       '+225 07 18 12 50 33', 'epp.daoukro.commerce@men.test',    7.0560, -3.9630, 'Iffou',            'Daoukro',          'Commerce',       '11111111-1111-4111-8111-000000000003', 'en_cours'),
  ('EPP M''Bahiakro',                   'YAO Hortense',        '+225 05 29 23 61 34', 'epp.mbahiakro@men.test',           7.4540, -4.3390, 'Iffou',            'M''Bahiakro',      'Centre',         '11111111-1111-4111-8111-000000000003', 'en_cours'),
  ('Collège Moderne de Bongouanou',     'ASSALÉ Marius',       '+225 07 40 34 72 35', 'cm.bongouanou@men.test',           6.6520, -4.2040, 'Moronou',          'Bongouanou',       'Centre',         '11111111-1111-4111-8111-000000000003', 'receptionne'),
  ('EPP Arrah',                         'MEL Florence',        '+225 01 51 45 83 36', 'epp.arrah@men.test',               6.6730, -3.9690, 'Moronou',          'Arrah',            'Arrah',          '11111111-1111-4111-8111-000000000003', 'en_cours'),
  ('EPP Prikro',                        'KONAN Bénédicte',     '+225 07 62 56 94 37', 'epp.prikro@men.test',              7.6590, -3.9530, 'Iffou',            'Prikro',           'Prikro',         '11111111-1111-4111-8111-000000000003', 'arrete'),
  -- ---- Lot Ouest (13) ----
  ('EPP Man Libreville',                'GUÉ Christelle',      '+225 05 73 67 05 38', 'epp.man.libreville@men.test',      7.4120, -7.5540, 'Tonkpi',           'Man',              'Libreville',     '11111111-1111-4111-8111-000000000004', 'en_cours'),
  ('Collège Moderne de Biankouma',      'DOH Sylvain',         '+225 07 84 78 16 39', 'cm.biankouma@men.test',            7.7390, -7.6130, 'Tonkpi',           'Biankouma',        'Centre',         '11111111-1111-4111-8111-000000000004', 'en_cours'),
  ('EPP Danané Frontière',              'OULAÏ Judith',        '+225 01 95 89 27 40', 'epp.danane@men.test',              7.2620, -8.1550, 'Tonkpi',           'Danané',           'Gningleu',       '11111111-1111-4111-8111-000000000004', 'non_demarre'),
  ('EPP Daloa Tazibouo',                'TRA BI Ernest',       '+225 07 06 90 38 41', 'epp.daloa.tazibouo@men.test',      6.8890, -6.4380, 'Haut-Sassandra',   'Daloa',            'Tazibouo',       '11111111-1111-4111-8111-000000000004', 'en_cours'),
  ('Groupe Scolaire Lobia',             'ZAHUI Marcelline',    '+225 05 17 01 49 42', 'gs.lobia@men.test',                6.8640, -6.4660, 'Haut-Sassandra',   'Daloa',            'Lobia',          '11111111-1111-4111-8111-000000000004', 'receptionne'),
  ('EPP Issia Carrefour',               'SÉRY Gaston',         '+225 07 28 12 60 43', 'epp.issia.carrefour@men.test',     6.4920, -6.5860, 'Haut-Sassandra',   'Issia',            'Carrefour',      '11111111-1111-4111-8111-000000000004', 'en_cours'),
  ('EPP Vavoua',                        'KALOU Bérénice',      '+225 01 39 23 71 44', 'epp.vavoua@men.test',              7.3810, -6.4770, 'Haut-Sassandra',   'Vavoua',           'Vavoua',         '11111111-1111-4111-8111-000000000004', 'arrete'),
  ('Collège Moderne de Duékoué',        'GLA Honoré',          '+225 07 50 34 82 45', 'cm.duekoue@men.test',              6.7420, -7.3490, 'Guémon',           'Duékoué',          'Centre',         '11111111-1111-4111-8111-000000000004', 'en_cours'),
  ('EPP Bangolo',                       'DIAHI Léontine',      '+225 05 61 45 93 46', 'epp.bangolo@men.test',             7.0120, -7.4860, 'Guémon',           'Bangolo',          'Bangolo',        '11111111-1111-4111-8111-000000000004', 'arrete'),
  ('EPP Guiglo Nicla',                  'PEHE Roland',         '+225 07 72 56 04 47', 'epp.guiglo.nicla@men.test',        6.5430, -7.4930, 'Cavally',          'Guiglo',           'Nicla',          '11111111-1111-4111-8111-000000000004', 'non_demarre'),
  ('Collège Moderne de Séguéla',        'DIABATÉ Fanta',       '+225 01 83 67 15 48', 'cm.seguela@men.test',              7.9610, -6.6730, 'Worodougou',       'Séguéla',          'Centre',         '11111111-1111-4111-8111-000000000004', 'receptionne'),
  ('EPP Touba',                         'SAVANÉ Moussa',       '+225 07 94 78 26 49', 'epp.touba@men.test',               8.2830, -7.6840, 'Bafing',           'Touba',            'Touba',          '11111111-1111-4111-8111-000000000004', 'en_cours'),
  ('EPP Gagnoa Dioulabougou',           'GNAMBA Édith',        '+225 05 05 89 37 50', 'epp.gagnoa.dioulabougou@men.test', 6.1320, -5.9510, 'Gôh',              'Gagnoa',           'Dioulabougou',   '11111111-1111-4111-8111-000000000004', 'receptionne');

-- Marchés : 1 par établissement, 50 M à 200 M XOF, entreprises fictives,
-- démarrage passé (chantiers lancés) ou T3 2026 (non démarrés).
with base as (
  select
    e.id, e.statut,
    abs(hashtext(e.id::text || 'montant'))    as hm,
    abs(hashtext(e.id::text || 'dates'))      as hd,
    abs(hashtext(e.id::text || 'entreprise')) as he,
    row_number() over (order by e.nom)        as rn
  from public.chantierci_etablissements e
)
insert into public.chantierci_marches_travaux
  (etablissement_id, nom_entreprise, numero_marche, montant_marche, date_demarrage, date_fin_estimative)
select
  b.id,
  (array['BTIC','SOGECI','CBCI','SOTRABA-CI','EGC Sassandra','BATIMAT-CI',
         'Entreprise FADIGA & Fils','Groupe KARAMOKO BTP','IVOIRE CONSTRUCTION',
         'SONIBAT','ETRACOM-CI','NOVABAT Afrique'])[1 + b.he % 12],
  '2025-MEN-TRX-' || lpad(b.rn::text, 4, '0'),
  (50 + b.hm % 151) * 1000000,
  case when b.statut = 'non_demarre'
       then date '2026-07-01' + (b.hd % 60)
       else date '2025-01-15' + (b.hd % 270) end,
  case when b.statut = 'non_demarre'
       then date '2026-07-01' + (b.hd % 60) + (240 + b.hd % 180)
       else date '2025-01-15' + (b.hd % 270) + (240 + b.hd % 180) end
from base b;

-- ============================== SECTION C ===================================
-- Visites, paiements, commentaires
-- ============================================================================

-- Visites : avancement progressif et corps d'état cohérents.
-- Pondération des corps d'état (cumul = 100 % de l'avancement global) :
-- excavation 10, fondation 15, verticaux 25, charpente 15, couverture 15,
-- finition 20. Chaque pct = part de SA phase réalisée pour un global donné.
do $$
declare
  e record;
  h int; n int; g_final int; g_prev int; g_i int; i int;
  d_start date; d_end date; v_date date; prev_date date;
  v_statut public.chantierci_statut_chantier;
  v_raisons text[]; v_raison_autre text;
  coges_uid uuid; coges_nom text;
  commentaires text[] := array[
    'RAS, chantier propre et bien tenu.',
    'Présence effective de l''entreprise, bonne cadence.',
    'Stock de ciment faible, à surveiller.',
    'Ferraillage conforme aux plans visés.',
    'Effectif réduit constaté ce jour.',
    'Qualité des agglos satisfaisante.',
    'Prévoir le repli de la base vie.',
    null, null, null];
begin
  for e in
    select et.id, et.statut, et.lot_id, m.date_demarrage, m.date_fin_estimative
    from public.chantierci_etablissements et
    join public.chantierci_marches_travaux m on m.etablissement_id = et.id
  loop
    h := abs(hashtext(e.id::text || 'visites'));
    coges_uid := case e.lot_id
      when '11111111-1111-4111-8111-000000000001' then '22222222-2222-4222-8222-000000000001'::uuid
      when '11111111-1111-4111-8111-000000000002' then '22222222-2222-4222-8222-000000000002'::uuid
      when '11111111-1111-4111-8111-000000000003' then '22222222-2222-4222-8222-000000000003'::uuid
      else '22222222-2222-4222-8222-000000000004'::uuid end;
    coges_nom := case e.lot_id
      when '11111111-1111-4111-8111-000000000001' then 'Brahima KONÉ'
      when '11111111-1111-4111-8111-000000000002' then 'Affoué KOUAMÉ'
      when '11111111-1111-4111-8111-000000000003' then 'Kouadio N''ZI'
      else 'Cécile GOHOU' end;

    -- Non démarré : 1-2 visites de constat à 0 %.
    if e.statut = 'non_demarre' then
      n := 1 + h % 2;
      for i in 1..n loop
        insert into public.chantierci_visites
          (etablissement_id, date_visite, nom_visiteur, user_id, statut_chantier,
           avancement_reel_pct, pct_excavation, pct_fondation, pct_verticaux,
           pct_charpente, pct_couverture, pct_finition, commentaire, sync_status, created_at)
        values
          (e.id, current_date - (80 - i * 30 + h % 15), coges_nom, coges_uid,
           'non_demarre', 0, 0, 0, 0, 0, 0, 0,
           'Site non encore mobilisé par l''entreprise.', 'synced',
           now() + make_interval(secs => i));
      end loop;
      continue;
    end if;

    n := 2 + h % 4;  -- 2 à 5 visites
    g_final := case e.statut
      when 'receptionne' then 100
      when 'en_cours'    then 25 + h % 56   -- 25-80 %
      else                    15 + h % 51   -- arrêté : 15-65 %
    end;
    d_start := e.date_demarrage + 21;
    d_end := case when e.statut = 'receptionne'
                  then least(e.date_fin_estimative, current_date - 30)
                  else current_date - (7 + h % 21) end;
    if d_end <= d_start then d_end := d_start + 45; end if;

    g_prev := 0; prev_date := null;
    for i in 1..n loop
      if i = n then
        g_i := g_final;
      else
        g_i := round(g_final * i::numeric / n) + (abs(hashtext(e.id::text || i::text)) % 9) - 4;
        g_i := greatest(g_prev + 1, least(g_i, g_final - (n - i)));
      end if;
      -- chantier arrêté : la dernière visite constate la stagnation
      if e.statut = 'arrete' and i = n then g_i := g_prev; end if;

      v_statut := case when i = n then e.statut else 'en_cours' end;
      v_raisons := null; v_raison_autre := null;
      if v_statut = 'arrete' then
        case h % 4
          when 0 then v_raisons := array['probleme_paiement'];
          when 1 then v_raisons := array['manque_materiau'];
          when 2 then v_raisons := array['manque_effectif', 'manque_materiau'];
          else v_raisons := array['autre'];
               v_raison_autre := 'Litige foncier avec la communauté villageoise.';
        end case;
      end if;

      v_date := d_start + (((d_end - d_start) * (i - 1)) / greatest(n - 1, 1));
      if prev_date is not null and v_date <= prev_date then v_date := prev_date + 7; end if;
      prev_date := v_date;

      insert into public.chantierci_visites
        (etablissement_id, date_visite, nom_visiteur, user_id, statut_chantier,
         avancement_reel_pct, pct_excavation, pct_fondation, pct_verticaux,
         pct_charpente, pct_couverture, pct_finition,
         commentaire, raisons_arret, raison_arret_autre, sync_status, created_at)
      values
        (e.id, v_date, coges_nom, coges_uid, v_statut, g_i,
         least(100, greatest(0, round((g_i -  0) * 100.0 / 10)))::int,
         least(100, greatest(0, round((g_i - 10) * 100.0 / 15)))::int,
         least(100, greatest(0, round((g_i - 25) * 100.0 / 25)))::int,
         least(100, greatest(0, round((g_i - 50) * 100.0 / 15)))::int,
         least(100, greatest(0, round((g_i - 65) * 100.0 / 15)))::int,
         least(100, greatest(0, round((g_i - 80) * 100.0 / 20)))::int,
         commentaires[1 + (h + i) % 10], v_raisons, v_raison_autre, 'synced',
         now() + make_interval(secs => i));

      g_prev := g_i;
    end loop;
  end loop;
end $$;

-- Paiements : avance de démarrage + décomptes, total cohérent avec
-- l'avancement physique (jamais supérieur au montant du marché).
do $$
declare
  m record; h int; g int; nb int; i int;
  total numeric; avance numeric; reste numeric; tranche numeric;
  p_date date;
  nat uuid := '22222222-2222-4222-8222-00000000000b';  -- compte national
begin
  for m in
    select mt.id, mt.etablissement_id, mt.montant_marche, mt.date_demarrage, e.statut
    from public.chantierci_marches_travaux mt
    join public.chantierci_etablissements e on e.id = mt.etablissement_id
  loop
    h := abs(hashtext(m.id::text || 'paiements'));

    -- Non démarré : une avance pour la moitié des marchés, sinon rien.
    if m.statut = 'non_demarre' then
      if h % 2 = 0 then
        insert into public.chantierci_paiements (marche_id, date_paiement, montant, libelle, saisi_par)
        values (m.id, current_date - (10 + h % 40),
                round(m.montant_marche * 0.15, -5), 'Avance de démarrage', nat);
      end if;
      continue;
    end if;

    select coalesce(max(avancement_reel_pct), 0) into g
    from public.chantierci_visites v where v.etablissement_id = m.etablissement_id;

    if m.statut = 'receptionne' then
      total := round(m.montant_marche * (85 + h % 16) / 100.0, -5);   -- 85-100 %
    else
      total := round(m.montant_marche * greatest(10, least(90, g - 5 + h % 15)) / 100.0, -5);
    end if;

    nb := 1 + h % 4;  -- 1 à 4 paiements
    avance := round(m.montant_marche * 0.15, -5);
    if avance >= total or nb = 1 then
      avance := total; nb := 1;
    end if;

    p_date := m.date_demarrage + 7;
    insert into public.chantierci_paiements (marche_id, date_paiement, montant, libelle, saisi_par)
    values (m.id, p_date, avance, 'Avance de démarrage', nat);

    if nb > 1 then
      reste := total - avance;
      for i in 1..(nb - 1) loop
        tranche := round(reste / (nb - 1), -5);
        if i = nb - 1 then tranche := reste - tranche * (nb - 2); end if;
        p_date := p_date + (30 + (h + i) % 50);
        insert into public.chantierci_paiements (marche_id, date_paiement, montant, libelle, saisi_par)
        values (m.id, p_date, tranche, 'Décompte n°' || i, nat);
      end loop;
    end if;
  end loop;
end $$;

-- Commentaires régionaux (lots Nord et Sud : les deux régionaux de test).
insert into public.chantierci_commentaires (etablissement_id, user_id, auteur_nom, contenu)
select
  e.id,
  case l.nom when 'Lot Nord'
    then '22222222-2222-4222-8222-00000000000c'::uuid
    else '22222222-2222-4222-8222-00000000000d'::uuid end,
  case l.nom when 'Lot Nord' then 'Tidiane SANOGO' else 'Marie-Laure ABBÉ' end,
  (array['Chantier visité lors de la tournée régionale : avancement conforme aux remontées COGES.',
         'Signalé à la direction régionale : accès au site difficile en saison des pluies.',
         'L''entreprise a été relancée sur le retard constaté.'])[1 + abs(hashtext(e.id::text || 'comm')) % 3]
from public.chantierci_etablissements e
join public.chantierci_lots l on l.id = e.lot_id
where l.nom in ('Lot Nord', 'Lot Sud')
  and abs(hashtext(e.id::text || 'pick')) % 4 = 0;

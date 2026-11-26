-- ============================================================================
-- Comptes de TEST (développement uniquement — ne pas exécuter en production)
--
-- Mot de passe des comptes email : Pateb!2026
-- CSTC : identifiant cstc-l19-01, PIN 123456
--
-- | Compte                       | Rôle            | Périmètre                    |
-- |------------------------------|-----------------|------------------------------|
-- | admin@pateb.test             | admin           | tout                         |
-- | ug@pateb.test                | ug              | tous les sites               |
-- | chef.moe2@pateb.test         | moe_chef        | lot MOE 2 (Hambol, Béré, Worodougou) |
-- | controleur.moe2@pateb.test   | moe_controleur  | sites du lot de travaux 19   |
-- | cstc-l19-01 (identifiant)    | cstc            | L19-01 EPP MAYAMA 1          |
-- | attente@pateb.test           | moe_controleur  | compte en attente : rien     |
--
-- Les CSTC se connectent avec un email technique <identifiant>@cstc.pateb.invalid
-- (jamais affiché) : voir src/lib/identifiants.ts.
-- À exécuter en tant que postgres (SQL Editor), APRÈS supabase/installation.sql.
-- Rejouable : les comptes de test existants sont recréés.
-- ============================================================================

-- Garde-fou : le nouveau schéma doit être installé.
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'chantierci_profiles'
      and column_name = 'identifiant'
  ) or to_regclass('public.chantierci_sites') is null then
    raise exception 'Le nouveau schéma n''est pas installé : exécuter d''abord supabase/installation.sql en entier, puis relancer ce script.';
  end if;
end $$;

-- Recrée les comptes de test s'ils existent déjà (profils et affectations
-- supprimés en cascade).
delete from auth.users where id::text like '33333333-3333-4333-8333-%';

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change, email_change_token_new,
  email_change_token_current
)
select
  '00000000-0000-0000-0000-000000000000', v.id::uuid, 'authenticated',
  'authenticated', v.email,
  extensions.crypt(v.mdp, extensions.gen_salt('bf')), now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  jsonb_build_object('nom_complet', v.nom),
  now(), now(), '', '', '', '', ''
from (values
  ('33333333-3333-4333-8333-00000000000a', 'admin@pateb.test',              'Pateb!2026', 'Admin TEST'),
  ('33333333-3333-4333-8333-00000000000b', 'ug@pateb.test',                 'Pateb!2026', 'Awa UG TEST'),
  ('33333333-3333-4333-8333-00000000000c', 'chef.moe2@pateb.test',          'Pateb!2026', 'Yao CHEF-MOE TEST'),
  ('33333333-3333-4333-8333-00000000000d', 'controleur.moe2@pateb.test',    'Pateb!2026', 'Koffi CONTROLEUR TEST'),
  ('33333333-3333-4333-8333-00000000000e', 'cstc-l19-01@cstc.pateb.invalid', '123456',    'Mariam CSTC TEST'),
  ('33333333-3333-4333-8333-00000000000f', 'attente@pateb.test',            'Pateb!2026', 'Compte EN-ATTENTE')
) as v(id, email, mdp, nom);

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
where u.id::text like '33333333-3333-4333-8333-%';

insert into public.chantierci_profiles
  (id, nom_complet, email, identifiant, role, lot_moe_id, statut_compte) values
  ('33333333-3333-4333-8333-00000000000a', 'Admin TEST',            'admin@pateb.test',           null,          'admin',          null, 'actif'),
  ('33333333-3333-4333-8333-00000000000b', 'Awa UG TEST',           'ug@pateb.test',              null,          'ug',             null, 'actif'),
  ('33333333-3333-4333-8333-00000000000c', 'Yao CHEF-MOE TEST',     'chef.moe2@pateb.test',       null,          'moe_chef',       2,    'actif'),
  ('33333333-3333-4333-8333-00000000000d', 'Koffi CONTROLEUR TEST', 'controleur.moe2@pateb.test', null,          'moe_controleur', 2,    'actif'),
  ('33333333-3333-4333-8333-00000000000e', 'Mariam CSTC TEST',      '',                           'cstc-l19-01', 'cstc',           null, 'actif'),
  ('33333333-3333-4333-8333-00000000000f', 'Compte EN-ATTENTE',     'attente@pateb.test',         null,          'moe_controleur', null, 'en_attente');

insert into public.chantierci_affectations (profile_id, site_id)
select '33333333-3333-4333-8333-00000000000d', id from public.chantierci_sites where lot_id = 19;

insert into public.chantierci_affectations (profile_id, site_id)
select '33333333-3333-4333-8333-00000000000e', id from public.chantierci_sites where code = 'L19-01';

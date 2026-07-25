-- ============================================================================
-- 0003_rls_policies.sql
-- Row Level Security : qui a le droit de LIRE quoi. Les ÉCRITURES sensibles
-- passent exclusivement par les fonctions RPC de 0002_functions.sql (qui,
-- étant SECURITY DEFINER, contournent volontairement ces policies après avoir
-- fait leurs propres vérifications de rôle en interne).
-- ============================================================================

alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.menu_items enable row level security;
alter table public.restaurant_tables enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.bills enable row level security;
alter table public.reservations enable row level security;
alter table public.notifications enable row level security;
alter table public.active_alarm enable row level security;
alter table public.restaurant_settings enable row level security;

-- ----------------------------------------------------------------------------
-- PROFILES
-- ----------------------------------------------------------------------------

-- Tout le personnel connecté peut voir les profils (noms des serveurs affichés
-- un peu partout : tables, commandes...), mais pas les clients anonymes.
create policy profiles_select_staff on public.profiles
  for select to authenticated
  using (true);

-- Seul un admin peut créer/modifier/supprimer des comptes (la création réelle du
-- compte Supabase Auth se fait via l'Edge Function create-staff-user, voir plus bas —
-- cette policy couvre les mises à jour de profil après coup).
create policy profiles_admin_write on public.profiles
  for update to authenticated
  using (public.current_role() = 'admin')
  with check (public.current_role() = 'admin');

create policy profiles_admin_delete on public.profiles
  for delete to authenticated
  using (public.current_role() = 'admin');

-- Un serveur peut mettre à jour SON PROPRE statut en ligne/hors ligne uniquement.
create policy profiles_self_online_status on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- ----------------------------------------------------------------------------
-- CATEGORIES & MENU — lecture publique (client + staff), écriture admin/manager
-- ----------------------------------------------------------------------------

create policy categories_select_all on public.categories
  for select to anon, authenticated using (true);

create policy categories_write_admin on public.categories
  for all to authenticated
  using (public.current_role() in ('admin', 'manager'))
  with check (public.current_role() in ('admin', 'manager'));

create policy menu_items_select_all on public.menu_items
  for select to anon, authenticated using (true);

create policy menu_items_write_admin on public.menu_items
  for all to authenticated
  using (public.current_role() in ('admin', 'manager'))
  with check (public.current_role() in ('admin', 'manager'));

-- ----------------------------------------------------------------------------
-- RESTAURANT_TABLES
-- Client (anon) : lecture uniquement des tables déjà 'occupee' (donc déjà
-- déverrouillées par un code valide au moins une fois) — jamais de liste
-- complète des tables ni des tables encore 'libre'.
-- ----------------------------------------------------------------------------

create policy tables_select_anon on public.restaurant_tables
  for select to anon
  using (status = 'occupee');

-- Admin/Manager/Caissier : toutes les tables. Serveur : ses tables + les libres
-- (pour pouvoir les revendiquer).
create policy tables_select_staff on public.restaurant_tables
  for select to authenticated
  using (
    public.current_role() in ('admin', 'manager', 'caissier', 'cuisinier')
    or (public.current_role() = 'serveur' and (assigned_waiter_id = auth.uid() or status = 'libre' or assigned_waiter_id is null))
  );

-- Écriture directe (statut, réassignation manuelle...) réservée à admin/manager ;
-- les autres actions (occuper, encaisser, revendiquer) passent par les fonctions RPC.
create policy tables_write_admin on public.restaurant_tables
  for update to authenticated
  using (public.current_role() in ('admin', 'manager'))
  with check (public.current_role() in ('admin', 'manager'));

-- ----------------------------------------------------------------------------
-- ORDERS / ORDER_ITEMS
-- Aucun accès direct pour anon (tout passe par les fonctions RPC ci-dessus).
-- Le personnel voit selon son rôle.
-- ----------------------------------------------------------------------------

create policy orders_select_staff on public.orders
  for select to authenticated
  using (
    public.current_role() in ('admin', 'manager', 'caissier')
    or (public.current_role() = 'cuisinier' and status not in ('en_attente_validation', 'terminee', 'annulee'))
    or (public.current_role() = 'serveur' and waiter_id = auth.uid())
  );

create policy order_items_select_staff on public.order_items
  for select to authenticated
  using (
    exists (
      select 1 from public.orders o
      where o.id = order_items.order_id
      and (
        public.current_role() in ('admin', 'manager', 'caissier')
        or (public.current_role() = 'cuisinier' and o.status not in ('en_attente_validation', 'terminee', 'annulee'))
        or (public.current_role() = 'serveur' and o.waiter_id = auth.uid())
      )
    )
  );

-- ----------------------------------------------------------------------------
-- BILLS — admin/manager/caissier uniquement (jamais les serveurs/cuisine/client)
-- ----------------------------------------------------------------------------

create policy bills_select_staff on public.bills
  for select to authenticated
  using (public.current_role() in ('admin', 'manager', 'caissier'));

-- ----------------------------------------------------------------------------
-- RESERVATIONS — lecture/écriture staff (pas les clients)
-- ----------------------------------------------------------------------------

create policy reservations_all_staff on public.reservations
  for all to authenticated
  using (public.current_role() in ('admin', 'manager', 'serveur', 'caissier'))
  with check (public.current_role() in ('admin', 'manager', 'serveur', 'caissier'));

-- ----------------------------------------------------------------------------
-- NOTIFICATIONS & ACTIVE_ALARM — lecture large pour le personnel (temps réel) ;
-- écriture uniquement via les fonctions RPC.
-- ----------------------------------------------------------------------------

create policy notifications_select_staff on public.notifications
  for select to authenticated using (true);

create policy active_alarm_select_all on public.active_alarm
  for select to anon, authenticated using (true);

-- ----------------------------------------------------------------------------
-- SETTINGS — lecture publique (nom/logo/devise affichés au client), écriture admin
-- ----------------------------------------------------------------------------

create policy settings_select_all on public.restaurant_settings
  for select to anon, authenticated using (true);

create policy settings_write_admin on public.restaurant_settings
  for update to authenticated
  using (public.current_role() = 'admin')
  with check (public.current_role() = 'admin');

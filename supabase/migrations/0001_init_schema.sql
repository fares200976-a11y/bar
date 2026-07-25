-- ============================================================================
-- 0001_init_schema.sql
-- Schéma initial pour l'application Bar & Restaurant (Supabase / Postgres)
-- ============================================================================

-- Extension nécessaire pour gen_random_uuid()
create extension if not exists "pgcrypto";

-- ----------------------------------------------------------------------------
-- ENUMS (reflètent exactement les types TypeScript existants)
-- ----------------------------------------------------------------------------

create type user_role as enum ('admin', 'manager', 'serveur', 'cuisinier', 'caissier');

create type table_status as enum ('libre', 'occupee', 'reservee', 'en_attente', 'commande_en_cours');

create type order_status as enum (
  'en_attente_validation', -- commande client pas encore confirmée par le serveur
  'nouvelle',
  'en_preparation',
  'prete',
  'servie',
  'terminee',
  'annulee'
);

create type order_item_status as enum ('nouvelle', 'en_preparation', 'prete', 'servie', 'annulee');

create type payment_method as enum ('espèces', 'carte', 'mobile', 'partagé');

create type reservation_status as enum ('confirmée', 'annulée', 'honorée');

create type notification_type as enum ('waiter_call', 'bill_request', 'new_order', 'kitchen_ready');

create type alarm_type as enum ('new_order', 'waiter_call', 'bill_request');

-- ----------------------------------------------------------------------------
-- PROFILES — remplace à la fois `users` et `waiters` de l'ancien modèle.
-- Un profil = un compte Supabase Auth (auth.users) + ses infos métier.
-- Le PIN à 4 chiffres (ancien "waiter.pinCode") devient une simple colonne,
-- utilisé uniquement pour la connexion rapide par QR code des serveurs.
-- ----------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique,
  name text not null,
  role user_role not null default 'serveur',
  phone text,
  avatar text,
  pin_code text,                 -- QR de connexion rapide (uniquement utile pour role='serveur')
  is_online boolean not null default true,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profiles is 'Comptes du personnel (admin, manager, serveur, cuisinier, caissier). Remplace users + waiters.';

-- ----------------------------------------------------------------------------
-- CATEGORIES & MENU
-- ----------------------------------------------------------------------------

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  icon text,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create table public.menu_items (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.categories(id) on delete restrict,
  name text not null,
  description text not null default '',
  price numeric(10,2) not null check (price >= 0),
  images text[] not null default '{}',
  video_url text,
  prep_time_minutes int not null default 10,
  is_available boolean not null default true,
  stock_quantity int not null default 0,
  is_promo boolean not null default false,
  promo_price numeric(10,2),
  is_recommended boolean not null default false,
  is_spicy boolean not null default false,
  allergens text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- TABLES (jusqu'à 500, id numérique conservé pour compatibilité avec le front)
-- ----------------------------------------------------------------------------

create table public.restaurant_tables (
  id int primary key,
  number int not null,
  name text not null,
  status table_status not null default 'libre',
  seats int not null default 2,
  access_code text,                                   -- code PIN 4 chiffres du QR
  assigned_waiter_id uuid references public.profiles(id) on delete set null,
  active_order_id uuid,                                -- FK ajoutée après création de `orders`
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.restaurant_tables is 'Nommée restaurant_tables (et non "tables") pour éviter tout conflit avec le mot réservé SQL.';

-- ----------------------------------------------------------------------------
-- ORDERS & ORDER ITEMS
-- ----------------------------------------------------------------------------

create sequence public.order_number_seq start 101;

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number int not null default nextval('public.order_number_seq'),
  table_id int not null references public.restaurant_tables(id) on delete restrict,
  waiter_id uuid references public.profiles(id) on delete set null,
  status order_status not null default 'en_attente_validation',
  special_requests text,
  call_waiter_request boolean not null default false,
  request_bill boolean not null default false,
  bill_requested_at timestamptz,
  confirmed_by_waiter_id uuid references public.profiles(id) on delete set null,
  confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  menu_item_id uuid not null references public.menu_items(id) on delete restrict,
  name text not null,           -- copie figée au moment de la commande (le prix/nom du plat peut changer après)
  unit_price numeric(10,2) not null,
  quantity int not null check (quantity > 0),
  notes text,
  status order_item_status not null default 'nouvelle',
  created_at timestamptz not null default now()
);

-- Maintenant que `orders` existe, on peut lier active_order_id
alter table public.restaurant_tables
  add constraint restaurant_tables_active_order_fk
  foreign key (active_order_id) references public.orders(id) on delete set null;

-- ----------------------------------------------------------------------------
-- BILLS (encaissements)
-- ----------------------------------------------------------------------------

create table public.bills (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete restrict,
  table_id int not null references public.restaurant_tables(id) on delete restrict,
  subtotal numeric(10,2) not null,
  tax_rate numeric(5,2) not null default 0,
  tax_amount numeric(10,2) not null default 0,
  service_rate numeric(5,2) not null default 0,
  service_amount numeric(10,2) not null default 0,
  discount_amount numeric(10,2) not null default 0,
  total numeric(10,2) not null,
  payment_method payment_method not null,
  payments_breakdown jsonb,
  cash_received numeric(10,2),
  change_given numeric(10,2),
  processed_by_user_id uuid references public.profiles(id) on delete set null,
  paid_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- RESERVATIONS
-- ----------------------------------------------------------------------------

create table public.reservations (
  id uuid primary key default gen_random_uuid(),
  table_id int not null references public.restaurant_tables(id) on delete restrict,
  client_name text not null,
  client_phone text not null,
  guest_count int not null default 2,
  date_time timestamptz not null,
  notes text,
  status reservation_status not null default 'confirmée',
  created_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- NOTIFICATIONS & ALARME ACTIVE (état partagé en temps réel)
-- ----------------------------------------------------------------------------

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  table_id int not null references public.restaurant_tables(id) on delete cascade,
  type notification_type not null,
  message text not null,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

-- Une seule ligne active à la fois (id fixe) : plus simple à écouter en Realtime
-- qu'une table à lignes multiples.
create table public.active_alarm (
  id boolean primary key default true check (id = true), -- force une seule ligne
  table_id int references public.restaurant_tables(id) on delete set null,
  order_number int,
  message text,
  type alarm_type,
  created_at timestamptz
);

insert into public.active_alarm (id, table_id, order_number, message, type, created_at)
values (true, null, null, null, null, null);

-- ----------------------------------------------------------------------------
-- SETTINGS (ligne unique)
-- ----------------------------------------------------------------------------

create table public.restaurant_settings (
  id boolean primary key default true check (id = true),
  name text not null default 'Mon Restaurant',
  logo text,
  address text,
  phone text,
  email text,
  opening_hours text,
  currency text not null default 'DA',
  vat_rate numeric(5,2) not null default 0,
  service_rate numeric(5,2) not null default 0,
  primary_color text not null default '#5A5A40',
  bg_style text not null default 'clean',
  cloudinary_cloud_name text,
  alarm_sound_type text default 'mp3_alarm_clock',
  custom_audio_url text,
  enable_loop_alarm boolean not null default true,
  alarm_volume numeric(3,2) not null default 0.8,
  updated_at timestamptz not null default now()
);

insert into public.restaurant_settings (id) values (true);

-- ----------------------------------------------------------------------------
-- updated_at automatique
-- ----------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();
create trigger trg_menu_items_updated_at before update on public.menu_items
  for each row execute function public.set_updated_at();
create trigger trg_tables_updated_at before update on public.restaurant_tables
  for each row execute function public.set_updated_at();
create trigger trg_orders_updated_at before update on public.orders
  for each row execute function public.set_updated_at();
create trigger trg_settings_updated_at before update on public.restaurant_settings
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- Index utiles
-- ----------------------------------------------------------------------------

create index idx_orders_table_id on public.orders(table_id);
create index idx_orders_status on public.orders(status);
create index idx_orders_waiter_id on public.orders(waiter_id);
create index idx_order_items_order_id on public.order_items(order_id);
create index idx_bills_table_id on public.bills(table_id);
create index idx_menu_items_category_id on public.menu_items(category_id);
create index idx_notifications_table_id on public.notifications(table_id);

-- ----------------------------------------------------------------------------
-- Activer Realtime (mises à jour live pour serveur/admin/cuisine/client)
-- ----------------------------------------------------------------------------

alter publication supabase_realtime add table public.orders;
alter publication supabase_realtime add table public.order_items;
alter publication supabase_realtime add table public.restaurant_tables;
alter publication supabase_realtime add table public.notifications;
alter publication supabase_realtime add table public.active_alarm;

-- ============================================================================
-- 0012_translations_satisfaction_pickup_weather.sql
-- Traduction du menu, avis de satisfaction, Click & Collect, coordonnées météo.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) TRADUCTION DU MENU
-- ----------------------------------------------------------------------------
alter table public.menu_items add column translations jsonb not null default '{}';
-- Structure: {"en": {"name": "...", "description": "..."}, "es": {...}}

-- ----------------------------------------------------------------------------
-- 2) FORMULAIRE DE SATISFACTION (privé, jamais public)
-- ----------------------------------------------------------------------------
create table public.satisfaction_reviews (
  id uuid primary key default gen_random_uuid(),
  table_id int references public.restaurant_tables(id) on delete set null,
  order_id uuid references public.orders(id) on delete set null,
  rating int not null check (rating between 1 and 5),
  comment text,
  created_at timestamptz not null default now()
);

alter table public.satisfaction_reviews enable row level security;

create policy satisfaction_select_staff on public.satisfaction_reviews
  for select to authenticated
  using (public.current_role() in ('admin', 'manager'));

create or replace function public.submit_satisfaction_review(
  p_table_id int,
  p_order_id uuid,
  p_rating int,
  p_comment text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_rating < 1 or p_rating > 5 then
    raise exception 'Note invalide (doit être entre 1 et 5).';
  end if;

  insert into public.satisfaction_reviews (table_id, order_id, rating, comment)
  values (p_table_id, p_order_id, p_rating, p_comment);
end;
$$;

grant execute on function public.submit_satisfaction_review(int, uuid, int, text) to anon, authenticated;

-- ----------------------------------------------------------------------------
-- 3) CLICK & COLLECT (commande à emporter, sans table physique)
--    Astuce simple : une table "virtuelle" fixe (id 999) sert de support à
--    toutes les commandes à emporter, pour ne pas casser tout le reste du
--    schéma qui suppose qu'une commande appartient toujours à une table.
-- ----------------------------------------------------------------------------
insert into public.restaurant_tables (id, number, name, status, seats, access_code)
values (999, 999, '🥡 Click & Collect (Emporter)', 'occupee', 0, null)
on conflict (id) do nothing;

alter table public.orders add column order_type text not null default 'sur_place'
  check (order_type in ('sur_place', 'emporter'));

create or replace function public.create_pickup_order(
  p_items jsonb,
  p_client_name text default null,
  p_client_phone text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order_id uuid;
  v_order_number int;
  v_item jsonb;
  v_menu_item public.menu_items%rowtype;
  v_qty int;
  v_notes text;
begin
  v_notes := trim(both ' - ' from concat_ws(' - ', nullif(p_client_name, ''), nullif(p_client_phone, '')));

  insert into public.orders (table_id, status, order_type, special_requests)
  values (999, 'en_attente_validation', 'emporter', nullif(v_notes, ''))
  returning id, order_number into v_order_id, v_order_number;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    select * into v_menu_item from public.menu_items where id = (v_item->>'menuItemId')::uuid;
    if not found then
      continue;
    end if;

    v_qty := (v_item->>'quantity')::int;

    insert into public.order_items (order_id, menu_item_id, name, unit_price, quantity, notes, status)
    values (
      v_order_id, v_menu_item.id, v_menu_item.name,
      case when v_menu_item.is_promo and v_menu_item.promo_price is not null
           then v_menu_item.promo_price else v_menu_item.price end,
      v_qty, v_item->>'notes', 'nouvelle'
    );

    update public.menu_items
      set stock_quantity = greatest(0, stock_quantity - v_qty),
          is_available = (greatest(0, stock_quantity - v_qty) > 0)
      where id = v_menu_item.id;
  end loop;

  insert into public.notifications (table_id, type, message)
  values (999, 'new_order', format('Nouvelle commande À EMPORTER (#%s) — en attente de validation', v_order_number));

  update public.active_alarm
    set table_id = 999, order_number = v_order_number,
        message = format('Commande À EMPORTER (#%s) à valider', v_order_number),
        type = 'new_order', created_at = now()
    where id = true;

  return v_order_id;
end;
$$;

grant execute on function public.create_pickup_order(jsonb, text, text) to anon, authenticated;

-- ----------------------------------------------------------------------------
-- 4) MÉTÉO (coordonnées du restaurant, pour un widget météo côté client)
-- ----------------------------------------------------------------------------
alter table public.restaurant_settings add column latitude numeric(9,6);
alter table public.restaurant_settings add column longitude numeric(9,6);

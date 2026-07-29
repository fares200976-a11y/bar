-- ============================================================================
-- 0013_staff_quick_add_items.sql
-- Permet à l'admin/manager/serveur d'ajouter directement des produits
-- (bière, vin, plat, digestif...) à l'addition d'une table depuis l'écran
-- "Plan de Salle", sans passer par le flux client (pas de validation requise
-- puisque c'est le personnel qui saisit lui-même).
--
-- Ajoute aussi un code-barres optionnel sur les produits, pour permettre à
-- l'admin de scanner un bon (code-barres / QR) et l'ajouter automatiquement
-- à l'addition de la table.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Code-barres produit (utilisé pour le scan de bon, réservé admin)
-- ----------------------------------------------------------------------------
alter table public.menu_items
  add column if not exists barcode text;

create unique index if not exists menu_items_barcode_key
  on public.menu_items (barcode)
  where barcode is not null;

-- ----------------------------------------------------------------------------
-- staff_add_items_to_table : ajout manuel (admin/manager/serveur)
-- Ajoute les articles à la commande active de la table si elle existe,
-- sinon crée une nouvelle commande directement au statut 'nouvelle'
-- (visible immédiatement en cuisine, pas de validation nécessaire).
-- ----------------------------------------------------------------------------
create or replace function public.staff_add_items_to_table(p_table_id int, p_items jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_table public.restaurant_tables%rowtype;
  v_order_id uuid;
  v_order_number int;
  v_item jsonb;
  v_menu_item public.menu_items%rowtype;
  v_qty int;
begin
  if not public.is_staff(array['admin','manager','serveur']::user_role[]) then
    raise exception 'Non autorisé.';
  end if;

  select * into v_table from public.restaurant_tables where id = p_table_id;
  if not found then
    raise exception 'Table introuvable.';
  end if;

  -- Réutilise la commande active de la table si elle existe déjà.
  select id into v_order_id
  from public.orders
  where table_id = p_table_id and status not in ('terminee', 'annulee')
  order by created_at desc
  limit 1;

  if v_order_id is null then
    insert into public.orders (table_id, waiter_id, status)
    values (p_table_id, coalesce(v_table.assigned_waiter_id, auth.uid()), 'nouvelle')
    returning id, order_number into v_order_id, v_order_number;
  else
    update public.orders set updated_at = now() where id = v_order_id
    returning order_number into v_order_number;
  end if;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    select * into v_menu_item from public.menu_items where id = (v_item->>'menuItemId')::uuid;
    if not found then
      continue;
    end if;

    v_qty := (v_item->>'quantity')::int;

    insert into public.order_items (order_id, menu_item_id, name, unit_price, quantity, notes, status)
    values (
      v_order_id,
      v_menu_item.id,
      v_menu_item.name,
      case when v_menu_item.is_promo and v_menu_item.promo_price is not null
           then v_menu_item.promo_price else v_menu_item.price end,
      v_qty,
      v_item->>'notes',
      'nouvelle'
    );

    update public.menu_items
      set stock_quantity = greatest(0, stock_quantity - v_qty),
          is_available = (greatest(0, stock_quantity - v_qty) > 0)
      where id = v_menu_item.id;
  end loop;

  -- occupied_since est géré automatiquement par le trigger trg_maintain_occupied_since,
  -- on ne le touche jamais ici.
  update public.restaurant_tables
    set status = 'commande_en_cours',
        active_order_id = v_order_id
    where id = p_table_id;

  insert into public.notifications (table_id, type, message)
  values (p_table_id, 'new_order',
    format('Produit(s) ajouté(s) par le personnel — Table %s (#%s)', p_table_id, v_order_number));

  return v_order_id;
end;
$$;

grant execute on function public.staff_add_items_to_table(int, jsonb) to authenticated;

-- ----------------------------------------------------------------------------
-- staff_add_item_by_barcode : scan de bon (admin uniquement)
-- Retrouve le produit via son code-barres puis l'ajoute à l'addition de la
-- table, en réutilisant la même logique que l'ajout manuel.
-- ----------------------------------------------------------------------------
create or replace function public.staff_add_item_by_barcode(p_table_id int, p_barcode text, p_quantity int default 1)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_menu_item public.menu_items%rowtype;
  v_items jsonb;
  v_order_id uuid;
begin
  if not public.is_staff(array['admin']::user_role[]) then
    raise exception 'Non autorisé : réservé à l''administrateur.';
  end if;

  select * into v_menu_item from public.menu_items where barcode = p_barcode;
  if not found then
    raise exception 'Aucun produit ne correspond à ce bon.';
  end if;

  v_items := jsonb_build_array(
    jsonb_build_object('menuItemId', v_menu_item.id, 'quantity', greatest(1, p_quantity))
  );

  v_order_id := public.staff_add_items_to_table(p_table_id, v_items);
  return v_order_id;
end;
$$;

grant execute on function public.staff_add_item_by_barcode(int, text, int) to authenticated;

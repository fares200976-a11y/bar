-- ============================================================================
-- 0002_functions.sql
-- Fonctions RPC "SECURITY DEFINER" : logique métier exécutée côté serveur.
-- Équivalent sécurisé des méthodes de src/services/store.ts.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Helpers de rôle
-- ----------------------------------------------------------------------------

create or replace function public.current_role()
returns user_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.is_staff(roles user_role[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select role = any(roles) from public.profiles where id = auth.uid()),
    false
  );
$$;

-- Génère un code à 4 chiffres (équivalent de generateRandom4DigitPin côté front)
create or replace function public.generate_4digit_pin()
returns text
language sql
as $$
  select lpad((floor(random() * 10000))::int::text, 4, '0');
$$;

-- ----------------------------------------------------------------------------
-- ACCÈS CLIENT (anon) — vérification du code table
-- ----------------------------------------------------------------------------

-- Recherche la table par son code (le client ne connaît que le code affiché,
-- pas forcément le numéro de table) — utilisé par la page d'accueil client.
create or replace function public.verify_and_occupy_table_by_code(p_code text)
returns table (success boolean, message text, table_id int)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_table public.restaurant_tables%rowtype;
  v_was_libre boolean;
begin
  if length(trim(p_code)) <> 4 then
    return query select false, 'Veuillez saisir les 4 chiffres du code affiché sur votre table.', null::int;
    return;
  end if;

  select * into v_table from public.restaurant_tables where access_code = trim(p_code);

  if not found then
    return query select false, 'Code invalide. Vérifiez le code à 4 chiffres affiché sur votre table.', null::int;
    return;
  end if;

  v_was_libre := (v_table.status = 'libre');

  update public.restaurant_tables set status = 'occupee' where id = v_table.id;

  insert into public.notifications (table_id, type, message)
  values (v_table.id, 'waiter_call', format('Table %s scannée et activée (Occupée) via le Code [%s]', v_table.id, p_code));

  if v_was_libre then
    update public.active_alarm
      set table_id = v_table.id, order_number = null,
          message = format('Table %s activée par un client (Code saisi)', v_table.id),
          type = 'waiter_call', created_at = now()
      where id = true;
  end if;

  return query select true, format('Accès validé pour la Table %s.', v_table.id), v_table.id;
end;
$$;

grant execute on function public.verify_and_occupy_table_by_code(text) to anon, authenticated;

-- Variante utilisée par les liens QR directs (/table/5?code=1234) : la table est
-- déjà connue, seul le code doit correspondre.
create or replace function public.verify_and_occupy_table(p_table_id int, p_code text)
returns table (success boolean, message text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_table public.restaurant_tables%rowtype;
  v_was_libre boolean;
begin
  select * into v_table from public.restaurant_tables where id = p_table_id;

  if not found then
    return query select false, 'Table introuvable.';
    return;
  end if;

  if v_table.access_code is not null and v_table.access_code <> trim(p_code) then
    return query select false, 'Code à 4 chiffres incorrect pour cette table.';
    return;
  end if;

  v_was_libre := (v_table.status = 'libre');

  update public.restaurant_tables set status = 'occupee' where id = p_table_id;

  insert into public.notifications (table_id, type, message)
  values (p_table_id, 'waiter_call', format('Table %s scannée et activée (Occupée) via le Code QR', p_table_id));

  if v_was_libre then
    update public.active_alarm
      set table_id = p_table_id, order_number = null,
          message = format('Table %s activée par un client (Scan QR Code)', p_table_id),
          type = 'waiter_call', created_at = now()
      where id = true;
  end if;

  return query select true, format('Table %s activée avec succès.', p_table_id);
end;
$$;

grant execute on function public.verify_and_occupy_table(int, text) to anon, authenticated;

-- ----------------------------------------------------------------------------
-- COMMANDE CLIENT (anon) — uniquement possible si la table est déjà 'occupee'
-- ----------------------------------------------------------------------------

create or replace function public.create_client_order(p_table_id int, p_items jsonb)
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
  select * into v_table from public.restaurant_tables where id = p_table_id;

  if not found or v_table.status <> 'occupee' then
    raise exception 'Table non vérifiée : impossible de créer une commande.';
  end if;

  insert into public.orders (table_id, waiter_id, status)
  values (p_table_id, v_table.assigned_waiter_id, 'en_attente_validation')
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

  update public.restaurant_tables
    set status = 'commande_en_cours', active_order_id = v_order_id
    where id = p_table_id;

  insert into public.notifications (table_id, type, message)
  values (p_table_id, 'new_order',
    format('Nouvelle commande (#%s) pour Table %s — en attente de validation du serveur', v_order_number, p_table_id));

  update public.active_alarm
    set table_id = p_table_id, order_number = v_order_number,
        message = format('Commande Table %s (#%s) à valider par le serveur', p_table_id, v_order_number),
        type = 'new_order', created_at = now()
    where id = true;

  return v_order_id;
end;
$$;

grant execute on function public.create_client_order(int, jsonb) to anon, authenticated;

-- Lecture du statut d'une commande précise par un client anonyme : l'UUID de la
-- commande sert de "jeton d'accès" (imprévisible), donc pas besoin de compte.
create or replace function public.get_order_for_client(p_order_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'id', o.id,
    'orderNumber', o.order_number,
    'tableId', o.table_id,
    'status', o.status,
    'createdAt', o.created_at,
    'items', coalesce(jsonb_agg(jsonb_build_object(
      'id', oi.id, 'name', oi.name, 'unitPrice', oi.unit_price,
      'quantity', oi.quantity, 'notes', oi.notes, 'status', oi.status
    )) filter (where oi.id is not null), '[]'::jsonb)
  )
  from public.orders o
  left join public.order_items oi on oi.order_id = o.id
  where o.id = p_order_id
  group by o.id;
$$;

grant execute on function public.get_order_for_client(uuid) to anon, authenticated;

create or replace function public.client_call_waiter(p_table_id int)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.orders
    set call_waiter_request = true, updated_at = now()
    where table_id = p_table_id and status not in ('terminee', 'annulee');

  insert into public.notifications (table_id, type, message)
  values (p_table_id, 'waiter_call', format('Le client de la Table %s appelle le serveur', p_table_id));

  update public.active_alarm
    set table_id = p_table_id, order_number = null,
        message = format('Table %s : appel serveur', p_table_id),
        type = 'waiter_call', created_at = now()
    where id = true;
end;
$$;

grant execute on function public.client_call_waiter(int) to anon, authenticated;

create or replace function public.client_request_bill(p_table_id int)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.orders
    set request_bill = true, bill_requested_at = now(), updated_at = now()
    where table_id = p_table_id and status not in ('terminee', 'annulee');

  insert into public.notifications (table_id, type, message)
  values (p_table_id, 'bill_request', format('Le client de la Table %s demande l''addition', p_table_id));

  update public.active_alarm
    set table_id = p_table_id, order_number = null,
        message = format('Table %s : addition demandée', p_table_id),
        type = 'bill_request', created_at = now()
    where id = true;
end;
$$;

grant execute on function public.client_request_bill(int) to anon, authenticated;

-- ----------------------------------------------------------------------------
-- PERSONNEL (authenticated) — confirmation, cuisine, encaissement
-- ----------------------------------------------------------------------------

-- Le serveur (ou admin/manager/caissier) confirme la commande client : elle
-- devient visible en cuisine ('nouvelle').
create or replace function public.confirm_order(p_order_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders%rowtype;
begin
  if not public.is_staff(array['admin','manager','serveur','caissier']::user_role[]) then
    raise exception 'Non autorisé.';
  end if;

  select * into v_order from public.orders where id = p_order_id;
  if not found or v_order.status <> 'en_attente_validation' then
    return false;
  end if;

  update public.orders
    set status = 'nouvelle',
        waiter_id = coalesce(waiter_id, auth.uid()),
        confirmed_by_waiter_id = auth.uid(),
        confirmed_at = now(),
        updated_at = now()
    where id = p_order_id;

  insert into public.notifications (table_id, type, message)
  values (v_order.table_id, 'new_order',
    format('Commande #%s confirmée — transmise en cuisine (Table %s)', v_order.order_number, v_order.table_id));

  update public.active_alarm
    set table_id = null, order_number = null, message = null, type = null, created_at = null
    where id = true and table_id = v_order.table_id and order_number = v_order.order_number;

  return true;
end;
$$;

grant execute on function public.confirm_order(uuid) to authenticated;

-- Cuisine : transitions de statut autorisées uniquement.
create or replace function public.update_order_status(p_order_id uuid, p_status order_status)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders%rowtype;
begin
  if not public.is_staff(array['admin','manager','cuisinier','serveur']::user_role[]) then
    raise exception 'Non autorisé.';
  end if;

  select * into v_order from public.orders where id = p_order_id;
  if not found then
    return;
  end if;

  update public.orders set status = p_status, updated_at = now() where id = p_order_id;

  -- Quand la commande passe "prête" ou "servie", tous ses articles suivent.
  if p_status in ('prete', 'servie') then
    update public.order_items set status = p_status where order_id = p_order_id;
  end if;

  if p_status = 'prete' then
    insert into public.notifications (table_id, type, message)
    values (v_order.table_id, 'kitchen_ready', format('Plat(s) PRÊT(S) pour Table %s !', v_order.table_id));
  end if;
end;
$$;

grant execute on function public.update_order_status(uuid, order_status) to authenticated;

create or replace function public.update_order_item_status(p_order_id uuid, p_item_id uuid, p_status order_item_status)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_all_ready boolean;
begin
  if not public.is_staff(array['admin','manager','cuisinier','serveur']::user_role[]) then
    raise exception 'Non autorisé.';
  end if;

  update public.order_items set status = p_status where id = p_item_id and order_id = p_order_id;

  select bool_and(status in ('prete', 'servie', 'annulee')) into v_all_ready
    from public.order_items where order_id = p_order_id;

  if v_all_ready then
    update public.orders set status = 'prete', updated_at = now() where id = p_order_id;
  end if;
end;
$$;

grant execute on function public.update_order_item_status(uuid, uuid, order_item_status) to authenticated;

-- Encaissement : crée la facture, clôture la commande et la table, régénère le PIN.
create or replace function public.process_bill_payment(
  p_order_id uuid,
  p_payment_method payment_method,
  p_discount numeric default 0,
  p_cash_received numeric default null,
  p_breakdown jsonb default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders%rowtype;
  v_settings public.restaurant_settings%rowtype;
  v_subtotal numeric(10,2);
  v_tax numeric(10,2);
  v_service numeric(10,2);
  v_total numeric(10,2);
  v_bill_id uuid;
  v_new_pin text;
begin
  if not public.is_staff(array['admin','manager','caissier']::user_role[]) then
    raise exception 'Non autorisé.';
  end if;

  select * into v_order from public.orders where id = p_order_id;
  if not found or v_order.status in ('terminee', 'annulee', 'en_attente_validation') then
    raise exception 'Commande introuvable ou non encaissable.';
  end if;

  select * into v_settings from public.restaurant_settings where id = true;

  select coalesce(sum(unit_price * quantity), 0) into v_subtotal
    from public.order_items where order_id = p_order_id;

  v_tax := round(v_subtotal * v_settings.vat_rate / 100, 2);
  v_service := round(v_subtotal * v_settings.service_rate / 100, 2);
  v_total := greatest(0, v_subtotal + v_tax + v_service - coalesce(p_discount, 0));

  insert into public.bills (
    order_id, table_id, subtotal, tax_rate, tax_amount, service_rate, service_amount,
    discount_amount, total, payment_method, payments_breakdown, cash_received,
    change_given, processed_by_user_id
  ) values (
    p_order_id, v_order.table_id, v_subtotal, v_settings.vat_rate, v_tax, v_settings.service_rate, v_service,
    coalesce(p_discount, 0), v_total, p_payment_method, p_breakdown, p_cash_received,
    case when p_cash_received is not null then greatest(0, p_cash_received - v_total) else null end,
    auth.uid()
  ) returning id into v_bill_id;

  update public.orders set status = 'terminee', updated_at = now() where id = p_order_id;

  v_new_pin := public.generate_4digit_pin();
  update public.restaurant_tables
    set status = 'libre', active_order_id = null, access_code = v_new_pin
    where id = v_order.table_id;

  return v_bill_id;
end;
$$;

grant execute on function public.process_bill_payment(uuid, payment_method, numeric, numeric, jsonb) to authenticated;

-- Arrêt manuel de l'alarme sonore (bouton "ARRÊTER L'ALARME").
create or replace function public.stop_alarm()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_staff(array['admin','manager','serveur','cuisinier','caissier']::user_role[]) then
    raise exception 'Non autorisé.';
  end if;

  update public.active_alarm
    set table_id = null, order_number = null, message = null, type = null, created_at = null
    where id = true;
end;
$$;

grant execute on function public.stop_alarm() to authenticated;

-- Un serveur revendique une table libre ("À moi le service !").
create or replace function public.claim_table(p_table_id int)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_staff(array['admin','manager','serveur']::user_role[]) then
    raise exception 'Non autorisé.';
  end if;

  update public.restaurant_tables set assigned_waiter_id = auth.uid() where id = p_table_id;
end;
$$;

grant execute on function public.claim_table(int) to authenticated;

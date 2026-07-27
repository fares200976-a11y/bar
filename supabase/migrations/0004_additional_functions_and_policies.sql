-- ============================================================================
-- 0004_additional_functions_and_policies.sql
-- Complète 0002/0003 : fonctions manquantes + correctif de sécurité.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- CORRECTIF : un membre du personnel pouvait mettre à jour SA PROPRE ligne
-- profiles (policy profiles_self_online_status) sans restriction de colonne —
-- ce qui lui aurait permis, en théorie, de changer son propre `role` vers
-- 'admin'. On bloque ça avec un trigger.
-- ----------------------------------------------------------------------------

create or replace function public.prevent_self_role_escalation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role <> old.role and public.current_role() <> 'admin' then
    raise exception 'Seul un administrateur peut changer un rôle.';
  end if;
  return new;
end;
$$;

create trigger trg_prevent_self_role_escalation
  before update on public.profiles
  for each row execute function public.prevent_self_role_escalation();

-- ----------------------------------------------------------------------------
-- Un serveur peut faire évoluer le statut de SES PROPRES tables directement
-- (occuper/libérer/etc.) — pas besoin de passer par une RPC pour un cas aussi
-- simple à exprimer en RLS.
-- ----------------------------------------------------------------------------

create policy tables_update_own_by_serveur on public.restaurant_tables
  for update to authenticated
  using (public.current_role() = 'serveur' and assigned_waiter_id = auth.uid())
  with check (public.current_role() = 'serveur' and assigned_waiter_id = auth.uid());

-- ----------------------------------------------------------------------------
-- Déplacer une commande active d'une table vers une autre.
-- ----------------------------------------------------------------------------

create or replace function public.move_order_between_tables(p_from_table_id int, p_to_table_id int)
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

  select * into v_order from public.orders
    where table_id = p_from_table_id and status not in ('terminee', 'annulee')
    limit 1;

  if not found then
    return false;
  end if;

  update public.orders set table_id = p_to_table_id, updated_at = now() where id = v_order.id;

  update public.restaurant_tables set status = 'libre', active_order_id = null where id = p_from_table_id;
  update public.restaurant_tables set status = 'commande_en_cours', active_order_id = v_order.id where id = p_to_table_id;

  return true;
end;
$$;

grant execute on function public.move_order_between_tables(int, int) to authenticated;

-- ----------------------------------------------------------------------------
-- Fusionner les commandes de deux tables sur la table cible.
-- ----------------------------------------------------------------------------

create or replace function public.merge_tables(p_source_table_id int, p_target_table_id int)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_source_order public.orders%rowtype;
  v_target_order public.orders%rowtype;
begin
  if not public.is_staff(array['admin','manager','serveur','caissier']::user_role[]) then
    raise exception 'Non autorisé.';
  end if;

  select * into v_source_order from public.orders
    where table_id = p_source_table_id and status not in ('terminee', 'annulee') limit 1;
  if not found then
    return false;
  end if;

  select * into v_target_order from public.orders
    where table_id = p_target_table_id and status not in ('terminee', 'annulee') limit 1;

  if not found then
    -- Pas de commande active sur la cible : simple déplacement.
    return public.move_order_between_tables(p_source_table_id, p_target_table_id);
  end if;

  update public.order_items set order_id = v_target_order.id where order_id = v_source_order.id;

  update public.orders
    set status = 'annulee', special_requests = format('Fusionnée avec Table %s', p_target_table_id)
    where id = v_source_order.id;

  update public.orders set updated_at = now() where id = v_target_order.id;

  update public.restaurant_tables set status = 'libre', active_order_id = null where id = p_source_table_id;

  insert into public.notifications (table_id, type, message)
  values (p_target_table_id, 'new_order', format('Tables %s et %s fusionnées !', p_source_table_id, p_target_table_id));

  return true;
end;
$$;

grant execute on function public.merge_tables(int, int) to authenticated;

-- ----------------------------------------------------------------------------
-- Régénérer manuellement le PIN d'une table (bouton "Régénérer" du panneau admin).
-- ----------------------------------------------------------------------------

create or replace function public.regenerate_table_pin(p_table_id int)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_new_pin text;
begin
  if not public.is_staff(array['admin','manager']::user_role[]) then
    raise exception 'Non autorisé.';
  end if;

  v_new_pin := public.generate_4digit_pin();
  update public.restaurant_tables set access_code = v_new_pin where id = p_table_id;
  return v_new_pin;
end;
$$;

grant execute on function public.regenerate_table_pin(int) to authenticated;

-- ----------------------------------------------------------------------------
-- Annuler les drapeaux "appel serveur" / "addition demandée" d'une table.
-- ----------------------------------------------------------------------------

create or replace function public.dismiss_table_call(p_table_id int)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_staff(array['admin','manager','serveur','caissier']::user_role[]) then
    raise exception 'Non autorisé.';
  end if;

  update public.orders
    set call_waiter_request = false, request_bill = false, updated_at = now()
    where table_id = p_table_id;
end;
$$;

grant execute on function public.dismiss_table_call(int) to authenticated;

-- ----------------------------------------------------------------------------
-- Notifications : vider / supprimer (tout membre du personnel connecté).
-- ----------------------------------------------------------------------------

create or replace function public.clear_notifications()
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.notifications;
$$;

grant execute on function public.clear_notifications() to authenticated;

create or replace function public.delete_notification(p_notification_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.notifications where id = p_notification_id;
$$;

grant execute on function public.delete_notification(uuid) to authenticated;

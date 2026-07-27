-- ============================================================================
-- 0010_fix_order_status_type_mismatch.sql
-- Corrige update_order_status : order_items.status est de type
-- order_item_status, mais p_status (paramètre) est de type order_status —
-- deux enums distincts qui partagent des libellés mais ne sont pas
-- interchangeables sans conversion explicite via text.
-- ============================================================================

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

  if p_status in ('prete', 'servie') then
    update public.order_items
      set status = (p_status::text)::order_item_status
      where order_id = p_order_id;
  end if;

  if p_status = 'prete' then
    insert into public.notifications (table_id, type, message)
    values (v_order.table_id, 'kitchen_ready', format('Plat(s) PRÊT(S) pour Table %s !', v_order.table_id));
  end if;
end;
$$;

grant execute on function public.update_order_status(uuid, order_status) to authenticated;

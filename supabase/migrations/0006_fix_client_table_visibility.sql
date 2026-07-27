-- ============================================================================
-- 0006_fix_client_table_visibility.sql
-- Correctif : la policy tables_select_anon ne laissait voir la table au client
-- que si son statut était exactement 'occupee'. Or dès qu'une commande est
-- passée, le statut devient 'commande_en_cours' — la table "disparaissait"
-- alors pour le client, ce qui faisait planter l'application (page blanche).
-- ============================================================================

drop policy if exists tables_select_anon on public.restaurant_tables;

create policy tables_select_anon on public.restaurant_tables
  for select to anon
  using (status <> 'libre');

-- ----------------------------------------------------------------------------
-- Le client anonyme n'avait AUCUNE policy de lecture sur orders/order_items —
-- "Suivre ma commande" ne pouvait donc jamais rien afficher. On l'autorise à
-- lire les commandes des tables qu'il peut déjà voir (donc pas 'libre').
-- ----------------------------------------------------------------------------

create policy orders_select_anon on public.orders
  for select to anon
  using (
    exists (
      select 1 from public.restaurant_tables t
      where t.id = orders.table_id and t.status <> 'libre'
    )
  );

create policy order_items_select_anon on public.order_items
  for select to anon
  using (
    exists (
      select 1 from public.orders o
      join public.restaurant_tables t on t.id = o.table_id
      where o.id = order_items.order_id and t.status <> 'libre'
    )
  );

-- ============================================================================
-- 0007_allow_table_creation.sql
-- Il manquait une policy d'INSERT sur restaurant_tables — impossible jusqu'ici
-- d'ajouter une table au-delà des 10 de départ.
-- ============================================================================

create policy tables_insert_admin on public.restaurant_tables
  for insert to authenticated
  with check (public.current_role() in ('admin', 'manager'));

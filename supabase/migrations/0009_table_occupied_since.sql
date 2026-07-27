-- ============================================================================
-- 0009_table_occupied_since.sql
-- Ajoute occupied_since : maintenu automatiquement par trigger (jamais par le
-- code applicatif), pour afficher en temps réel depuis combien de temps une
-- table est occupée.
-- ============================================================================

alter table public.restaurant_tables add column occupied_since timestamptz;

create or replace function public.maintain_occupied_since()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'libre' then
    new.occupied_since := null;
  elsif old.status = 'libre' and new.status <> 'libre' then
    new.occupied_since := now();
  end if;
  return new;
end;
$$;

create trigger trg_maintain_occupied_since
  before update on public.restaurant_tables
  for each row execute function public.maintain_occupied_since();

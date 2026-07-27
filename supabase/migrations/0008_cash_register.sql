-- ============================================================================
-- 0008_cash_register.sql
-- Tiroir-caisse (log d'ouverture) + Clôture de caisse (rapprochement espèces).
-- ============================================================================

create table public.cash_drawer_events (
  id uuid primary key default gen_random_uuid(),
  opened_by uuid references public.profiles(id) on delete set null,
  reason text,
  created_at timestamptz not null default now()
);

create table public.cash_register_closings (
  id uuid primary key default gen_random_uuid(),
  closed_by uuid references public.profiles(id) on delete set null,
  period_start timestamptz not null,
  period_end timestamptz not null,
  opening_float numeric(10,2) not null default 0,
  expected_cash numeric(10,2) not null,
  declared_cash numeric(10,2) not null,
  difference numeric(10,2) not null,
  notes text,
  created_at timestamptz not null default now()
);

alter table public.cash_drawer_events enable row level security;
alter table public.cash_register_closings enable row level security;

create policy cash_drawer_events_select_staff on public.cash_drawer_events
  for select to authenticated
  using (public.current_role() in ('admin', 'manager', 'caissier'));

create policy cash_closings_select_staff on public.cash_register_closings
  for select to authenticated
  using (public.current_role() in ('admin', 'manager', 'caissier'));

alter publication supabase_realtime add table public.cash_register_closings;

-- ----------------------------------------------------------------------------
-- Ouvrir le tiroir-caisse : on ne peut pas piloter un vrai tiroir physique
-- depuis un navigateur (ça nécessite un pilote/imprimante ticket connectée),
-- mais on trace CHAQUE ouverture pour l'audit — utile en cas de litige.
-- ----------------------------------------------------------------------------

create or replace function public.open_cash_drawer(p_reason text default 'ouverture_manuelle')
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_staff(array['admin','manager','caissier']::user_role[]) then
    raise exception 'Non autorisé.';
  end if;

  insert into public.cash_drawer_events (opened_by, reason) values (auth.uid(), p_reason);
end;
$$;

grant execute on function public.open_cash_drawer(text) to authenticated;

-- ----------------------------------------------------------------------------
-- Résumé avant clôture : combien d'espèces sont attendues depuis la dernière
-- clôture (ou depuis le début de journée s'il n'y en a jamais eu).
-- ----------------------------------------------------------------------------

create or replace function public.get_cash_register_summary()
returns table (period_start timestamptz, cash_sales numeric)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_period_start timestamptz;
begin
  if not public.is_staff(array['admin','manager','caissier']::user_role[]) then
    raise exception 'Non autorisé.';
  end if;

  select max(period_end) into v_period_start from public.cash_register_closings;
  if v_period_start is null then
    v_period_start := date_trunc('day', now());
  end if;

  return query
  select v_period_start,
         coalesce((select sum(b.total) from public.bills b
                   where b.payment_method = 'espèces' and b.paid_at > v_period_start), 0);
end;
$$;

grant execute on function public.get_cash_register_summary() to authenticated;

-- ----------------------------------------------------------------------------
-- Clôturer la caisse : compare le comptage physique déclaré par le caissier au
-- montant théorique (fond de caisse + ventes espèces depuis la dernière clôture).
-- ----------------------------------------------------------------------------

create or replace function public.close_cash_register(
  p_declared_cash numeric,
  p_opening_float numeric default 0,
  p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_period_start timestamptz;
  v_cash_sales numeric;
  v_expected numeric;
  v_id uuid;
begin
  if not public.is_staff(array['admin','manager','caissier']::user_role[]) then
    raise exception 'Non autorisé.';
  end if;

  select max(period_end) into v_period_start from public.cash_register_closings;
  if v_period_start is null then
    v_period_start := date_trunc('day', now());
  end if;

  select coalesce(sum(total), 0) into v_cash_sales
  from public.bills
  where payment_method = 'espèces' and paid_at > v_period_start;

  v_expected := p_opening_float + v_cash_sales;

  insert into public.cash_register_closings (
    closed_by, period_start, period_end, opening_float, expected_cash, declared_cash, difference, notes
  ) values (
    auth.uid(), v_period_start, now(), p_opening_float, v_expected, p_declared_cash, p_declared_cash - v_expected, p_notes
  ) returning id into v_id;

  return v_id;
end;
$$;

grant execute on function public.close_cash_register(numeric, numeric, text) to authenticated;

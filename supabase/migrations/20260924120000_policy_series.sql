-- Client-facing policy series (stable across renewals) + internal term policy_number.

create table if not exists public.policy_series (
  policy_series_id uuid primary key default gen_random_uuid(),
  series_number varchar(64) not null,
  client_id uuid not null references public.client (client_id),
  created_when timestamptz not null default now(),
  created_by varchar(255) not null default ''
);

create unique index if not exists policy_series_number_uidx
  on public.policy_series (lower(series_number));

alter table public.policy
  add column if not exists policy_series_id uuid references public.policy_series (policy_series_id);

-- Normalize legacy ATCCWI####-YYYY suffixes to a series base for grouping.
create or replace function public.normalize_policy_series_key(num text)
returns text
language sql
immutable
as $$
  select case
    when upper(trim(num)) ~ '^ATCCWI[0-9]+-(19|20)[0-9]{2}$'
      then regexp_replace(upper(trim(num)), '-(19|20)[0-9]{2}$', '')
    else upper(trim(num))
  end;
$$;

-- Backfill: one series row per normalized key; series_number = normalized base.
insert into public.policy_series (series_number, client_id, created_by, created_when)
select
  g.series_key,
  g.client_id,
  coalesce(
    (
      select p.created_by
      from public.policy p
      where public.normalize_policy_series_key(p.policy_number) = g.series_key
      order by p.created_when asc
      limit 1
    ),
    ''
  ),
  coalesce(
    (
      select p.created_when
      from public.policy p
      where public.normalize_policy_series_key(p.policy_number) = g.series_key
      order by p.created_when asc
      limit 1
    ),
    now()
  )
from (
  select distinct
    public.normalize_policy_series_key(p.policy_number) as series_key,
    p.client_id
  from public.policy p
) g
where not exists (
  select 1
  from public.policy_series ps
  where lower(ps.series_number) = lower(g.series_key)
);

update public.policy p
set policy_series_id = ps.policy_series_id
from public.policy_series ps
where p.policy_series_id is null
  and lower(ps.series_number) = lower(public.normalize_policy_series_key(p.policy_number));

alter table public.policy
  alter column policy_series_id set not null;

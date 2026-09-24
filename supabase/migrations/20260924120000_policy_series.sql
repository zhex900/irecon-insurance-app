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

-- Globally unique series numbers: one owner client per normalized key.
do $$
begin
  if exists (
    select 1
    from public.policy p
    group by public.normalize_policy_series_key(p.policy_number)
    having count(distinct p.client_id) > 1
  ) then
    raise exception
      'policy_series backfill: normalized series key is shared across clients; resolve before migrating';
  end if;
end $$;

-- One series row per normalized key; client/metadata from earliest policy for that key.
insert into public.policy_series (series_number, client_id, created_by, created_when)
select
  g.series_key,
  g.client_id,
  g.created_by,
  g.created_when
from (
  select distinct on (public.normalize_policy_series_key(p.policy_number))
    public.normalize_policy_series_key(p.policy_number) as series_key,
    p.client_id,
    p.created_by,
    p.created_when
  from public.policy p
  order by
    public.normalize_policy_series_key(p.policy_number),
    p.created_when asc,
    p.policy_id asc
) g
where not exists (
  select 1
  from public.policy_series ps
  where lower(ps.series_number) = lower(g.series_key)
);

-- Attach policies only when the series row belongs to the same client.
update public.policy p
set policy_series_id = ps.policy_series_id
from public.policy_series ps
where p.policy_series_id is null
  and lower(ps.series_number) = lower(public.normalize_policy_series_key(p.policy_number))
  and ps.client_id = p.client_id;

alter table public.policy
  alter column policy_series_id set not null;

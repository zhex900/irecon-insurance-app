-- Extend series key normalization for legacy term suffixes (-YYYY, -YYYY-MM, -YYYY-MM-DD).

create or replace function public.normalize_policy_series_key(num text)
returns text
language sql
immutable
as $$
  select case
    when upper(trim(num)) ~ '^ATCCWI[0-9]+-(19|20)[0-9]{2}-[0-9]{2}-[0-9]{2}$'
      then regexp_replace(upper(trim(num)), '-(19|20)[0-9]{2}-[0-9]{2}-[0-9]{2}$', '')
    when upper(trim(num)) ~ '^ATCCWI[0-9]+-(19|20)[0-9]{2}-[0-9]{2}$'
      then regexp_replace(upper(trim(num)), '-(19|20)[0-9]{2}-[0-9]{2}$', '')
    when upper(trim(num)) ~ '^ATCCWI[0-9]+-(19|20)[0-9]{2}$'
      then regexp_replace(upper(trim(num)), '-(19|20)[0-9]{2}$', '')
    else upper(trim(num))
  end;
$$;

-- Re-link policies using the expanded normalizer (same client guard as prior repair).
update public.policy p
set policy_series_id = null
from public.policy_series ps
where p.policy_series_id = ps.policy_series_id
  and p.client_id <> ps.client_id;

update public.policy p
set policy_series_id = ps.policy_series_id
from public.policy_series ps
where p.policy_series_id is null
  and lower(ps.series_number) = lower(public.normalize_policy_series_key(p.policy_number))
  and ps.client_id = p.client_id;

update public.policy p
set policy_series_id = ps.policy_series_id
from public.policy_series ps
where lower(ps.series_number) = lower(public.normalize_policy_series_key(p.policy_number))
  and ps.client_id = p.client_id
  and p.policy_series_id is distinct from ps.policy_series_id
  and not exists (
    select 1
    from public.policy p2
    where p2.policy_series_id = ps.policy_series_id
      and p2.client_id <> p.client_id
  );

insert into public.policy_series (series_number, client_id, created_by, created_when)
select
  g.series_key,
  g.client_id,
  g.created_by,
  g.created_when
from (
  select distinct on (
    public.normalize_policy_series_key(p.policy_number),
    p.client_id
  )
    public.normalize_policy_series_key(p.policy_number) as series_key,
    p.client_id,
    p.created_by,
    p.created_when
  from public.policy p
  where p.policy_series_id is null
  order by
    public.normalize_policy_series_key(p.policy_number),
    p.client_id,
    p.created_when asc,
    p.policy_id asc
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
  and lower(ps.series_number) = lower(public.normalize_policy_series_key(p.policy_number))
  and ps.client_id = p.client_id;

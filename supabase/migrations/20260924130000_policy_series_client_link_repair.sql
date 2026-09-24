-- Repair policies linked to a series row for a different client (older backfill without client guard).
-- Safe when 20260924120000 already ran with the previous insert/update shape.

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

-- Policies still without a series (cross-client key collision): one series per term number.
insert into public.policy_series (series_number, client_id, created_by, created_when)
select
  p.policy_number,
  p.client_id,
  p.created_by,
  p.created_when
from public.policy p
where p.policy_series_id is null
  and not exists (
    select 1
    from public.policy_series ps
    where lower(ps.series_number) = lower(p.policy_number)
  );

update public.policy p
set policy_series_id = ps.policy_series_id
from public.policy_series ps
where p.policy_series_id is null
  and lower(ps.series_number) = lower(p.policy_number)
  and ps.client_id = p.client_id;

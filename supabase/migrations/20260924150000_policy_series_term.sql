-- Term index within a policy series (0 = original; 1+ shown as #1, #2 in UI).

alter table public.policy
  add column if not exists series_term integer not null default 0;

with ranked as (
  select
    p.policy_id,
    (row_number() over (
      partition by p.policy_series_id
      order by p.date_start asc, p.created_when asc, p.policy_id asc
    ) - 1)::integer as term
  from public.policy p
)
update public.policy p
set series_term = r.term
from ranked r
where p.policy_id = r.policy_id;

create unique index if not exists policy_series_term_uidx
  on public.policy (policy_series_id, series_term);

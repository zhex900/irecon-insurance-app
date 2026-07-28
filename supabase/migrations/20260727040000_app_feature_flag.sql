-- Runtime feature flags (toggled in Settings → Features by super-admin).
create table if not exists public.app_feature_flag (
  feature_key varchar(64) primary key,
  enabled boolean not null default true,
  updated_when timestamptz not null default now(),
  updated_by varchar(255) not null default ''
);

insert into public.app_feature_flag (feature_key, enabled)
values ('audit_log', true)
on conflict (feature_key) do nothing;

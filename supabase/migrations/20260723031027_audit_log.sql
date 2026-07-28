-- Material-action audit trail (who / what / when).

create table if not exists public.audit_log (
  audit_log_id bigint generated always as identity primary key,
  occurred_at timestamptz not null default now(),
  actor_user_id uuid references public.app_user (user_id) on delete set null,
  actor_email text not null default '',
  actor_name text not null default '',
  action varchar(64) not null,
  entity_type varchar(64),
  entity_id varchar(64),
  summary text not null,
  metadata jsonb not null default '{}'::jsonb,
  request_path varchar(512)
);

create index if not exists audit_log_occurred_at_idx
  on public.audit_log (occurred_at desc);

create index if not exists audit_log_actor_occurred_at_idx
  on public.audit_log (actor_user_id, occurred_at desc);

create index if not exists audit_log_entity_idx
  on public.audit_log (entity_type, entity_id);

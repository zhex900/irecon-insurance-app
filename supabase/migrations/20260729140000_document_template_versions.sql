-- Versioned CAR document templates.
-- Generation uses the published version only; drafts are editable history.

create table if not exists public.app_document_template_version (
  document_template_version_id bigint generated always as identity primary key,
  slot_key varchar(64) not null,
  version_number integer not null,
  template_json jsonb not null,
  flow_push_down jsonb,
  merge_fields jsonb not null default '[]'::jsonb,
  is_published boolean not null default false,
  created_when timestamptz not null default now(),
  created_by varchar(255) not null default '',
  constraint app_document_template_version_slot_version_uq
    unique (slot_key, version_number)
);

create unique index if not exists app_document_template_version_one_published
  on public.app_document_template_version (slot_key)
  where is_published;

create index if not exists app_document_template_version_slot_idx
  on public.app_document_template_version (slot_key, version_number desc);

alter table public.app_document_template_version enable row level security;

-- Migrate any existing single-row overrides into published vN rows.
insert into public.app_document_template_version (
  slot_key,
  version_number,
  template_json,
  flow_push_down,
  merge_fields,
  is_published,
  created_when,
  created_by
)
select
  slot_key,
  version_number,
  template_json,
  flow_push_down,
  merge_fields,
  true,
  updated_when,
  updated_by
from public.app_document_template
on conflict (slot_key, version_number) do nothing;

drop table if exists public.app_document_template;

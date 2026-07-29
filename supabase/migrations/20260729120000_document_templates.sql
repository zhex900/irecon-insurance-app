-- CAR pdfme document templates (Settings → Document templates).
-- Overrides seeded JSON under app/assets/pdf-templates/; missing row = use seed.

create table if not exists public.app_document_template (
  slot_key varchar(64) primary key,
  template_json jsonb not null,
  flow_push_down jsonb,
  merge_fields jsonb not null default '[]'::jsonb,
  version_number integer not null default 1,
  updated_when timestamptz not null default now(),
  updated_by varchar(255) not null default ''
);

alter table public.app_document_template enable row level security;

insert into public.app_feature_flag (feature_key, enabled)
values ('document_templates', true)
on conflict (feature_key) do nothing;

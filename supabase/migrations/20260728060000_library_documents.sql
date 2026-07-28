-- Library PDFs for CARADDIT packs (Settings → Library documents). Bytes live in R2.
create table if not exists public.library_document (
  library_document_id bigint generated always as identity primary key,
  filename varchar(512) not null,
  display_name varchar(255) not null,
  r2_key varchar(512) not null,
  content_type varchar(128) not null default 'application/pdf',
  size_bytes bigint not null default 0,
  -- Optional pack rule: null = always attach; e.g. state:2 = NSW only.
  attach_rule varchar(64) not null default '',
  created_when timestamptz not null default now(),
  created_by varchar(255) not null default '',
  updated_when timestamptz not null default now(),
  updated_by varchar(255) not null default '',
  constraint library_document_filename_unique unique (filename)
);

create index if not exists library_document_created_when_idx
  on public.library_document (created_when desc);

insert into public.app_feature_flag (feature_key, enabled)
values ('library_documents', true)
on conflict (feature_key) do nothing;

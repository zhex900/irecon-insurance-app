-- Shared email footer image (singleton). Stored as a data URI blob for inline email use.
create table if not exists public.app_email_footer_image (
  id integer primary key default 1 check (id = 1),
  content_type varchar(64) not null default 'image/png',
  -- Full data URI: data:image/png;base64,...
  data_uri text not null,
  updated_when timestamptz not null default now(),
  updated_by varchar(255) not null default ''
);

alter table public.app_email_footer_image enable row level security;

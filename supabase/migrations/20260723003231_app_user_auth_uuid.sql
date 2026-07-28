-- Link app_user to Supabase Auth (auth.users).
-- No other tables FK to app_user.user_id, so recreate is safe.

drop table if exists public.app_user cascade;

create table public.app_user (
  user_id uuid primary key references auth.users (id) on delete cascade,
  full_name varchar(255) not null default '',
  email varchar(255) not null,
  role varchar(32) not null default 'broker',
  authorised_representative_id integer,
  disabled boolean not null default false,
  created_when timestamptz not null default now()
);

create unique index app_user_email_uidx on public.app_user (email);

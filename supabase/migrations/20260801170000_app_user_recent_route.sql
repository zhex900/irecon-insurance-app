-- Per-user route history stack for the side nav Recents list (max 5 kept in app code).
create table if not exists public.app_user_recent_route (
  user_id uuid not null references public.app_user (user_id) on delete cascade,
  path varchar(512) not null,
  label varchar(255) not null default '',
  visited_when timestamptz not null default now(),
  primary key (user_id, path)
);

create index if not exists app_user_recent_route_user_visited_idx
  on public.app_user_recent_route (user_id, visited_when desc);

alter table public.app_user_recent_route enable row level security;
revoke all on public.app_user_recent_route from anon, authenticated;

-- Lock down PostgREST Data API access.
-- App data access is server-side (Drizzle via DATABASE_URL / postgres role),
-- which bypasses RLS. With RLS enabled and no policies for anon/authenticated,
-- the public anon key cannot read or mutate rows.

do $$
declare
  t text;
begin
  for t in
    select c.relname
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind = 'r'
      and not c.relrowsecurity
  loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end
$$;

-- Defense in depth: remove default table privileges from API roles.
revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
alter default privileges in schema public
  revoke all on tables from anon, authenticated;
alter default privileges in schema public
  revoke all on sequences from anon, authenticated;

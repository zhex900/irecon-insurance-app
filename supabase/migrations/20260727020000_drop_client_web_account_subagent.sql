-- Remove unused client columns from the app.
alter table public.client
  drop column if exists account_client,
  drop column if exists web,
  drop column if exists sub_agent_code;

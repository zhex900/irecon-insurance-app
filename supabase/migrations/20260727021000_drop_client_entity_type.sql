-- Remove unused client entity type column.
alter table public.client
  drop column if exists entity_type_id;

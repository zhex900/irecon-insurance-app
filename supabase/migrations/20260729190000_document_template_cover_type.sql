-- Cover-linked document templates: rename slot_key, add cover_type_id + title.
-- No document_type_code. Null cover_type_id = included for every cover (e.g. adjustment).

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'app_document_template_version'
      and column_name = 'slot_key'
  )
  and not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'app_document_template_version'
      and column_name = 'document_template_key'
  ) then
    alter table public.app_document_template_version
      rename column slot_key to document_template_key;
  end if;
end $$;

alter table public.app_document_template_version
  add column if not exists cover_type_id integer,
  add column if not exists title varchar(512) not null default '';

-- Backfill from known template keys (previous asset catalogue names).
update public.app_document_template_version
set
  cover_type_id = case document_template_key
    when 'schedule-annual' then 1
    when 'rating-annual' then 1
    when 'schedule-single' then 2
    when 'rating-single' then 2
    when 'schedule-owner-builder' then 3
    when 'rating-owner-builder' then 3
    when 'adjustment' then null
    else coalesce(cover_type_id, 1)
  end,
  title = case
    when title <> '' then title
    when document_template_key = 'schedule-annual' then
      'ANNUAL CONTRACT WORKS & LIABILITY INSURANCE — SCHEDULE'
    when document_template_key = 'schedule-single' then
      'SINGLE PROJECT CONTRACT WORKS & LIABILITY INSURANCE — SCHEDULE'
    when document_template_key = 'schedule-owner-builder' then
      'OWNER BUILDER CONTRACT WORKS & LIABILITY INSURANCE — SCHEDULE'
    when document_template_key = 'rating-annual' then
      'ANNUAL CONTRACT WORKS & LIABILITY INSURANCE — RATING / ROA'
    when document_template_key = 'rating-single' then
      'SINGLE PROJECT CONTRACT WORKS & LIABILITY INSURANCE — RATING / ROA'
    when document_template_key = 'rating-owner-builder' then
      'OWNER BUILDER CONTRACT WORKS & LIABILITY INSURANCE — RATING / ROA'
    when document_template_key = 'adjustment' then
      'CAR ADJUSTMENT'
    else initcap(replace(document_template_key, '-', ' '))
  end
where title = '' or cover_type_id is null;

alter table public.app_document_template_version
  drop constraint if exists app_document_template_version_slot_version_uq;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'app_document_template_version_key_version_uq'
  ) then
    alter table public.app_document_template_version
      add constraint app_document_template_version_key_version_uq
      unique (document_template_key, version_number);
  end if;
end $$;

drop index if exists public.app_document_template_version_one_published;
create unique index if not exists app_document_template_version_one_published
  on public.app_document_template_version (document_template_key)
  where is_published;

drop index if exists public.app_document_template_version_slot_idx;
create index if not exists app_document_template_version_key_idx
  on public.app_document_template_version (document_template_key, version_number desc);

create index if not exists app_document_template_version_cover_idx
  on public.app_document_template_version (cover_type_id)
  where is_published;

-- Cover-linked document templates: rename slot_key, add cover_type_id + title.
-- No document_type_code. Null cover_type_id = included for every cover (e.g. adjustment).

alter table public.app_document_template_version
  rename column slot_key to document_template_key;

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
where true;

alter table public.app_document_template_version
  drop constraint if exists app_document_template_version_slot_version_uq;

alter table public.app_document_template_version
  add constraint app_document_template_version_key_version_uq
    unique (document_template_key, version_number);

drop index if exists public.app_document_template_version_one_published;
create unique index app_document_template_version_one_published
  on public.app_document_template_version (document_template_key)
  where is_published;

drop index if exists public.app_document_template_version_slot_idx;
create index app_document_template_version_key_idx
  on public.app_document_template_version (document_template_key, version_number desc);

create index if not exists app_document_template_version_cover_idx
  on public.app_document_template_version (cover_type_id)
  where is_published;

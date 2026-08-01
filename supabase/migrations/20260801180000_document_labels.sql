-- Labels for library docs and document templates.
-- Max length is enforced in app code (DOCUMENT_LABEL_MAX_LENGTH), not the DB.

-- Library: display_name stays varchar(255); app treats it as the editable label.

-- Templates: dedicated label column (title stays long for editor headers).
alter table public.app_document_template_version
  add column if not exists label varchar(255) not null default '';

update public.app_document_template_version
set label = left(nullif(btrim(title), ''), 255)
where btrim(coalesce(label, '')) = '';

alter table public.app_document_template_version
  alter column label set default '';

-- If an earlier labels migration narrowed columns to varchar(20), widen them.
-- App enforces DOCUMENT_LABEL_MAX_LENGTH; DB must not hard-cap at 20.

alter table public.library_document
  alter column display_name type varchar(255);

alter table public.app_document_template_version
  alter column label type varchar(255);

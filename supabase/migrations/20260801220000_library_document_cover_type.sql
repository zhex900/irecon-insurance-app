-- Library document ↔ cover type (many-to-many).
-- Empty assignment set = not attached to any cover type.
-- Mirrors legacy ProductSettings CAR *AdditionalDocs lists per cover.

create table if not exists public.library_document_cover_type (
  library_document_id bigint not null
    references public.library_document (library_document_id)
    on delete cascade,
  cover_type_id integer not null
    references public.cover_type (cover_type_id),
  primary key (library_document_id, cover_type_id)
);

create index if not exists library_document_cover_type_cover_type_id_idx
  on public.library_document_cover_type (cover_type_id);

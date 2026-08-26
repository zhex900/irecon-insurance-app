-- Replace legacy global bigint PKs on policy_document / policy_note with UUIDs.
-- Deterministic UUIDs match scripts/db/legacy/lib/legacy-id-map.mts so legacy
-- document/note imports and migration backfills stay aligned.

create extension if not exists pgcrypto;

create or replace function public.legacy_child_uuid(kind text, legacy_id bigint)
returns uuid
language plpgsql
immutable
as $$
declare
  hash bytea;
  hex text;
begin
  hash := digest(
    'irecon-insurance-legacy-v1:' || kind || ':' || legacy_id::text,
    'sha256'
  );
  hash := set_byte(hash, 7, (get_byte(hash, 7) & 15) | 64);
  hash := set_byte(hash, 9, (get_byte(hash, 9) & 63) | 128);
  hex := encode(substring(hash from 1 for 16), 'hex');
  return (
    substr(hex, 1, 8) || '-' ||
    substr(hex, 9, 4) || '-' ||
    substr(hex, 13, 4) || '-' ||
    substr(hex, 17, 4) || '-' ||
    substr(hex, 21, 12)
  )::uuid;
end;
$$;

-- policy_document
alter table public.policy_document
  add column if not exists document_id uuid;

update public.policy_document
set document_id = public.legacy_child_uuid(
  'policy-document',
  (regexp_replace(generation_key, '^legacy:', ''))::bigint
)
where document_id is null
  and generation_key ~ '^legacy:[0-9]+$';

update public.policy_document
set document_id = public.legacy_child_uuid('policy-document', policy_document_id)
where document_id is null
  and policy_document_id is not null;

update public.policy_document
set document_id = gen_random_uuid()
where document_id is null;

alter table public.policy_document
  alter column document_id set not null;

alter table public.policy_document
  drop constraint if exists policy_document_pkey;

alter table public.policy_document
  drop column if exists policy_document_id;

alter table public.policy_document
  add constraint policy_document_pkey primary key (document_id);

-- policy_note
alter table public.policy_note
  add column if not exists note_id uuid;

update public.policy_note
set note_id = public.legacy_child_uuid('policy-note', policy_note_id)
where note_id is null
  and policy_note_id is not null;

update public.policy_note
set note_id = gen_random_uuid()
where note_id is null;

alter table public.policy_note
  alter column note_id set not null;

alter table public.policy_note
  drop constraint if exists policy_note_pkey;

alter table public.policy_note
  drop column if exists policy_note_id;

alter table public.policy_note
  add constraint policy_note_pkey primary key (note_id);

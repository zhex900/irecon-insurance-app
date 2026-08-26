-- Re-align child UUIDs when 20260826100000 backfilled with gen_random_uuid()
-- before legacy import. Safe to run repeatedly (no-op when already correct).

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

update public.policy_document pd
set document_id = public.legacy_child_uuid(
  'policy-document',
  (regexp_replace(pd.generation_key, '^legacy:', ''))::bigint
)
where pd.generation_key ~ '^legacy:[0-9]+$'
  and pd.document_id is distinct from public.legacy_child_uuid(
    'policy-document',
    (regexp_replace(pd.generation_key, '^legacy:', ''))::bigint
  );

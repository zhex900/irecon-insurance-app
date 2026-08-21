-- Normalize policy_car.app_extras into typed columns and child tables.

-- 1. Add policy_car columns
alter table public.policy_car
  add column if not exists excluded_contracts_1 text not null default '',
  add column if not exists excluded_contracts_2 text not null default '',
  add column if not exists excluded_contracts_3 text not null default '',
  add column if not exists combined_broker_fee numeric(18, 4),
  add column if not exists terrorism_tier varchar(64) not null default '',
  add column if not exists is_terrorism_rate_exist boolean not null default false,
  add column if not exists premium_manual_keys jsonb not null default '[]'::jsonb,
  add column if not exists referral_reasons jsonb not null default '[]'::jsonb,
  add column if not exists excesses jsonb not null default '{}'::jsonb;

-- 2. Child tables
create table if not exists public.policy_document (
  policy_document_id bigint primary key,
  policy_id uuid not null references public.policy (policy_id) on delete cascade,
  name varchar(512) not null default '',
  filename varchar(512) not null default '',
  generation_key text not null default '',
  content text not null default '',
  template_key varchar(64),
  library_document_id bigint,
  merge_inputs jsonb,
  pdf_base64 text,
  generated_when timestamptz not null default now(),
  generated_by varchar(255) not null default '',
  document_type_code varchar(32),
  r2_key varchar(512)
);

create index if not exists policy_document_policy_id_idx
  on public.policy_document (policy_id);

create table if not exists public.policy_note (
  policy_note_id bigint primary key,
  policy_id uuid not null references public.policy (policy_id) on delete cascade,
  policy_note_type_id integer not null default 1,
  description text not null default '',
  created_when timestamptz not null default now(),
  created_by varchar(255) not null default ''
);

create index if not exists policy_note_policy_id_idx
  on public.policy_note (policy_id);

create table if not exists public.policy_car_selected_wording (
  policy_id uuid not null references public.policy (policy_id) on delete cascade,
  car_wording_id integer not null references public.car_wording (car_wording_id),
  primary key (policy_id, car_wording_id)
);

-- 3. Backfill policy_car columns from app_extras
update public.policy_car pc
set
  excluded_contracts_1 = coalesce(pc.app_extras->>'excludedContracts1', ''),
  excluded_contracts_2 = coalesce(pc.app_extras->>'excludedContracts2', ''),
  excluded_contracts_3 = coalesce(pc.app_extras->>'excludedContracts3', ''),
  combined_broker_fee = nullif(pc.app_extras->>'combinedBrokerFee', '')::numeric,
  terrorism_tier = coalesce(
    nullif(pc.app_extras->>'terrorismTier', ''),
    nullif(pc.app_extras->'rating'->>'terrorismTier', ''),
    ''
  ),
  is_terrorism_rate_exist = coalesce(
    (pc.app_extras->>'isTerrorismRateExist')::boolean,
    (pc.app_extras->'rating'->>'isTerrorismRateExist')::boolean,
    false
  ),
  premium_manual_keys = coalesce(
    case
      when jsonb_typeof(pc.app_extras->'premiumManualKeys') = 'array'
        then pc.app_extras->'premiumManualKeys'
      else '[]'::jsonb
    end,
    '[]'::jsonb
  ),
  referral_reasons = coalesce(
    case
      when jsonb_typeof(pc.app_extras->'referralReasons') = 'array'
        then pc.app_extras->'referralReasons'
      else '[]'::jsonb
    end,
    '[]'::jsonb
  ),
  excesses = coalesce(
    case
      when jsonb_typeof(pc.app_extras->'excesses') = 'object'
        then pc.app_extras->'excesses'
      else '{}'::jsonb
    end,
    '{}'::jsonb
  )
where pc.app_extras is not null
  and pc.app_extras != '{}'::jsonb;

-- Merge customWordings into wordings when wordings is empty
update public.policy_car pc
set wordings = coalesce(
  (
    select jsonb_agg(
      jsonb_build_object(
        'subject', coalesce(elem->>'subject', ''),
        'content', coalesce(elem->>'content', '')
      )
    )
    from jsonb_array_elements(pc.app_extras->'customWordings') as elem
  ),
  '[]'::jsonb
)
where jsonb_typeof(pc.app_extras->'customWordings') = 'array'
  and jsonb_array_length(pc.app_extras->'customWordings') > 0
  and (
    pc.wordings is null
    or pc.wordings = '[]'::jsonb
    or jsonb_array_length(pc.wordings) = 0
  );

-- 4. Backfill child tables from app_extras arrays
insert into public.policy_document (
  policy_document_id,
  policy_id,
  name,
  filename,
  generation_key,
  content,
  template_key,
  library_document_id,
  merge_inputs,
  pdf_base64,
  generated_when,
  generated_by,
  document_type_code,
  r2_key
)
select
  (elem->>'policyDocumentId')::bigint,
  pc.policy_id,
  left(coalesce(elem->>'name', ''), 512),
  left(coalesce(elem->>'filename', ''), 512),
  coalesce(elem->>'generationKey', ''),
  coalesce(elem->>'content', ''),
  nullif(left(coalesce(elem->>'templateKey', ''), 64), ''),
  nullif(elem->>'libraryDocumentId', '')::bigint,
  case
    when jsonb_typeof(elem->'mergeInputs') = 'object' then elem->'mergeInputs'
    else null
  end,
  nullif(elem->>'pdfBase64', ''),
  coalesce(
    nullif(elem->>'generatedWhen', '')::timestamptz,
    now()
  ),
  left(coalesce(elem->>'generatedBy', ''), 255),
  nullif(left(coalesce(elem->>'documentTypeCode', ''), 32), ''),
  nullif(left(coalesce(elem->>'r2Key', ''), 512), '')
from public.policy_car pc
cross join lateral jsonb_array_elements(pc.app_extras->'documents') as elem
where jsonb_typeof(pc.app_extras->'documents') = 'array'
  and (elem->>'policyDocumentId') ~ '^\d+$'
on conflict (policy_document_id) do nothing;

insert into public.policy_note (
  policy_note_id,
  policy_id,
  policy_note_type_id,
  description,
  created_when,
  created_by
)
select
  (elem->>'policyNoteId')::bigint,
  pc.policy_id,
  coalesce((elem->>'policyNoteTypeId')::integer, 1),
  coalesce(elem->>'description', ''),
  coalesce(
    nullif(elem->>'createdWhen', '')::timestamptz,
    now()
  ),
  left(coalesce(elem->>'createdBy', ''), 255)
from public.policy_car pc
cross join lateral jsonb_array_elements(pc.app_extras->'notes') as elem
where jsonb_typeof(pc.app_extras->'notes') = 'array'
  and (elem->>'policyNoteId') ~ '^\d+$'
on conflict (policy_note_id) do nothing;

insert into public.policy_car_selected_wording (policy_id, car_wording_id)
select
  pc.policy_id,
  (elem)::integer
from public.policy_car pc
cross join lateral jsonb_array_elements(pc.app_extras->'selectedWordingIds') as elem
where jsonb_typeof(pc.app_extras->'selectedWordingIds') = 'array'
  and jsonb_typeof(elem) = 'number'
on conflict do nothing;

-- 5. Drop interim bag
alter table public.policy_car drop column if exists app_extras;

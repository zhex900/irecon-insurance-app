-- Expand bare-number sub-limit snapshots into legacy free-text wording.
-- e.g. "10" → "10% of Contract Value", "50000" → "$50,000 any one loss".
-- Values that already contain letters, %, or $ are left unchanged.

create or replace function public._expand_sub_limit_value(
  key text,
  raw text
) returns text
language plpgsql
immutable
as $$
declare
  trimmed text := btrim(coalesce(raw, ''));
  bare text;
  n numeric;
  formatted text;
begin
  if trimmed = '' then
    return trimmed;
  end if;

  if trimmed ~* '^not\s*insured$' then
    return 'Not Insured';
  end if;

  -- Already free text
  if trimmed ~ '[a-zA-Z%$]' then
    return trimmed;
  end if;

  bare := replace(trimmed, ',', '');
  if bare !~ '^\d+(\.\d+)?$' then
    return trimmed;
  end if;

  if bare = '0' or bare = '0.0' then
    return 'Not Insured';
  end if;

  n := bare::numeric;

  if key in (
    'removalOfDebris',
    'expeditingExpenses',
    'professionalFees',
    'mitigationExpenses',
    'inflationProtection'
  ) then
    return bare || '% of Contract Value';
  end if;

  formatted := to_char(n, 'FM999,999,999,999,990');

  if key = 'employeesProperty' then
    return '$' || formatted || ' any one employee/any one loss';
  end if;

  return '$' || formatted || ' any one loss';
end;
$$;

update public.policy_car
set sub_limits = coalesce(
  (
    select jsonb_object_agg(e.key, public._expand_sub_limit_value(e.key, e.value #>> '{}'))
    from jsonb_each(sub_limits) as e
  ),
  '{}'::jsonb
)
where sub_limits is not null
  and sub_limits <> '{}'::jsonb;

drop function public._expand_sub_limit_value(text, text);

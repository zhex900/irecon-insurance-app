-- Rename Business Type → Policy Category on policy spine.
-- Idempotent: production may already have policy_category_id if policy predates phase1.
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'policy'
      and column_name = 'business_type_id'
  ) then
    alter table public.policy
      rename column business_type_id to policy_category_id;
  end if;
end $$;

comment on column public.policy.policy_category_id is
  'Policy category (New / Renewal). Formerly business_type_id.';

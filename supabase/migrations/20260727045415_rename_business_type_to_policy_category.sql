-- Rename Business Type → Policy Category on policy spine.
alter table public.policy
  rename column business_type_id to policy_category_id;

comment on column public.policy.policy_category_id is
  'Policy category (New / Renewal). Formerly business_type_id.';

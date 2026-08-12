-- The client_policy_uuid_ids migration replaced policy_id with a fresh
-- random UUID but never touched the app_extras.documents[].policyId values
-- (stored inside policy_car.app_extras JSONB). Those legacy rows still carry
-- the pre-migration numeric policyId, which fails the app's `z.string().uuid()`
-- document schema and blocks saving/generating any documents for the policy.
-- Documents always belong to their parent policy, so backfill policyId to match.

update public.policy_car pc
set app_extras = jsonb_set(
  pc.app_extras,
  '{documents}',
  coalesce(
    (
      select jsonb_agg(elem || jsonb_build_object('policyId', pc.policy_id::text))
      from jsonb_array_elements(pc.app_extras -> 'documents') as elem
    ),
    '[]'::jsonb
  )
)
where jsonb_typeof(pc.app_extras -> 'documents') = 'array';

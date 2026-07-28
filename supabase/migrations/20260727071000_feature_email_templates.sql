-- Seed email_templates feature flag (defaults enabled; super-admin can toggle).
insert into public.app_feature_flag (feature_key, enabled)
values ('email_templates', true)
on conflict (feature_key) do nothing;

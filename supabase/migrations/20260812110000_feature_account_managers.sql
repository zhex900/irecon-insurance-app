insert into public.app_feature_flag (feature_key, enabled)
values ('account_managers', true)
on conflict (feature_key) do nothing;

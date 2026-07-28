-- User profile photo: R2 object key/version; bytes live in Cloudflare R2.

alter table public.app_user
  add column if not exists avatar_r2_key varchar(512);

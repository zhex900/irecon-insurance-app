-- Display width (px) for the email footer logo in templates / outbound mail.
alter table public.app_email_footer_image
  add column if not exists display_width integer not null default 520
  check (display_width >= 200 and display_width <= 800);

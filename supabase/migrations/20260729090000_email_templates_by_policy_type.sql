-- Expand email templates: insurer + 4 broker variants (annual/renewal/single/owner builder).
-- Migrate legacy recipient_type 'broker' → 'broker_annual'.

alter table public.app_email_template
  drop constraint if exists app_email_template_recipient_type_check;

-- Move old broker row to broker_annual when present.
update public.app_email_template
set recipient_type = 'broker_annual'
where recipient_type = 'broker'
  and not exists (
    select 1 from public.app_email_template t
    where t.recipient_type = 'broker_annual'
  );

delete from public.app_email_template where recipient_type = 'broker';

alter table public.app_email_template
  add constraint app_email_template_recipient_type_check
  check (
    recipient_type in (
      'insurer',
      'broker_annual',
      'broker_renewal',
      'broker_single',
      'broker_owner_builder'
    )
  );

-- Ensure all five slots exist (bodies filled from app defaults on first list if empty).
insert into public.app_email_template (recipient_type, subject, body, to_email)
values
  ('insurer', 'CAR policy — {{policyNumber}} — {{clientName}}', '', ''),
  ('broker_annual', 'CAR Annual quotation — {{policyNumber}} — {{insuredName}}', '', ''),
  ('broker_renewal', 'CAR Annual renewal — {{policyNumber}} — {{insuredName}}', '', ''),
  ('broker_single', 'CAR Single quotation — {{policyNumber}} — {{insuredName}}', '', ''),
  (
    'broker_owner_builder',
    'CAR Owner Builder quotation — {{policyNumber}} — {{insuredName}}',
    '',
    ''
  )
on conflict (recipient_type) do nothing;

-- Email compose templates for policy documents (Settings → Email templates, super-admin).
create table if not exists public.app_email_template (
  recipient_type varchar(32) primary key
    check (recipient_type in ('broker', 'insurer')),
  subject text not null default '',
  body text not null default '',
  -- Used for insurer only; broker recipients use the client's AR email.
  to_email varchar(255) not null default '',
  updated_when timestamptz not null default now(),
  updated_by varchar(255) not null default ''
);

-- Seed legacy broker/insurer rows only on empty tables that still allow 'broker'.
-- Production may already have app_email_template from UAT with broker_annual keys.
do $$
begin
  if exists (select 1 from public.app_email_template) then
    return;
  end if;

  begin
    insert into public.app_email_template (recipient_type, subject, body, to_email)
    values
      (
        'broker',
        'CAR policy documents — {{policyNumber}}',
        E'Dear {{brokerName}},\n\nPlease find attached the documents for policy {{policyNumber}} for {{clientName}}.\n\nIf you have any questions, please reply to this email.\n\nKind regards',
        ''
      ),
      (
        'insurer',
        'CAR policy — {{policyNumber}} — {{clientName}}',
        E'Dear Underwriter,\n\nPlease find attached the documents for policy {{policyNumber}} for insured {{clientName}}.\n\nKind regards',
        ''
      )
    on conflict (recipient_type) do nothing;
  exception
    when check_violation then
      null;
  end;
end $$;

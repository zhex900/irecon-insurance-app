-- Catalogue of default CAR excess lines (db.txt PolicyCARExcessDefault; was CARExcess).
-- Per-policy overrides remain PolicyCARExcess / policy_car.app_extras for now.

create table if not exists public.policy_car_excess_default (
  policy_car_excess_default_id integer primary key,
  cover_section integer not null,
  -- CoverSection: 1 = contract works, 2 = liability
  contract_value_min numeric(18, 4) not null default 0,
  contract_value_max numeric(18, 4) not null default 0,
  liability_limit_millions integer not null default 0,
  name varchar(255) not null default '',
  display_order integer not null,
  excess varchar(64) not null default '',
  is_group_heading boolean not null default false,
  trailer varchar(255) not null default '',
  additional_notes boolean not null default false
);

comment on table public.policy_car_excess_default is
  'Default excess catalogue for new CAR policies (was CARExcess)';

-- Seed matches db.txt Records PolicyCARExcessDefault
insert into public.policy_car_excess_default (
  policy_car_excess_default_id,
  cover_section,
  contract_value_min,
  contract_value_max,
  name,
  display_order,
  excess,
  is_group_heading,
  trailer,
  liability_limit_millions,
  additional_notes
) values
  (1, 1, 0, 0, 'Named Insured Plant & Equipment', 1, '$2,500', false, 'each and every loss', 0, false),
  (2, 1, 0, 0, 'Contract Value up to $2,000,000', 2, '', true, '', 0, false),
  (3, 1, 0, 2000000, 'Minor Perils', 3, '$1,000', false, 'each and every loss', 0, false),
  (4, 1, 0, 2000000, 'Major Perils', 4, '$1,000', false, 'each and every loss', 0, false),
  (5, 1, 0, 0, 'Contract Value up $2,000,000 to $5,000,000', 5, '', true, '', 0, false),
  (6, 1, 2000001, 5000000, 'Minor Perils', 6, '$2,500', false, 'each and every loss', 0, false),
  (7, 1, 2000001, 5000000, 'Major Perils', 7, '$5,000', false, 'each and every loss', 0, false),
  (8, 1, 0, 0, '', 8, '', false, '', 0, true),
  (9, 2, 0, 0, 'Worker to Worker', 9, '$15,000', false, 'each and every Occurrence', 0, false),
  (10, 2, 0, 0, 'Contract Value up to $2,000,000', 10, '', true, '', 0, false),
  (11, 2, 0, 2000000, '$10m Limit of Liability', 11, '$1,000', false, 'each and every Occurrence', 10, false),
  (12, 2, 0, 2000000, '$20m Limit of Liability', 12, '$2,500', false, 'each and every Occurrence', 20, false),
  (13, 2, 0, 0, 'Contract Value up $2,000,000 to $5,000,000', 13, '', true, '', 0, false),
  (14, 2, 2000001, 5000000, '$10m Limit of Liability', 14, '$2,500', false, 'each and every Occurrence', 10, false),
  (15, 2, 2000001, 5000000, '$20m Limit of Liability', 15, '$2,500', false, 'each and every Occurrence', 20, false)
on conflict (policy_car_excess_default_id) do nothing;

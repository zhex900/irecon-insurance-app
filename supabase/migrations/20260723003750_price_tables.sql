-- Versioned CAR pricing catalogues from db.txt (Price*, BrokerFeeSchedule*).
-- Lookups State / CoverType / PolicyType seeded here so rate FKs resolve.
-- No admin UI in Phase 1 — load via seed; calculator reads these tables.

create table if not exists public.policy_type (
  policy_type_id integer primary key,
  code varchar(32) not null,
  name varchar(64) not null
);

create table if not exists public.cover_type (
  cover_type_id integer primary key,
  name varchar(64) not null
);

create table if not exists public.state (
  state_id integer primary key,
  code varchar(8) not null unique,
  name varchar(64) not null
);

create table if not exists public.broker_fee_schedule (
  broker_fee_schedule_id serial primary key,
  policy_type_id integer not null default 1 references public.policy_type (policy_type_id),
  date_start date not null,
  published boolean not null default false,
  date_published timestamptz,
  created_when timestamptz not null default now(),
  created_by varchar(255) not null default ''
);

create table if not exists public.broker_fee_schedule_line (
  broker_fee_schedule_id integer not null references public.broker_fee_schedule (broker_fee_schedule_id) on delete cascade,
  sort_order integer not null,
  name varchar(255) not null default '',
  -- Default amounts used when creating PolicyFee lines (not in db.txt Name-only line; required for calc).
  fee numeric(18, 4) not null default 0,
  fee_gst numeric(18, 4) not null default 0,
  primary key (broker_fee_schedule_id, sort_order)
);

create table if not exists public.price (
  price_id serial primary key,
  policy_type_id integer not null default 1 references public.policy_type (policy_type_id),
  date_start date not null,
  published boolean not null default false,
  date_published timestamptz,
  created_when timestamptz not null default now(),
  created_by varchar(255) not null default ''
);

create table if not exists public.price_car (
  price_id integer not null references public.price (price_id) on delete cascade,
  cover_type_id integer not null references public.cover_type (cover_type_id),
  turnover_min numeric(18, 4) not null,
  turnover_max numeric(18, 4),
  contract_works_rate numeric(18, 8) not null default 0,
  contract_works_min_premium numeric(18, 4) not null default 0,
  liability_10m_rate numeric(18, 8) not null default 0,
  liability_10m_min_premium numeric(18, 4) not null default 0,
  liability_20m_rate numeric(18, 8) not null default 0,
  liability_20m_min_premium numeric(18, 4) not null default 0,
  primary key (price_id, cover_type_id, turnover_min)
);

create table if not exists public.price_esl (
  price_esl_id serial primary key,
  policy_type_id integer not null default 1 references public.policy_type (policy_type_id),
  date_start date not null,
  published boolean not null default false,
  date_published timestamptz,
  created_when timestamptz not null default now(),
  created_by varchar(255) not null default ''
);

create table if not exists public.price_esl_rate (
  price_esl_rate_id serial primary key,
  price_esl_id integer not null references public.price_esl (price_esl_id) on delete cascade,
  state_id integer not null references public.state (state_id),
  construction_rate numeric(18, 8) not null default 0,
  plant_rate numeric(18, 8) not null default 0
);

create table if not exists public.price_plant (
  price_plant_id serial primary key,
  policy_type_id integer not null default 1 references public.policy_type (policy_type_id),
  rate numeric(18, 8) not null default 0,
  -- Calculator banding (used by car-calculator plant value clamps).
  plant_min_value numeric(18, 4) not null default 0,
  plant_max_value numeric(18, 4) not null default 0,
  date_start date not null,
  published boolean not null default false,
  date_published timestamptz,
  created_when timestamptz not null default now(),
  created_by varchar(255) not null default ''
);

create table if not exists public.price_stamp_duty (
  price_stamp_duty_id serial primary key,
  policy_type_id integer not null default 1 references public.policy_type (policy_type_id),
  date_start date not null,
  published boolean not null default false,
  date_published timestamptz,
  created_when timestamptz not null default now(),
  created_by varchar(255) not null default ''
);

create table if not exists public.price_stamp_duty_rate (
  price_stamp_duty_rate_id serial primary key,
  price_stamp_duty_id integer not null references public.price_stamp_duty (price_stamp_duty_id) on delete cascade,
  state_id integer not null references public.state (state_id),
  rate numeric(18, 8) not null default 0
);

create table if not exists public.price_terrorism (
  price_terrorism_id serial primary key,
  policy_type_id integer not null default 1 references public.policy_type (policy_type_id),
  date_start date not null,
  published boolean not null default false,
  date_published timestamptz,
  created_when timestamptz not null default now(),
  created_by varchar(255) not null default ''
);

create table if not exists public.price_terrorism_rate (
  price_terrorism_rate_id serial primary key,
  price_terrorism_id integer not null references public.price_terrorism (price_terrorism_id) on delete cascade,
  tier varchar(32) not null,
  rate numeric(18, 8) not null default 0
);

create table if not exists public.price_terrorism_postcode (
  price_terrorism_rate_id integer not null references public.price_terrorism_rate (price_terrorism_rate_id) on delete cascade,
  postcode varchar(16) not null,
  state_id integer not null references public.state (state_id),
  primary key (price_terrorism_rate_id, postcode)
);

-- Minimal lookup seeds (also in db.txt Records)
insert into public.policy_type (policy_type_id, code, name) values
  (1, 'CAR', 'Construction All Risk')
on conflict (policy_type_id) do nothing;

insert into public.cover_type (cover_type_id, name) values
  (1, 'Annual'),
  (2, 'Single'),
  (3, 'Owner Builder')
on conflict (cover_type_id) do nothing;

insert into public.state (state_id, code, name) values
  (1, 'ACT', 'Australian Capital Territory'),
  (2, 'NSW', 'New South Wales'),
  (3, 'NT', 'Northern Territory'),
  (4, 'QLD', 'Queensland'),
  (5, 'SA', 'South Australia'),
  (6, 'TAS', 'Tasmania'),
  (7, 'VIC', 'Victoria'),
  (8, 'WA', 'Western Australia')
on conflict (state_id) do nothing;

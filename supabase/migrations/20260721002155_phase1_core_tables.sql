-- Phase 1 core tables (db.txt) — mutable entities used by the web app.
-- Lookups remain in app JSON for now. Auth profile uses interim serial PK.

create table if not exists public.authorised_representative (
  authorised_representative_id serial primary key,
  full_name varchar(255) not null default '',
  company_name varchar(255) not null default '',
  ar_number varchar(64) not null default '',
  mobile_phone varchar(64) not null default '',
  business_phone varchar(64) not null default '',
  email varchar(255) not null default '',
  own_broker boolean not null default false,
  created_when timestamptz not null default now(),
  created_by varchar(255) not null default ''
);

create table if not exists public.app_user (
  user_id serial primary key,
  full_name varchar(255) not null default '',
  email varchar(255) not null,
  role varchar(32) not null default 'broker',
  authorised_representative_id integer,
  disabled boolean not null default false,
  created_when timestamptz not null default now()
);

create table if not exists public.client (
  client_id serial primary key,
  name varchar(255) not null default '',
  trading_name varchar(255) not null default '',
  abn varchar(32) not null default '',
  phone varchar(64) not null default '',
  email varchar(255) not null default '',
  account_manager_id integer not null default 1,
  client_source_id integer not null default 16,
  authorised_representative_id integer not null default 1,
  created_when timestamptz not null default now(),
  created_by varchar(255) not null default ''
);

create table if not exists public.policy (
  policy_id serial primary key,
  client_id integer not null references public.client (client_id),
  policy_type_id integer not null default 1,
  policy_status_id integer not null default 1,
  postcode varchar(16) not null default '',
  state_id integer not null default 2,
  business_type_id integer not null default 1,
  policy_number varchar(64) not null,
  date_start timestamptz not null,
  date_end timestamptz not null,
  insurer_code varchar(32) not null default 'ATC',
  policy_group_id integer,
  copied_from_policy_id integer,
  taken_at timestamptz,
  taken_by varchar(255),
  is_draft boolean not null default true,
  created_when timestamptz not null default now(),
  created_by varchar(255) not null default '',
  updated_when timestamptz
);

create table if not exists public.policy_car (
  policy_id integer primary key references public.policy (policy_id) on delete cascade,
  cover_type_id integer not null default 1,
  site_address text not null default '',
  insured_name varchar(255) not null default '',
  estimated_turnover numeric(18, 2) not null default 0,
  business_activities text not null default '',
  insured_contracts text not null default '',
  geographical_scopes text not null default '',
  plant_equipment numeric(18, 2) not null default 0,
  existing_structure numeric(18, 2) not null default 0,
  display_homes numeric(18, 2) not null default 0,
  claims_count_last_3_years integer not null default 0,
  any_claims_exceed_20k boolean not null default false,
  declaration_confirmed boolean not null default false,
  contract_works_sum_insured numeric(18, 2) not null default 0,
  liability_limit_band integer not null default 1,
  has_existing_contract_works_cover boolean not null default false,
  current_insurer varchar(255) not null default '',
  maximum_construction_period integer not null default 18,
  maximum_maintenance_period integer not null default 12,
  contract_works_calculated_base_premium numeric(18, 4),
  contract_works_base_premium numeric(18, 4),
  contract_works_existing_structure_premium numeric(18, 4),
  contract_works_plant_premium numeric(18, 4),
  contract_works_plant_esl numeric(18, 4),
  contract_works_esl numeric(18, 4),
  contract_works_gst numeric(18, 4),
  contract_works_stamp_duty numeric(18, 4),
  contract_works_terrorism_premium numeric(18, 4),
  contract_works_plant_terrorism_premium numeric(18, 4),
  contract_works_display_homes_premium numeric(18, 4),
  contract_works_total_premium numeric(18, 4),
  liability_calculated_base_premium numeric(18, 4),
  liability_base_premium numeric(18, 4),
  liability_esl numeric(18, 4),
  liability_gst numeric(18, 4),
  liability_stamp_duty numeric(18, 4),
  liability_total_premium numeric(18, 4),
  original_total_premium numeric(18, 4),
  contract_works_applied_rate numeric(18, 8),
  liability_applied_rate numeric(18, 8),
  price_id integer,
  price_stamp_duty_id integer,
  price_esl_id integer,
  price_terrorism_id integer,
  price_plant_id integer,
  annual_cover_type_id integer,
  plant_rate numeric(18, 8),
  esl_rate numeric(18, 8),
  plant_esl_rate numeric(18, 8),
  contract_works_stamp_duty_rate numeric(18, 8),
  liability_stamp_duty_rate numeric(18, 8),
  contract_works_min_premium numeric(18, 4),
  liability_min_premium numeric(18, 4),
  plant_value_min numeric(18, 2),
  plant_value_max numeric(18, 2),
  terrorism_rate numeric(18, 8),
  manual_tax_override boolean not null default false,
  sub_limits jsonb not null default '{}'::jsonb,
  wordings jsonb not null default '[]'::jsonb,
  app_extras jsonb not null default '{}'::jsonb
);

create table if not exists public.policy_car_adjustment (
  policy_id integer primary key references public.policy (policy_id) on delete cascade,
  adjusted_turnover numeric(18, 2) not null default 0,
  stamp_duty_exempt boolean not null default false,
  delta_contract_works_base_premium numeric(18, 4) not null default 0,
  delta_contract_works_terrorism_premium numeric(18, 4) not null default 0,
  delta_contract_works_esl numeric(18, 4) not null default 0,
  delta_contract_works_gst numeric(18, 4) not null default 0,
  delta_contract_works_stamp_duty numeric(18, 4) not null default 0,
  delta_contract_works_total_premium numeric(18, 4) not null default 0,
  delta_liability_base_premium numeric(18, 4) not null default 0,
  delta_liability_esl numeric(18, 4) not null default 0,
  delta_liability_gst numeric(18, 4) not null default 0,
  delta_liability_stamp_duty numeric(18, 4) not null default 0,
  delta_liability_total_premium numeric(18, 4) not null default 0,
  delta_total_premium numeric(18, 4) not null default 0,
  app_snapshot jsonb,
  created_when timestamptz not null default now(),
  created_by varchar(255) not null default '',
  updated_when timestamptz,
  updated_by varchar(255)
);

create index if not exists policy_client_id_idx on public.policy (client_id);
create index if not exists client_name_idx on public.client (name);
create unique index if not exists app_user_email_uidx on public.app_user (email);

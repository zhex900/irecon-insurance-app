-- Convert client + policy primary keys from serial integers to UUID.
-- Routes will use UUIDs; policy_number becomes the human-facing unique key.
-- Also adds policy_number_seq for allocating ATCCWI#### numbers independently of the PK.
-- Idempotent: production may already have UUID PKs from UAT.

create extension if not exists pgcrypto;

create sequence if not exists public.policy_number_seq start with 1000;

do $$
declare
  policy_id_type text;
begin
  select c.data_type
  into policy_id_type
  from information_schema.columns c
  where c.table_schema = 'public'
    and c.table_name = 'policy'
    and c.column_name = 'policy_id';

  if policy_id_type is null then
    return;
  end if;

  if policy_id_type = 'uuid' then
    perform setval(
      'public.policy_number_seq',
      greatest(
        1000,
        coalesce(
          (
            select max(
              nullif(regexp_replace(p.policy_number, '\D', '', 'g'), '')::bigint
            )
            from public.policy p
          ),
          1000
        )
      )
    );
    return;
  end if;

  perform setval(
    'public.policy_number_seq',
    greatest(
      1000,
      coalesce((select max(policy_id) from public.policy), 1000)
    )
  );
end $$;

do $$
begin
  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'policy'
      and column_name = 'policy_id'
      and data_type = 'integer'
  ) then
    return;
  end if;

  alter table public.policy
    drop constraint if exists policy_client_id_fkey;

  alter table public.policy_car
    drop constraint if exists policy_car_policy_id_fkey;

  alter table public.policy_car_adjustment
    drop constraint if exists policy_car_adjustment_policy_id_fkey;

  alter table public.client
    add column if not exists client_id_uuid uuid;

  update public.client
  set client_id_uuid = gen_random_uuid()
  where client_id_uuid is null;

  alter table public.client
    alter column client_id_uuid set not null;

  alter table public.client
    alter column client_id_uuid set default gen_random_uuid();

  alter table public.policy
    add column if not exists policy_id_uuid uuid;

  alter table public.policy
    add column if not exists client_id_uuid uuid;

  alter table public.policy
    add column if not exists copied_from_policy_id_uuid uuid;

  update public.policy
  set policy_id_uuid = gen_random_uuid()
  where policy_id_uuid is null;

  update public.policy p
  set client_id_uuid = c.client_id_uuid
  from public.client c
  where c.client_id = p.client_id
    and p.client_id_uuid is null;

  update public.policy p
  set copied_from_policy_id_uuid = src.policy_id_uuid
  from public.policy src
  where src.policy_id = p.copied_from_policy_id
    and p.copied_from_policy_id is not null
    and p.copied_from_policy_id_uuid is null;

  alter table public.policy
    alter column policy_id_uuid set not null;

  alter table public.policy
    alter column policy_id_uuid set default gen_random_uuid();

  alter table public.policy
    alter column client_id_uuid set not null;

  alter table public.policy_car
    add column if not exists policy_id_uuid uuid;

  alter table public.policy_car_adjustment
    add column if not exists policy_id_uuid uuid;

  update public.policy_car pc
  set policy_id_uuid = p.policy_id_uuid
  from public.policy p
  where p.policy_id = pc.policy_id
    and pc.policy_id_uuid is null;

  update public.policy_car_adjustment pca
  set policy_id_uuid = p.policy_id_uuid
  from public.policy p
  where p.policy_id = pca.policy_id
    and pca.policy_id_uuid is null;

  alter table public.policy_car
    alter column policy_id_uuid set not null;

  alter table public.policy_car_adjustment
    alter column policy_id_uuid set not null;

  alter table public.policy_car drop constraint if exists policy_car_pkey;
  alter table public.policy_car_adjustment drop constraint if exists policy_car_adjustment_pkey;
  alter table public.policy drop constraint if exists policy_pkey;
  alter table public.client drop constraint if exists client_pkey;

  alter table public.policy_car drop column policy_id;
  alter table public.policy_car_adjustment drop column policy_id;
  alter table public.policy drop column policy_id;
  alter table public.policy drop column client_id;
  alter table public.policy drop column copied_from_policy_id;
  alter table public.client drop column client_id;

  alter table public.client rename column client_id_uuid to client_id;
  alter table public.policy rename column policy_id_uuid to policy_id;
  alter table public.policy rename column client_id_uuid to client_id;
  alter table public.policy rename column copied_from_policy_id_uuid to copied_from_policy_id;
  alter table public.policy_car rename column policy_id_uuid to policy_id;
  alter table public.policy_car_adjustment rename column policy_id_uuid to policy_id;

  alter table public.client
    add primary key (client_id);

  alter table public.policy
    add primary key (policy_id);

  alter table public.policy_car
    add primary key (policy_id);

  alter table public.policy_car_adjustment
    add primary key (policy_id);

  alter table public.policy
    add constraint policy_client_id_fkey
    foreign key (client_id) references public.client (client_id);

  alter table public.policy_car
    add constraint policy_car_policy_id_fkey
    foreign key (policy_id) references public.policy (policy_id)
    on delete cascade;

  alter table public.policy_car_adjustment
    add constraint policy_car_adjustment_policy_id_fkey
    foreign key (policy_id) references public.policy (policy_id)
    on delete cascade;

  create index if not exists policy_client_id_idx on public.policy (client_id);
end $$;

-- Unique indexed policy numbers (human-facing).
with ranked as (
  select
    policy_id,
    policy_number,
    row_number() over (
      partition by lower(policy_number)
      order by created_when asc, policy_id asc
    ) as rn
  from public.policy
)
update public.policy p
set policy_number = p.policy_number || '-' || substr(p.policy_id::text, 1, 8)
from ranked r
where r.policy_id = p.policy_id
  and r.rn > 1;

create unique index if not exists policy_policy_number_uidx
  on public.policy (lower(policy_number));

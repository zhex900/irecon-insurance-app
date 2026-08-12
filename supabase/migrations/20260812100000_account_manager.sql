-- Account managers (legacy AccountManager lookup) — referenced by client.account_manager_id.

create table if not exists public.account_manager (
  account_manager_id serial primary key,
  full_name varchar(255) not null default '',
  abbrev varchar(64) not null default '',
  email varchar(255) not null default '',
  ar_number varchar(255) not null default '',
  mobile varchar(64) not null default '',
  created_when timestamptz not null default now(),
  created_by varchar(255) not null default 'migration'
);

insert into public.account_manager (
  account_manager_id,
  full_name,
  abbrev,
  email,
  ar_number,
  mobile
)
values
  (
    1,
    'Loretta Casey',
    'Loretta',
    'lcasey@irecon.com.au',
    'Authorised Representative No. 1239170',
    '0499 221 761'
  ),
  (
    2,
    'Justin Kinnear',
    'Justin',
    'jkinnear@irecon.com.au',
    'Authorised Representative No. 1245239',
    '0452 646 764'
  ),
  (
    3,
    'Lesley Connolly',
    'Lesley',
    'lconnolly@irecon.com.au',
    'Authorised Representative No. 300468',
    '0405 684 083'
  ),
  (
    4,
    'Renee Dennis',
    'Renee',
    'rdennis@irecon.com.au',
    'Authorised Representative No. 1283254',
    '0450 774 880'
  ),
  (
    5,
    'Robyn Vardy',
    'Robyn',
    'rvardy@irecon.com.au',
    'Authorised Representative No. 1233987',
    '0452 646 764'
  ),
  (
    6,
    'Tracey Ferraro',
    'Tracey',
    'admin@irecon.com.au',
    'On behalf of Lesley Connolly',
    ''
  )
on conflict (account_manager_id) do nothing;

select setval(
  pg_get_serial_sequence('public.account_manager', 'account_manager_id'),
  (select coalesce(max(account_manager_id), 1) from public.account_manager)
);

alter table public.client
  drop constraint if exists client_account_manager_id_fkey;

alter table public.client
  add constraint client_account_manager_id_fkey
  foreign key (account_manager_id)
  references public.account_manager (account_manager_id);

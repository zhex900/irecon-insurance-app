-- CAR wording reference table (maps to db.txt CARWording)
create table if not exists public.car_wording (
  car_wording_id integer primary key,
  subject text not null,
  content text not null
);

comment on table public.car_wording is 'CAR policy additional wording options for broker quote form';

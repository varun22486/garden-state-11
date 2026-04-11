-- Shared finance document for Garden State 11 (one row per deploy)
create table if not exists finance_state (
  id text primary key,
  payload jsonb not null,
  revision integer not null default 0,
  updated_at timestamp with time zone default now()
);

alter table finance_state enable row level security;

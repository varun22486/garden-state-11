-- Auto-backup overflow from browsers (keeps last 5 locally; older rows land here)
create table if not exists finance_snapshots (
  id text primary key,
  saved_at timestamp with time zone not null default now(),
  payload jsonb not null
);

create index if not exists finance_snapshots_saved_at_idx on finance_snapshots (saved_at desc);

alter table finance_snapshots enable row level security;

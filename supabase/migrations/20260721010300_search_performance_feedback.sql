-- First-party Search Console snapshots used for a private, human-operated
-- performance feedback loop. These records never authorize content publishing,
-- spending, outreach, or deployment.

create table if not exists public.search_console_query_snapshots (
  observed_on date not null,
  query text not null check (char_length(query) between 2 and 500),
  clicks integer not null check (clicks >= 0),
  impressions integer not null check (impressions >= 0),
  ctr numeric(8,4) not null check (ctr >= 0 and ctr <= 100),
  position numeric(8,3) not null check (position >= 0),
  imported_at timestamptz not null default now(),
  primary key (observed_on, query)
);

create index if not exists search_console_query_snapshots_observed_idx
  on public.search_console_query_snapshots (observed_on desc, impressions desc);

alter table public.search_console_query_snapshots enable row level security;
revoke all on table public.search_console_query_snapshots from public, anon, authenticated;
grant select, insert, update on table public.search_console_query_snapshots to service_role;

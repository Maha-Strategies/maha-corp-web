create table if not exists public.inbound_submission_rate_windows (
  visitor_hash text primary key check (visitor_hash ~ '^sha256:[a-f0-9]{64}$'),
  window_started_at timestamptz not null,
  request_count smallint not null check (request_count between 1 and 20),
  updated_at timestamptz not null default now()
);

create table if not exists public.inbound_submissions (
  public_id text primary key check (public_id ~ '^inbound_[a-f0-9]{32}$'),
  visitor_hash text not null check (visitor_hash ~ '^sha256:[a-f0-9]{64}$'),
  idempotency_hash text not null check (idempotency_hash ~ '^sha256:[a-f0-9]{64}$'),
  offer_id text not null check (offer_id in ('mps-prepaid-audit-access','mps-preflight','book-the-imagined-life','book-the-orbital-mind','book-the-synthetic-self','book-the-unfinished-species','rapid-intelligence-brief','verified-research-brief')),
  requester_name text not null, requester_email text not null, requester_organization text,
  decision text not null, question text not null, deadline text, context text, agent jsonb,
  qualification_status text not null check (qualification_status in ('qualified','needs_clarification')),
  qualification_reasons text[] not null default '{}'::text[], revenue_opportunity_id text references public.revenue_opportunities(public_id) on delete restrict,
  digest_sent_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (visitor_hash, idempotency_hash)
);
create index if not exists inbound_submissions_digest_idx on public.inbound_submissions (qualification_status, digest_sent_at, created_at asc);
alter table public.inbound_submission_rate_windows enable row level security;
alter table public.inbound_submissions enable row level security;
revoke all on table public.inbound_submission_rate_windows, public.inbound_submissions from public, anon, authenticated;
grant select, insert, update on table public.inbound_submission_rate_windows, public.inbound_submissions to service_role;

create or replace function public.consume_inbound_submission_rate_limit(p_visitor_hash text, p_limit integer)
returns boolean language plpgsql security invoker set search_path = public as $$
declare v_now timestamptz := clock_timestamp();
begin
  if p_visitor_hash !~ '^sha256:[a-f0-9]{64}$' or p_limit < 1 or p_limit > 20 then raise exception 'Invalid inbound rate limit.' using errcode='22023'; end if;
  insert into public.inbound_submission_rate_windows (visitor_hash,window_started_at,request_count,updated_at) values (p_visitor_hash,v_now,1,v_now)
  on conflict (visitor_hash) do update set window_started_at=case when public.inbound_submission_rate_windows.window_started_at <= v_now - interval '1 hour' then v_now else public.inbound_submission_rate_windows.window_started_at end,
    request_count=case when public.inbound_submission_rate_windows.window_started_at <= v_now - interval '1 hour' then 1 else public.inbound_submission_rate_windows.request_count + 1 end, updated_at=v_now
  where public.inbound_submission_rate_windows.window_started_at <= v_now - interval '1 hour' or public.inbound_submission_rate_windows.request_count < p_limit;
  return found;
end;
$$;
revoke all on function public.consume_inbound_submission_rate_limit(text,integer) from public, anon, authenticated;
grant execute on function public.consume_inbound_submission_rate_limit(text,integer) to service_role;

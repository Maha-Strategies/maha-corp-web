-- One shared rolling window per credential. The atomic upsert keeps rate-limit
-- decisions consistent across independent serverless runtime instances.
create table if not exists public.agent_credential_rate_windows (
  credential_id text primary key references public.agent_client_credentials(public_id) on delete cascade,
  window_started_at timestamptz not null,
  request_count smallint not null check (request_count between 1 and 100),
  updated_at timestamptz not null default now()
);

create or replace function public.consume_agent_credential_rate_limit(
  p_credential_id text,
  p_limit integer
)
returns boolean
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_count smallint;
begin
  if p_credential_id !~ '^cred_[a-f0-9]{32}$' or p_limit < 1 or p_limit > 100 then
    raise exception 'Invalid credential rate-limit request.' using errcode = '22023';
  end if;

  insert into public.agent_credential_rate_windows
    (credential_id, window_started_at, request_count, updated_at)
  values
    (p_credential_id, v_now, 1, v_now)
  on conflict (credential_id) do update
    set window_started_at = case
          when public.agent_credential_rate_windows.window_started_at <= v_now - interval '1 hour' then v_now
          else public.agent_credential_rate_windows.window_started_at
        end,
        request_count = case
          when public.agent_credential_rate_windows.window_started_at <= v_now - interval '1 hour' then 1
          else public.agent_credential_rate_windows.request_count + 1
        end,
        updated_at = v_now
    where public.agent_credential_rate_windows.window_started_at <= v_now - interval '1 hour'
       or public.agent_credential_rate_windows.request_count < p_limit
  returning request_count into v_count;

  return found;
end;
$$;

alter table public.agent_credential_rate_windows enable row level security;

revoke all on table public.agent_credential_rate_windows from anon, authenticated;
revoke all on function public.consume_agent_credential_rate_limit(text, integer) from public, anon, authenticated;
grant execute on function public.consume_agent_credential_rate_limit(text, integer) to service_role;

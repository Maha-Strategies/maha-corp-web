-- Minimum operational control plane for private, audited interventions.
-- Operator actions are immutable; credit corrections append ledger entries and
-- credential replacement never stores a plaintext credential.
create table if not exists public.mps_operator_actions (
  public_id text primary key check (public_id ~ '^mpsop_[a-f0-9]{32}$'),
  action_type text not null check (action_type in ('credit_adjustment', 'credential_revocation', 'credential_replacement')),
  idempotency_hash text not null unique check (idempotency_hash ~ '^sha256:[a-f0-9]{64}$'),
  request_hash text not null check (request_hash ~ '^sha256:[a-f0-9]{64}$'),
  actor_fingerprint text not null check (actor_fingerprint ~ '^sha256:[a-f0-9]{64}$'),
  client_id text not null references public.agent_clients(public_id) on delete restrict,
  credential_id text references public.agent_client_credentials(public_id) on delete restrict,
  replacement_credential_id text references public.agent_client_credentials(public_id) on delete restrict,
  reason text not null check (char_length(reason) between 3 and 500),
  reference_id text not null check (char_length(reference_id) between 3 and 200),
  action_result jsonb not null,
  created_at timestamptz not null default now(),
  check (
    (action_type = 'credit_adjustment' and credential_id is null and replacement_credential_id is null)
    or (action_type = 'credential_revocation' and credential_id is not null and replacement_credential_id is null)
    or (action_type = 'credential_replacement' and credential_id is not null and replacement_credential_id is not null)
  )
);

-- A credential can be replaced once. If the replacement itself is lost, the
-- next replacement must target that newer credential, preserving a clear chain.
create unique index if not exists mps_operator_actions_replaced_credential_key
  on public.mps_operator_actions (credential_id)
  where action_type = 'credential_replacement';

create index if not exists mps_operator_actions_client_created_at_idx
  on public.mps_operator_actions (client_id, created_at desc);

create or replace function public.apply_mps_operator_credit_adjustment(
  p_action_id text,
  p_idempotency_hash text,
  p_request_hash text,
  p_actor_fingerprint text,
  p_client_id text,
  p_quantity integer,
  p_reason text,
  p_reference_id text,
  p_entry_id text,
  p_created_at timestamptz
)
returns jsonb
language plpgsql
security invoker
set search_path = public, extensions
as $$
declare
  v_existing_request_hash text;
  v_existing_result jsonb;
  v_balance_before numeric(18, 6);
  v_balance_after numeric(18, 6);
  v_event_hash text;
  v_result jsonb;
begin
  if p_action_id is null or p_action_id !~ '^mpsop_[a-f0-9]{32}$'
     or p_idempotency_hash is null or p_idempotency_hash !~ '^sha256:[a-f0-9]{64}$'
     or p_request_hash is null or p_request_hash !~ '^sha256:[a-f0-9]{64}$'
     or p_actor_fingerprint is null or p_actor_fingerprint !~ '^sha256:[a-f0-9]{64}$'
     or p_client_id is null or p_client_id !~ '^client_[a-f0-9]{32}$'
     or p_quantity is null or p_quantity = 0 or p_quantity < -1000000 or p_quantity > 1000000
     or p_reason is null or char_length(p_reason) not between 3 and 500
     or p_reference_id is null or char_length(p_reference_id) not between 3 and 200
     or p_entry_id is null or p_entry_id !~ '^credit_[a-f0-9]{32}$'
     or p_created_at is null then
    raise exception 'Invalid operator credit adjustment.' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_idempotency_hash, 0));
  select request_hash, action_result into v_existing_request_hash, v_existing_result
    from public.mps_operator_actions
    where idempotency_hash = p_idempotency_hash;
  if found then
    if v_existing_request_hash <> p_request_hash then
      raise exception 'Idempotency key was already used for a different operator action.' using errcode = '23505';
    end if;
    return v_existing_result || jsonb_build_object('idempotentReplay', true);
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_client_id, 0));
  perform 1 from public.agent_clients where public_id = p_client_id for update;
  if not found then
    raise exception 'Client not found.' using errcode = 'P0002';
  end if;
  if not exists (
    select 1 from public.mps_credit_checkouts
    where client_id = p_client_id and status = 'paid'
  ) then
    raise exception 'Client has no confirmed prepaid checkout.' using errcode = 'P0001';
  end if;

  select coalesce(sum(quantity), 0) into v_balance_before
    from public.mps_credit_ledger_entries
    where client_id = p_client_id and unit = 'mps_audit_invocation';
  v_balance_after := v_balance_before + p_quantity;

  v_event_hash := 'sha256:' || encode(digest(
    p_entry_id || '|' || p_client_id || '|' || p_quantity::text || '|'
      || p_action_id || '|' || p_created_at::text,
    'sha256'
  ), 'hex');

  insert into public.mps_credit_ledger_entries
    (public_id, client_id, entry_type, unit, quantity, source_type, source_id, event_hash, metadata, created_at)
  values
    (p_entry_id, p_client_id, 'manual_adjustment', 'mps_audit_invocation', p_quantity,
     'manual', p_action_id, v_event_hash,
     jsonb_build_object('operatorActionId', p_action_id, 'reason', p_reason, 'referenceId', p_reference_id),
     p_created_at);

  v_result := jsonb_build_object(
    'actionId', p_action_id,
    'action', 'credit_adjustment',
    'clientId', p_client_id,
    'ledgerEntryId', p_entry_id,
    'quantity', p_quantity,
    'balanceBefore', v_balance_before,
    'balanceAfter', v_balance_after,
    'idempotentReplay', false
  );

  insert into public.mps_operator_actions
    (public_id, action_type, idempotency_hash, request_hash, actor_fingerprint, client_id,
     reason, reference_id, action_result, created_at)
  values
    (p_action_id, 'credit_adjustment', p_idempotency_hash, p_request_hash, p_actor_fingerprint,
     p_client_id, p_reason, p_reference_id, v_result, p_created_at);

  return v_result;
end;
$$;

create or replace function public.get_mps_operational_balances(
  p_client_ids text[]
)
returns table(client_id text, balance numeric(18, 6))
language plpgsql
stable
security invoker
set search_path = public
as $$
begin
  if p_client_ids is null
     or cardinality(p_client_ids) < 1
     or cardinality(p_client_ids) > 100
     or exists (
       select 1 from unnest(p_client_ids) as requested(value)
       where requested.value !~ '^client_[a-f0-9]{32}$'
     ) then
    raise exception 'Invalid operational balance lookup.' using errcode = '22023';
  end if;

  return query
    select requested.value,
      coalesce(sum(entries.quantity), 0)::numeric(18, 6)
    from unnest(p_client_ids) as requested(value)
    left join public.mps_credit_ledger_entries entries
      on entries.client_id = requested.value and entries.unit = 'mps_audit_invocation'
    group by requested.value;
end;
$$;

create or replace function public.apply_mps_operator_credential_revocation(
  p_action_id text,
  p_idempotency_hash text,
  p_request_hash text,
  p_actor_fingerprint text,
  p_credential_id text,
  p_reason text,
  p_reference_id text,
  p_created_at timestamptz
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_existing_request_hash text;
  v_existing_result jsonb;
  v_credential public.agent_client_credentials%rowtype;
  v_changed boolean;
  v_result jsonb;
begin
  if p_action_id is null or p_action_id !~ '^mpsop_[a-f0-9]{32}$'
     or p_idempotency_hash is null or p_idempotency_hash !~ '^sha256:[a-f0-9]{64}$'
     or p_request_hash is null or p_request_hash !~ '^sha256:[a-f0-9]{64}$'
     or p_actor_fingerprint is null or p_actor_fingerprint !~ '^sha256:[a-f0-9]{64}$'
     or p_credential_id is null or p_credential_id !~ '^cred_[a-f0-9]{32}$'
     or p_reason is null or char_length(p_reason) not between 3 and 500
     or p_reference_id is null or char_length(p_reference_id) not between 3 and 200
     or p_created_at is null then
    raise exception 'Invalid operator credential revocation.' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_idempotency_hash, 0));
  select request_hash, action_result into v_existing_request_hash, v_existing_result
    from public.mps_operator_actions
    where idempotency_hash = p_idempotency_hash;
  if found then
    if v_existing_request_hash <> p_request_hash then
      raise exception 'Idempotency key was already used for a different operator action.' using errcode = '23505';
    end if;
    return v_existing_result || jsonb_build_object('idempotentReplay', true);
  end if;

  select * into v_credential
    from public.agent_client_credentials
    where public_id = p_credential_id
    for update;
  if not found then
    raise exception 'Credential not found.' using errcode = 'P0002';
  end if;

  v_changed := v_credential.status <> 'revoked';
  if v_changed then
    update public.agent_client_credentials
      set status = 'revoked', revoked_at = p_created_at, revocation_reason = p_reason
      where public_id = p_credential_id;
  end if;

  v_result := jsonb_build_object(
    'actionId', p_action_id,
    'action', 'credential_revocation',
    'clientId', v_credential.client_id,
    'credentialId', p_credential_id,
    'previousStatus', v_credential.status,
    'status', 'revoked',
    'changed', v_changed,
    'idempotentReplay', false
  );

  insert into public.mps_operator_actions
    (public_id, action_type, idempotency_hash, request_hash, actor_fingerprint, client_id,
     credential_id, reason, reference_id, action_result, created_at)
  values
    (p_action_id, 'credential_revocation', p_idempotency_hash, p_request_hash, p_actor_fingerprint,
     v_credential.client_id, p_credential_id, p_reason, p_reference_id, v_result, p_created_at);

  return v_result;
end;
$$;

create or replace function public.apply_mps_operator_credential_replacement(
  p_action_id text,
  p_idempotency_hash text,
  p_request_hash text,
  p_actor_fingerprint text,
  p_credential_id text,
  p_replacement_credential_id text,
  p_replacement_secret_hash text,
  p_replacement_secret_prefix text,
  p_reason text,
  p_reference_id text,
  p_created_at timestamptz
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_existing_request_hash text;
  v_existing_result jsonb;
  v_credential public.agent_client_credentials%rowtype;
  v_client_status text;
  v_balance numeric(18, 6);
  v_result jsonb;
begin
  if p_action_id is null or p_action_id !~ '^mpsop_[a-f0-9]{32}$'
     or p_idempotency_hash is null or p_idempotency_hash !~ '^sha256:[a-f0-9]{64}$'
     or p_request_hash is null or p_request_hash !~ '^sha256:[a-f0-9]{64}$'
     or p_actor_fingerprint is null or p_actor_fingerprint !~ '^sha256:[a-f0-9]{64}$'
     or p_credential_id is null or p_credential_id !~ '^cred_[a-f0-9]{32}$'
     or p_replacement_credential_id is null or p_replacement_credential_id !~ '^cred_[a-f0-9]{32}$'
     or p_replacement_secret_hash is null or p_replacement_secret_hash !~ '^[a-f0-9]{64}$'
     or p_replacement_secret_prefix is null or p_replacement_secret_prefix !~ '^mhaic_[A-Za-z0-9_-]{8}$'
     or p_reason is null or char_length(p_reason) not between 3 and 500
     or p_reference_id is null or char_length(p_reference_id) not between 3 and 200
     or p_created_at is null then
    raise exception 'Invalid operator credential replacement.' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_idempotency_hash, 0));
  select request_hash, action_result into v_existing_request_hash, v_existing_result
    from public.mps_operator_actions
    where idempotency_hash = p_idempotency_hash;
  if found then
    if v_existing_request_hash <> p_request_hash then
      raise exception 'Idempotency key was already used for a different operator action.' using errcode = '23505';
    end if;
    return v_existing_result || jsonb_build_object('idempotentReplay', true);
  end if;

  select * into v_credential
    from public.agent_client_credentials
    where public_id = p_credential_id
    for update;
  if not found then
    raise exception 'Credential not found.' using errcode = 'P0002';
  end if;
  if v_credential.status <> 'active'
     or v_credential.billing_mode <> 'prepaid'
     or not ('mps_audit' = any(v_credential.allowed_capabilities))
     or v_credential.expires_at <= p_created_at then
    raise exception 'Only active, unexpired prepaid MPS credentials can be replaced.' using errcode = 'P0001';
  end if;

  select status into v_client_status
    from public.agent_clients
    where public_id = v_credential.client_id
    for update;
  if not found or v_client_status <> 'active' then
    raise exception 'Credential client is not active.' using errcode = 'P0001';
  end if;
  if not exists (
    select 1 from public.mps_credit_checkouts
    where client_id = v_credential.client_id and status = 'paid'
  ) then
    raise exception 'Credential has no confirmed prepaid checkout.' using errcode = 'P0001';
  end if;
  if exists (
    select 1 from public.mps_operator_actions
    where action_type = 'credential_replacement' and credential_id = p_credential_id
  ) then
    raise exception 'Credential was already replaced.' using errcode = '23505';
  end if;

  update public.agent_client_credentials
    set status = 'revoked', revoked_at = p_created_at, revocation_reason = p_reason
    where public_id = p_credential_id;

  insert into public.agent_client_credentials
    (public_id, client_id, label, secret_hash, secret_prefix, allowed_offer_ids, allowed_capabilities,
     rate_limit_per_hour, expires_at, status, billing_mode)
  values
    (p_replacement_credential_id, v_credential.client_id, left(v_credential.label || ' replacement', 160),
     p_replacement_secret_hash, p_replacement_secret_prefix, v_credential.allowed_offer_ids,
     v_credential.allowed_capabilities, v_credential.rate_limit_per_hour, v_credential.expires_at,
     'active', 'prepaid');

  select coalesce(sum(quantity), 0) into v_balance
    from public.mps_credit_ledger_entries
    where client_id = v_credential.client_id and unit = 'mps_audit_invocation';

  v_result := jsonb_build_object(
    'actionId', p_action_id,
    'action', 'credential_replacement',
    'clientId', v_credential.client_id,
    'credentialId', p_credential_id,
    'replacementCredentialId', p_replacement_credential_id,
    'replacementCredentialPrefix', p_replacement_secret_prefix,
    'balance', v_balance,
    'expiresAt', v_credential.expires_at,
    'idempotentReplay', false
  );

  insert into public.mps_operator_actions
    (public_id, action_type, idempotency_hash, request_hash, actor_fingerprint, client_id,
     credential_id, replacement_credential_id, reason, reference_id, action_result, created_at)
  values
    (p_action_id, 'credential_replacement', p_idempotency_hash, p_request_hash, p_actor_fingerprint,
     v_credential.client_id, p_credential_id, p_replacement_credential_id, p_reason,
     p_reference_id, v_result, p_created_at);

  return v_result;
end;
$$;

alter table public.mps_operator_actions enable row level security;

revoke all on table public.mps_operator_actions from public, anon, authenticated;
grant select, insert on table public.mps_operator_actions to service_role;

revoke all on function public.apply_mps_operator_credit_adjustment(text,text,text,text,text,integer,text,text,text,timestamptz) from public, anon, authenticated;
revoke all on function public.apply_mps_operator_credential_revocation(text,text,text,text,text,text,text,timestamptz) from public, anon, authenticated;
revoke all on function public.apply_mps_operator_credential_replacement(text,text,text,text,text,text,text,text,text,text,timestamptz) from public, anon, authenticated;
revoke all on function public.get_mps_operational_balances(text[]) from public, anon, authenticated;

grant execute on function public.apply_mps_operator_credit_adjustment(text,text,text,text,text,integer,text,text,text,timestamptz) to service_role;
grant execute on function public.apply_mps_operator_credential_revocation(text,text,text,text,text,text,text,timestamptz) to service_role;
grant execute on function public.apply_mps_operator_credential_replacement(text,text,text,text,text,text,text,text,text,text,timestamptz) to service_role;
grant execute on function public.get_mps_operational_balances(text[]) to service_role;

-- These existing audit-billing functions are also service-role-only. Make the
-- intended execution grant explicit instead of depending on default privileges.
grant execute on function public.consume_mps_audit_credit(text,text,text,text,timestamptz) to service_role;
grant execute on function public.refund_mps_audit_credit(text,text,text,text,timestamptz) to service_role;

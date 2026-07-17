-- Self-service prepaid access. Existing credentials remain internal/meter-only.
alter table public.agent_client_credentials
  add column if not exists billing_mode text not null default 'internal_meter'
    check (billing_mode in ('internal_meter', 'prepaid'));

alter table public.agent_client_credentials drop constraint if exists agent_client_credentials_status_check;
alter table public.agent_client_credentials
  add constraint agent_client_credentials_status_check
  check (status in ('pending_payment', 'active', 'revoked'));

alter table public.mps_credit_checkouts
  add column if not exists credential_disclosed_at timestamptz;

create or replace function public.finalize_mps_credit_purchase(
  p_checkout_id text,
  p_session_id text,
  p_payment_intent_id text,
  p_amount integer,
  p_currency text,
  p_entry_id text,
  p_event_hash text,
  p_created_at timestamptz
)
returns boolean
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_checkout public.mps_credit_checkouts%rowtype;
begin
  select * into v_checkout from public.mps_credit_checkouts
    where public_id = p_checkout_id for update;
  if not found or v_checkout.status = 'failed' then return false; end if;
  if v_checkout.stripe_checkout_session_id is not null
     and v_checkout.stripe_checkout_session_id <> p_session_id then return false; end if;

  if v_checkout.status = 'awaiting_payment' then
    insert into public.mps_credit_ledger_entries
      (public_id, client_id, checkout_id, entry_type, unit, quantity, source_type, source_id, event_hash, metadata, created_at)
    values
      (p_entry_id, v_checkout.client_id, v_checkout.public_id, 'purchase_grant', 'mps_audit_invocation',
       v_checkout.credit_quantity, 'stripe_checkout_session', p_session_id, p_event_hash,
       jsonb_build_object('stripePriceId', v_checkout.stripe_price_id, 'stripePaymentIntentId', p_payment_intent_id,
         'stripePaymentAmount', p_amount, 'stripePaymentCurrency', lower(p_currency)), p_created_at)
    on conflict (source_type, source_id) do nothing;

    update public.mps_credit_checkouts set status = 'paid', stripe_checkout_session_id = p_session_id,
      stripe_payment_intent_id = p_payment_intent_id, stripe_payment_amount = p_amount,
      stripe_payment_currency = lower(p_currency), paid_at = p_created_at
      where public_id = p_checkout_id;
    update public.agent_client_credentials set status = 'active'
      where public_id = v_checkout.credential_id and status = 'pending_payment' and billing_mode = 'prepaid';
  end if;
  return true;
end;
$$;

create or replace function public.consume_mps_audit_credit(
  p_client_id text,
  p_audit_id text,
  p_entry_id text,
  p_event_hash text,
  p_created_at timestamptz
)
returns boolean
language plpgsql
security invoker
set search_path = public
as $$
declare v_balance numeric(18,6);
begin
  perform pg_advisory_xact_lock(hashtextextended(p_client_id, 0));
  if exists (select 1 from public.mps_credit_ledger_entries where source_type = 'audit_execution' and source_id = p_audit_id) then
    return true;
  end if;
  select coalesce(sum(quantity), 0) into v_balance from public.mps_credit_ledger_entries
    where client_id = p_client_id and unit = 'mps_audit_invocation';
  if v_balance < 1 then return false; end if;
  insert into public.mps_credit_ledger_entries
    (public_id, client_id, entry_type, unit, quantity, source_type, source_id, event_hash, metadata, created_at)
  values (p_entry_id, p_client_id, 'consumption', 'mps_audit_invocation', -1,
    'audit_execution', p_audit_id, p_event_hash, jsonb_build_object('auditId', p_audit_id), p_created_at);
  return true;
end;
$$;

create or replace function public.refund_mps_audit_credit(
  p_client_id text,
  p_audit_id text,
  p_entry_id text,
  p_event_hash text,
  p_created_at timestamptz
)
returns boolean
language plpgsql
security invoker
set search_path = public
as $$
begin
  perform pg_advisory_xact_lock(hashtextextended(p_client_id, 0));
  if not exists (select 1 from public.mps_credit_ledger_entries where source_type = 'audit_execution' and source_id = p_audit_id and quantity = -1) then
    return false;
  end if;
  insert into public.mps_credit_ledger_entries
    (public_id, client_id, entry_type, unit, quantity, source_type, source_id, event_hash, metadata, created_at)
  values (p_entry_id, p_client_id, 'reversal', 'mps_audit_invocation', 1,
    'refund', p_audit_id, p_event_hash, jsonb_build_object('auditId', p_audit_id, 'reason', 'audit_failed'), p_created_at)
  on conflict (source_type, source_id) do nothing;
  return true;
end;
$$;

revoke all on function public.finalize_mps_credit_purchase(text,text,text,integer,text,text,text,timestamptz) from public, anon, authenticated;
revoke all on function public.consume_mps_audit_credit(text,text,text,text,timestamptz) from public, anon, authenticated;
revoke all on function public.refund_mps_audit_credit(text,text,text,text,timestamptz) from public, anon, authenticated;

-- Only synthetic, local database fixtures. Never run this against production.
do $$
declare v public.x402_purchase_attributions%rowtype; n integer;
begin
  perform public.record_x402_offer_usage('csv-import-preflight','challenge','4xx','reddit');
  perform public.record_x402_offer_usage('csv-import-preflight','invocation','2xx','https://private.example/secret');
  select count(*) into n from public.x402_offer_usage_daily where discovery_source in ('reddit','unknown');
  if n<>2 then raise exception 'source allowlist failed'; end if;
  perform public.record_x402_purchase_attribution('csv-import-preflight',repeat('a',64),'eip155:8453',repeat('b',64),13500,null,'alsp','unknown',false,false,false);
  perform public.record_x402_purchase_attribution('csv-import-preflight',repeat('a',64),'eip155:8453',repeat('b',64),13500,'0x'||repeat('c',64),'reddit','confirmed',true,false,false);
  perform public.record_x402_purchase_attribution('csv-import-preflight',repeat('a',64),'eip155:8453',repeat('b',64),13500,'0x'||repeat('c',64),'tanod','confirmed',true,true,false);
  perform public.record_x402_purchase_attribution('csv-import-preflight',repeat('a',64),'eip155:8453',repeat('b',64),13500,null,'direct','unknown',false,false,false);
  select * into v from public.x402_purchase_attributions where payment_id=repeat('a',64);
  if v.discovery_source<>'alsp' or v.settlement_state<>'confirmed' or not v.response_prepared or v.response_attempts<>2
    or v.recovery_attempts<>1 then raise exception 'monotonic replay/source accounting failed'; end if;
  select count(*) into n from public.x402_purchase_attributions;
  if n<>1 then raise exception 'replay duplicated purchases'; end if;
  begin
    perform public.record_x402_purchase_attribution('csv-import-preflight',repeat('a',64),'eip155:8453',repeat('b',64),14000,null,'direct','unknown',false,false,false);
    raise exception 'identity conflict was accepted';
  exception when sqlstate '22023' then null; end;
  begin
    perform public.record_x402_purchase_attribution('csv-import-preflight',repeat('a',64),'eip155:8453',repeat('b',64),13500,'0x'||repeat('d',64),'direct','confirmed',true,false,false);
    raise exception 'transaction conflict was accepted';
  exception when sqlstate '22023' then null; end;
  begin
    perform public.record_x402_purchase_attribution('csv-import-preflight',repeat('d',64),'eip155:8453',repeat('b',64),13500,null,'alsp','unknown',true,false,false);
    raise exception 'unknown settlement was claimed delivered';
  exception when sqlstate '22023' then null; end;
  if has_table_privilege('anon','public.x402_purchase_attributions','SELECT')
    or has_table_privilege('authenticated','public.x402_purchase_attributions','SELECT')
    or has_table_privilege('service_role','public.x402_purchase_attributions','INSERT')
    or not has_table_privilege('service_role','public.x402_purchase_attributions','SELECT') then raise exception 'private table grants failed'; end if;
  if has_function_privilege('anon','public.record_x402_purchase_attribution(text,text,text,text,numeric,text,text,text,boolean,boolean,boolean)','EXECUTE')
    or not has_function_privilege('service_role','public.record_x402_purchase_attribution(text,text,text,text,numeric,text,text,text,boolean,boolean,boolean)','EXECUTE') then raise exception 'private RPC grants failed'; end if;
  if not (select relrowsecurity from pg_class where oid='public.x402_purchase_attributions'::regclass) then raise exception 'RLS missing'; end if;
end; $$;
select 'synthetic attribution migration assertions passed' as verification;

-- New attribution expiry never erases the separate payment ledger or counters.
do $$
declare result jsonb; original_usage integer; original_payments integer;
begin
  select count(*) into original_usage from public.x402_offer_usage_daily;
  select count(*) into original_payments from public.x402_payments;
  insert into public.x402_purchase_attributions(network,payment_id,offer_id,payer_key,amount_base_units,discovery_source,
    settlement_state,operator_activity,first_observed_at,last_observed_at)
  values('eip155:8453',repeat('e',64),'csv-import-preflight',repeat('b',64),13500,'reddit','unknown',false,now()-interval '91 days',now()),
    ('eip155:8453',repeat('f',64),'csv-import-preflight',repeat('b',64),13500,'reddit','unknown',false,now()-interval '89 days',now());
  select public.prune_x402_purchase_attributions() into result;
  if result->>'deleted'<>'1' or (result->>'expiredRemaining')::boolean then raise exception 'first-observation retention failed'; end if;
  if not exists(select 1 from public.x402_purchase_attributions where payment_id=repeat('f',64)) then raise exception 'recent attribution deleted'; end if;
  if (select count(*) from public.x402_offer_usage_daily)<>original_usage or (select count(*) from public.x402_payments)<>original_payments
    then raise exception 'separate financial or aggregate history was changed'; end if;
  insert into public.x402_purchase_attributions(network,payment_id,offer_id,payer_key,amount_base_units,discovery_source,
    settlement_state,operator_activity,first_observed_at,last_observed_at)
  select 'eip155:42161',lpad(to_hex(n),64,'0'),'csv-import-preflight',repeat('b',64),13500,'reddit','unknown',false,
    now()-interval '91 days',now() from generate_series(1,1001) n;
  select public.prune_x402_purchase_attributions() into result;
  if result->>'deleted'<>'1000' or not (result->>'expiredRemaining')::boolean then raise exception 'retention batch limit failed'; end if;
  select public.prune_x402_purchase_attributions() into result;
  if result->>'deleted'<>'1' or (result->>'expiredRemaining')::boolean then raise exception 'retention backlog drain failed'; end if;
  if has_function_privilege('anon','public.prune_x402_purchase_attributions()','EXECUTE')
    or has_function_privilege('authenticated','public.prune_x402_purchase_attributions()','EXECUTE')
    or not has_function_privilege('service_role','public.prune_x402_purchase_attributions()','EXECUTE') then raise exception 'retention role grants failed'; end if;
end; $$;
select 'synthetic retention assertions passed' as verification;

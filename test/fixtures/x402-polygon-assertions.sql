-- Disposable local database only, with the three synthetic roles pre-created.
\set ON_ERROR_STOP on
do $$ begin
  if current_database() <> 'x402_polygon_review_20261012' or inet_server_addr() is not null then
    raise exception 'Only the named local Unix-socket fixture database is allowed';
  end if;
end; $$;
create schema extensions;
create table public.x402_payments(payer text, resource text, claimed_at timestamptz);
\ir ../../supabase/migrations/20260810000300_x402_offer_telemetry.sql
\ir ../../supabase/migrations/20261012120000_x402_discovery_attribution.sql

select public.record_x402_purchase_attribution('csv-import-preflight',repeat('a',64),'eip155:8453',repeat('b',64),13500,'0x'||repeat('c',64),'reddit','confirmed',true,false,false);
select public.record_x402_purchase_attribution('csv-import-preflight',repeat('a',64),'eip155:42161',repeat('d',64),13500,'0x'||repeat('c',64),'alsp','confirmed',true,false,false);
insert into public.x402_payments values ('synthetic payer','synthetic resource',now());
create temporary table baseline as select jsonb_agg(to_jsonb(t) order by network,payment_id) as rows from public.x402_purchase_attributions t;
do $$ begin
  begin
    perform public.record_x402_purchase_attribution('csv-import-preflight',repeat('a',64),'eip155:137',repeat('e',64),13500,'0x'||repeat('c',64),'reddit','confirmed',true,false,false);
    raise exception 'Polygon was accepted before the migration';
  exception when check_violation then null;
  end;
end; $$;

\ir ../../supabase/migrations/20261012160000_x402_polygon_attribution_network.sql
do $$
declare before_rows jsonb; after_rows jsonb; r public.x402_purchase_attributions%rowtype; result jsonb;
begin
  select rows into before_rows from baseline;
  select jsonb_agg(to_jsonb(t) order by network,payment_id) into after_rows from public.x402_purchase_attributions t;
  if before_rows is distinct from after_rows then raise exception 'Existing attribution rows changed'; end if;
  if not public.x402_polygon_attribution_ready() then raise exception 'Read-only schema probe failed'; end if;
  perform public.record_x402_purchase_attribution('csv-import-preflight',repeat('a',64),'eip155:137',repeat('e',64),13500,'0x'||repeat('c',64),'nsgoods','confirmed',true,false,false);
  perform public.record_x402_purchase_attribution('csv-import-preflight',repeat('a',64),'eip155:137',repeat('e',64),13500,'0x'||repeat('c',64),'tanod','confirmed',true,true,false);
  select * into r from public.x402_purchase_attributions where network='eip155:137';
  if r.discovery_source<>'nsgoods' or r.response_attempts<>2 or r.recovery_attempts<>1 then raise exception 'Polygon recovery/source semantics changed'; end if;
  if (select count(*) from public.x402_purchase_attributions)<>3 then raise exception 'Cross-chain deduplication failed'; end if;
  if has_table_privilege('anon','public.x402_purchase_attributions','SELECT')
    or has_table_privilege('authenticated','public.x402_purchase_attributions','SELECT')
    or has_table_privilege('service_role','public.x402_purchase_attributions','INSERT')
    or not has_table_privilege('service_role','public.x402_purchase_attributions','SELECT') then raise exception 'Private table grants changed'; end if;
  if has_function_privilege('anon','public.x402_polygon_attribution_ready()','EXECUTE')
    or has_function_privilege('authenticated','public.x402_polygon_attribution_ready()','EXECUTE')
    or not has_function_privilege('service_role','public.x402_polygon_attribution_ready()','EXECUTE') then raise exception 'Read-only RPC grants failed'; end if;
  begin
    perform public.record_x402_purchase_attribution('csv-import-preflight',repeat('f',64),'eip155:1',repeat('e',64),13500,null,'reddit','unknown',false,false,false);
    raise exception 'Unsupported network was accepted';
  exception when check_violation then null;
  end;
  insert into public.x402_purchase_attributions(network,payment_id,offer_id,payer_key,amount_base_units,discovery_source,settlement_state,operator_activity,first_observed_at,last_observed_at)
  values ('eip155:137',repeat('f',64),'csv-import-preflight',repeat('e',64),13500,'reddit','unknown',false,now()-interval '91 days',now());
  select public.prune_x402_purchase_attributions() into result;
  if result->>'deleted'<>'1' or (result->>'expiredRemaining')::boolean then raise exception 'Polygon 90-day retention changed'; end if;
  if (select count(*) from public.x402_payments)<>1 then raise exception 'Separate financial history changed'; end if;
end; $$;
set role service_role;
select public.x402_polygon_attribution_ready() as restricted_read_only_ready;
reset role;
select 'Polygon migration, legacy rows, cross-chain deduplication, permissions and retention passed' as verification;

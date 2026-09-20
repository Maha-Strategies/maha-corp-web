import {execFileSync} from 'node:child_process'
import {readFileSync} from 'node:fs'
import assert from 'node:assert/strict'
const url=process.env.BUYER_BRIEF_TEST_DATABASE_URL
assert.ok(url,'Explicit disposable test database required')
const parsed=new URL(url)
assert.ok(['localhost','127.0.0.1'].includes(parsed.hostname),'Never run against production')
assert.equal(parsed.pathname,'/buyer_brief_test')
const sql=(input:string)=>execFileSync('psql',[url,'-X','-v','ON_ERROR_STOP=1'],{input,stdio:['pipe','pipe','pipe']})
sql('create role anon; create role authenticated; create role service_role bypassrls;')
sql(readFileSync('supabase/migrations/20260810000500_x402_offer_admissions.sql','utf8'))
sql(readFileSync('supabase/migrations/20260920090000_buyer_brief_notifications.sql','utf8'))
sql(`
begin;
insert into public.x402_offer_admissions(offer_id,payer,idempotency_key,input_hash,resource,amount,state)
values('cabezon-buyer-brief-pack','0x'||repeat('a',40),'synthetic-order-1','sha256:'||repeat('b',64),'https://www.mahastrategies.com/api/v1/cabezon/buyer-brief',20000000,'reserved');
do $$ begin
 if exists(select 1 from public.buyer_brief_notifications) then raise exception 'reserved order notified'; end if;
end $$;
update public.x402_offer_admissions set state='settled',payment_transaction='0x'||repeat('c',64);
update public.x402_offer_admissions set state='settled';
do $$ declare a uuid; b uuid; begin
 if (select count(*) from public.buyer_brief_notifications)<>1 then raise exception 'duplicate settlement notice'; end if;
 if not public.buyer_brief_notifications_ready() then raise exception 'readiness false'; end if;
 a:=public.enqueue_buyer_brief_notification('0x'||repeat('a',40),'synthetic-order-1','sha256:'||repeat('b',64),'refund_requested');
 b:=public.enqueue_buyer_brief_notification('0x'||repeat('a',40),'synthetic-order-1','sha256:'||repeat('b',64),'refund_requested');
 if a<>b then raise exception 'duplicate ticket'; end if;
 begin
  perform public.enqueue_buyer_brief_notification('0x'||repeat('a',40),'synthetic-order-1','sha256:'||repeat('d',64),'refund_requested');
  raise exception 'wrong hash accepted';
 exception when no_data_found then null;
 end;
 if (select count(*) from public.claim_buyer_brief_notifications())<>2 then raise exception 'claim mismatch'; end if;
 if (select count(*) from public.claim_buyer_brief_notifications())<>0 then raise exception 'active lease reclaimed'; end if;
end $$;
update public.buyer_brief_notifications set lease_until=now()-interval '1 second';
do $$ begin
 if (select count(*) from public.claim_buyer_brief_notifications())<>2 then raise exception 'expired lease not reclaimed'; end if;
end $$;
update public.buyer_brief_notifications set lease_until=now()-interval '1 second',attempts=10 where kind='purchase_recorded';
update public.buyer_brief_notifications set lease_until=now()-interval '1 second',first_attempt_at=now()-interval '23 hours' where kind='refund_requested';
do $$ begin
 if (select count(*) from public.claim_buyer_brief_notifications())<>0 then raise exception 'unsafe retry'; end if;
 if (select count(*) from public.buyer_brief_notifications where state='manual_review')<>2 then raise exception 'missing escalation'; end if;
 if has_table_privilege('anon','public.buyer_brief_notifications','select') then raise exception 'public ledger'; end if;
 if has_function_privilege('anon','public.enqueue_buyer_brief_notification(text,text,text,text)','execute') then raise exception 'public queue'; end if;
end $$;
rollback;`)
console.log('PASS: real PostgreSQL migration, settled-only trigger, deduplication, secret binding, leases, escalation and private permissions. Synthetic disposable database only.')

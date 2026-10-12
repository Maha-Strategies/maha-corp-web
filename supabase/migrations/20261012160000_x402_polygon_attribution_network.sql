-- Additive candidate migration only. Do not edit/reapply the original migration.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '10s';

alter table public.x402_purchase_attributions
  drop constraint x402_purchase_attributions_network_check;
alter table public.x402_purchase_attributions
  add constraint x402_purchase_attributions_network_check
  check (network in ('eip155:8453','eip155:42161','eip155:137')) not valid;
alter table public.x402_purchase_attributions
  validate constraint x402_purchase_attributions_network_check;

-- Boolean-only, read-only activation evidence. No financial or recovery row is
-- rewritten, and the original grants, RLS, keys and 90-day policy are preserved.
create or replace function public.x402_polygon_attribution_ready()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from pg_catalog.pg_constraint c
    join pg_catalog.pg_class t on t.oid=c.conrelid
    join pg_catalog.pg_namespace n on n.oid=t.relnamespace
    where n.nspname='public' and t.relname='x402_purchase_attributions'
      and c.conname='x402_purchase_attributions_network_check'
      and c.contype='c' and c.convalidated and t.relrowsecurity
      and pg_catalog.pg_get_constraintdef(c.oid) like '%eip155:137%'
  ) and not pg_catalog.has_table_privilege('anon','public.x402_purchase_attributions','select')
    and not pg_catalog.has_table_privilege('authenticated','public.x402_purchase_attributions','select');
$$;
revoke all on function public.x402_polygon_attribution_ready() from public,anon,authenticated;
grant execute on function public.x402_polygon_attribution_ready() to service_role;
notify pgrst,'reload schema';
commit;

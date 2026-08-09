-- Budgets a report consults, and nothing else does.
--
-- Deliberately not an enforcement mechanism. No request path reads this table,
-- no breach returns 402, and no call is refused for exceeding a limit. Putting
-- a budget check in front of a request would move this system inline, and being
-- out-of-band is the property that makes it sellable to a finance team without
-- a six-month security review. A wrong report is an argument; a wrong gate is
-- an outage.
--
-- A period is stated explicitly rather than derived from a month, because
-- finance periods are not always calendar months and a system that assumes they
-- are produces numbers that quietly disagree with the customer's own ledger.
--
-- Tenant identity is denormalized for the same reason as agent_task_spend_daily:
-- tenants live in Redis and there is no table to reference.

create table if not exists public.agent_cost_center_budgets (
  tenant_id text not null check (char_length(tenant_id) between 1 and 120),
  cost_center text not null
    check (cost_center ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$'),
  period_start date not null,
  period_end date not null,
  credit_limit numeric(18, 0) not null check (credit_limit > 0),
  -- The point at which a report starts saying "approaching", well before the
  -- point at which it says "exceeded". A budget nobody hears about until it is
  -- breached is a postmortem, not a control.
  alert_at_percent integer not null default 80 check (alert_at_percent between 1 and 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (tenant_id, cost_center, period_start),
  constraint agent_cost_center_budgets_period_order check (period_end >= period_start)
);

create index if not exists agent_cost_center_budgets_tenant_idx
  on public.agent_cost_center_budgets (tenant_id, period_start desc);

alter table public.agent_cost_center_budgets enable row level security;
revoke all on table public.agent_cost_center_budgets from public, anon, authenticated;
-- DELETE is granted here, unlike the spend ledgers. A budget is a current
-- setting rather than a record of something that happened: removing one states
-- that a department is no longer tracked, and it destroys no history, because
-- the spend it was compared against lives in a different table that cannot be
-- deleted from.
grant select, insert, update, delete on table public.agent_cost_center_budgets to service_role;
revoke truncate on table public.agent_cost_center_budgets from service_role;

comment on table public.agent_cost_center_budgets is
  'Per-cost-centre credit budgets for one finance period. Read by chargeback reporting only: no request path consults this table and no call is ever refused for exceeding a limit.';

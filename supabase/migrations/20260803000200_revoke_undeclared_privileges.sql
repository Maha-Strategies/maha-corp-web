-- The first migration dry-run's drift check found 109 privileges present in
-- Production that no migration declares: Supabase's implicit default grants,
-- never revoked. They are inert today -- row level security covers the tables
-- and the application authenticates only as service_role -- but they mean the
-- migration tree does not describe the live database, and they leave the
-- append-only guarantee resting on application convention rather than on
-- database privilege.
--
-- Audited table by table before writing this. Across the entire migration tree
-- there is exactly one DELETE statement, on public.utility_upload_objects,
-- whose grant is already declared and which is therefore absent below. The
-- application issues no supabase-js .delete() at all, and none of the seven
-- tables losing UPDATE appears in any .update() call -- those are the
-- append-only event and ledger tables, including the MPS credit ledger and the
-- immutable operator-action record.
--
-- Revoking is the safe direction and the honest one: it makes the tree match
-- the live database by removing privileges nothing uses, rather than declaring
-- privileges nothing should have.
--
-- Each table is checked for existence first. A single multi-table revoke fails
-- entirely if one relation is absent, which would make this migration
-- unrunnable against any database that is not byte-identical to Production.

do $$
declare
  target text;
  -- 1. Nothing in this system deletes rows from these tables.
  no_delete text[] := array[
    'public.agent_client_credentials',
    'public.agent_clients',
    'public.agent_context_pack_evaluations',
    'public.agent_context_packs',
    'public.agent_credential_events',
    'public.agent_credential_rate_windows',
    'public.agent_inquiries',
    'public.agent_inquiry_events',
    'public.agent_mps_audit_events',
    'public.agent_mps_audits',
    'public.api_credit_checkouts',
    'public.api_credit_ledger_entries',
    'public.api_credit_payment_reversals',
    'public.api_credit_stripe_events',
    'public.book_checkouts',
    'public.book_entitlements',
    'public.book_payment_reversals',
    'public.commercial_api_usage_daily',
    'public.content_fact_check_claims',
    'public.content_fact_check_events',
    'public.content_fact_check_reviews',
    'public.content_page_candidate_events',
    'public.content_page_candidates',
    'public.content_page_draft_events',
    'public.content_page_draft_revisions',
    'public.content_page_drafts',
    'public.content_publication_events',
    'public.content_publication_handoff_events',
    'public.content_publication_handoffs',
    'public.content_publication_source_amendments',
    'public.content_publications',
    'public.conversion_checkout_attributions',
    'public.conversion_measurements',
    'public.demand_validation_clusters',
    'public.demand_validation_events',
    'public.demand_validation_signals',
    'public.growth_experiment_events',
    'public.growth_experiments',
    'public.inbound_submission_operations_events',
    'public.inbound_submission_rate_windows',
    'public.inbound_submissions',
    'public.market_opportunities',
    'public.market_opportunity_events',
    'public.mcp_gateway_events',
    'public.mcp_gateway_servers',
    'public.mcp_oauth_access_tokens',
    'public.mcp_oauth_authorization_codes',
    'public.mcp_oauth_clients',
    'public.mcp_oauth_refresh_tokens',
    'public.micro_utility_validation_events',
    'public.micro_utility_validations',
    'public.mps_credit_checkouts',
    'public.mps_credit_ledger_entries',
    'public.mps_operator_actions',
    'public.mps_preflight_orders',
    'public.mps_public_audit_events',
    'public.mps_public_audit_usage',
    'public.mps_receipts',
    'public.mps_usage_events',
    'public.outbound_crm_events',
    'public.outbound_outreach_drafts',
    'public.outbound_prospects',
    'public.outbound_revenue_attributions',
    'public.public_utility_events',
    'public.public_utility_usage',
    'public.revenue_opportunities',
    'public.revenue_opportunity_events',
    'public.revenue_payment_reconciliations',
    'public.revenue_payment_reversals',
    'public.revenue_stripe_webhook_events',
    'public.search_console_query_snapshots',
    'public.som_evaluation_events',
    'public.som_evaluations',
    'public.stripe_webhook_events',
    'public.utility_checkouts'
  ];
  -- 2. Append-only ledgers. Nothing updates them, and immutability is a stated
  -- design property rather than an accident.
  no_update text[] := array[
    'public.agent_credential_events',
    'public.agent_inquiry_events',
    'public.agent_mps_audit_events',
    'public.mps_credit_ledger_entries',
    'public.mps_operator_actions',
    'public.mps_public_audit_events',
    'public.mps_usage_events'
  ];
  -- 3. The application never authenticates as anon or authenticated; every
  -- access path uses the service-role key server-side.
  no_public text[] := array[
    'public.agent_client_credentials',
    'public.agent_clients',
    'public.agent_context_pack_evaluations',
    'public.agent_context_packs',
    'public.agent_credential_events',
    'public.agent_inquiries',
    'public.agent_inquiry_events',
    'public.agent_mps_audit_events',
    'public.agent_mps_audits',
    'public.content_page_draft_revisions',
    'public.mcp_gateway_events',
    'public.mcp_gateway_servers',
    'public.mcp_oauth_access_tokens',
    'public.mcp_oauth_authorization_codes',
    'public.mcp_oauth_clients',
    'public.mcp_oauth_refresh_tokens',
    'public.mps_preflight_orders'
  ];
begin
  foreach target in array no_delete loop
    if to_regclass(target) is not null then
      execute format('revoke delete on table %s from service_role', target);
    end if;
  end loop;

  foreach target in array no_update loop
    if to_regclass(target) is not null then
      execute format('revoke update on table %s from service_role', target);
    end if;
  end loop;

  foreach target in array no_public loop
    if to_regclass(target) is not null then
      execute format('revoke all on table %s from anon, authenticated', target);
    end if;
  end loop;
end
$$;

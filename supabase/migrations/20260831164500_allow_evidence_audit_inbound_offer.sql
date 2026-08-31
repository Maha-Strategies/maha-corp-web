-- Register the human-scoped MPS Evidence Audit with the two private ledgers
-- that receive a qualified website inquiry. This broadens only the explicit
-- offer allowlists; it grants no payment, publication, or autonomous action.

alter table public.inbound_submissions
  drop constraint if exists inbound_submissions_offer_id_check;

alter table public.inbound_submissions
  add constraint inbound_submissions_offer_id_check check (offer_id in (
    'mps-prepaid-audit-access', 'mps-preflight', 'mps-evidence-audit',
    'book-the-imagined-life', 'book-the-orbital-mind', 'book-the-synthetic-self', 'book-the-unfinished-species',
    'rapid-intelligence-brief', 'verified-research-brief'
  ));

alter table public.revenue_opportunities
  drop constraint if exists revenue_opportunities_offer_id_check;

alter table public.revenue_opportunities
  add constraint revenue_opportunities_offer_id_check check (offer_id in (
    'mps-prepaid-audit-access', 'mps-preflight', 'mps-evidence-audit',
    'book-the-imagined-life', 'book-the-orbital-mind', 'book-the-synthetic-self', 'book-the-unfinished-species',
    'rapid-intelligence-brief', 'verified-research-brief',
    'utility-receipts-to-csv'
  ));

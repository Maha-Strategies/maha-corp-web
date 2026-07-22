-- Contact-form acquisition context. This supplements the private inbound ledger
-- without collecting raw referrers, IP addresses, cookies, or ad identifiers.

alter table public.inbound_submissions
  add column if not exists inquiry_class text not null default 'buyer'
    check (inquiry_class in ('buyer','support','solicitation','other')),
  add column if not exists referral_source text not null default 'other'
    check (referral_source in ('search','developer_directory','referral','social','newsletter','event','direct','other')),
  add column if not exists referral_detail text,
  add column if not exists source_path text not null default '/contact'
    check (source_path = '/contact'),
  add column if not exists utm_source text,
  add column if not exists utm_medium text,
  add column if not exists utm_campaign text;

create index if not exists inbound_submissions_class_source_idx
  on public.inbound_submissions (inquiry_class, referral_source, created_at desc);

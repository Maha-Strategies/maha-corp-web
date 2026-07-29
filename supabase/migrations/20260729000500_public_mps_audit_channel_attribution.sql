alter table public.mps_public_audit_events
  add column if not exists acquisition_channel text not null default 'web'
  check (acquisition_channel in ('web', 'mcp', 'github_action'));

create index if not exists mps_public_audit_events_channel_created_at_idx
  on public.mps_public_audit_events (acquisition_channel, created_at desc);

comment on column public.mps_public_audit_events.acquisition_channel is
  'Coarse acquisition channel only. No repository, referrer, source text, or source-text hash is stored.';

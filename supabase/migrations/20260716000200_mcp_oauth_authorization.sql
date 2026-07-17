create table if not exists public.mcp_oauth_clients (
  public_id text primary key check (public_id ~ '^oauthc_[a-f0-9]{32}$'),
  client_name text,
  redirect_uris text[] not null check (cardinality(redirect_uris) between 1 and 10),
  token_endpoint_auth_method text not null default 'none' check (token_endpoint_auth_method = 'none'),
  status text not null default 'active' check (status in ('active', 'revoked')),
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);

create table if not exists public.mcp_oauth_authorization_codes (
  code_hash text primary key check (code_hash ~ '^[a-f0-9]{64}$'),
  client_id text not null references public.mcp_oauth_clients(public_id) on delete restrict,
  redirect_uri text not null,
  code_challenge text not null check (code_challenge ~ '^[A-Za-z0-9_-]{43,128}$'),
  scope text[] not null check (scope = array['mps_audit']::text[]),
  resource text not null,
  subject text not null,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.mcp_oauth_access_tokens (
  token_hash text primary key check (token_hash ~ '^[a-f0-9]{64}$'),
  client_id text not null references public.mcp_oauth_clients(public_id) on delete restrict,
  scope text[] not null check (scope = array['mps_audit']::text[]),
  resource text not null,
  subject text not null,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  issued_at timestamptz not null default now()
);

create table if not exists public.mcp_oauth_refresh_tokens (
  token_hash text primary key check (token_hash ~ '^[a-f0-9]{64}$'),
  client_id text not null references public.mcp_oauth_clients(public_id) on delete restrict,
  scope text[] not null check (scope = array['mps_audit']::text[]),
  resource text not null,
  subject text not null,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  issued_at timestamptz not null default now()
);

create index if not exists mcp_oauth_authorization_codes_client_expires_idx on public.mcp_oauth_authorization_codes (client_id, expires_at desc);
create index if not exists mcp_oauth_access_tokens_client_expires_idx on public.mcp_oauth_access_tokens (client_id, expires_at desc);
create index if not exists mcp_oauth_refresh_tokens_client_expires_idx on public.mcp_oauth_refresh_tokens (client_id, expires_at desc);

alter table public.mcp_oauth_clients enable row level security;
alter table public.mcp_oauth_authorization_codes enable row level security;
alter table public.mcp_oauth_access_tokens enable row level security;
alter table public.mcp_oauth_refresh_tokens enable row level security;

-- No public policies: the OAuth authorization server uses the Supabase service role.

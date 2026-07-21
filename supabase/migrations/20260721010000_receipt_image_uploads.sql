-- Receipt-image ingestion for the paid receipts-to-csv utility.
--
-- Customers upload receipt photos to a PRIVATE storage bucket via short-lived
-- signed URLs. Each upload is bound to an opaque, server-generated draft id; the
-- Stripe checkout is bound to that draft; the paid run fetches only the draft's
-- own objects. Source images are deleted after delivery or refund, and an
-- explicit cleanup path removes abandoned/expired/delivered/refunded uploads.
-- No public URLs, no permanent source-image retention.

-- 1. Private bucket. public = false; only JPG/PNG/WebP; 8 MB cap (post-compression).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('receipt-uploads', 'receipt-uploads', false, 8388608, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

-- Private access policy. storage.objects has RLS on; with no permissive policy
-- for this bucket, anon/authenticated are already denied. This RESTRICTIVE policy
-- additionally guarantees the bucket stays service-role-only even if some other
-- permissive policy exists — it only narrows access and never grants it. Browser
-- uploads/downloads use signed URLs (token-auth at the storage API), which do not
-- go through RLS, so they keep working; our server uses the service role.
drop policy if exists "receipt_uploads_private" on storage.objects;
create policy "receipt_uploads_private" on storage.objects
  as restrictive for all to public
  using (bucket_id <> 'receipt-uploads' or (select auth.role()) = 'service_role')
  with check (bucket_id <> 'receipt-uploads' or (select auth.role()) = 'service_role');

-- 2. Draft = the opaque binding identifier for a set of uploaded objects.
create table if not exists public.utility_upload_drafts (
  public_id text primary key check (public_id ~ '^updraft_[a-f0-9]{32}$'),
  utility text not null check (utility ~ '^[a-z0-9][a-z0-9-]{1,63}$'),
  status text not null default 'open' check (status in ('open', 'delivered', 'refunded')),
  object_count integer not null default 0 check (object_count between 0 and 20),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  cleaned_at timestamptz
);
create index if not exists utility_upload_drafts_cleanup_idx on public.utility_upload_drafts (expires_at) where cleaned_at is null;

create table if not exists public.utility_upload_objects (
  public_id text primary key check (public_id ~ '^upobj_[a-f0-9]{32}$'),
  draft_id text not null references public.utility_upload_drafts(public_id) on delete cascade,
  object_path text not null unique check (char_length(object_path) between 3 and 255),
  content_type text not null check (content_type in ('image/jpeg', 'image/png', 'image/webp')),
  byte_size integer not null check (byte_size between 1 and 8388608),
  created_at timestamptz not null default now()
);
create index if not exists utility_upload_objects_draft_idx on public.utility_upload_objects (draft_id);

-- Bind the checkout to the draft. One checkout per draft (nulls allowed for the
-- text-only flow). The FK guarantees the draft exists.
alter table public.utility_checkouts add column if not exists draft_id text references public.utility_upload_drafts(public_id);
do $$ begin
  alter table public.utility_checkouts add constraint utility_checkouts_draft_unique unique (draft_id);
exception when duplicate_object then null; end $$;

-- 3. Atomically register an uploaded object under a draft, enforcing the ≤20
-- limit, expiry, and open status. Server-generated path only — never client input.
create or replace function public.register_utility_upload_object(
  p_object_id text, p_draft_id text, p_object_path text, p_content_type text, p_byte_size integer, p_now timestamptz
)
returns text
language plpgsql
security invoker
set search_path = public
as $$
declare
  v public.utility_upload_drafts%rowtype;
begin
  if p_object_id !~ '^upobj_[a-f0-9]{32}$' or p_draft_id !~ '^updraft_[a-f0-9]{32}$'
     or p_object_path is null or left(p_object_path, char_length(p_draft_id) + 1) <> p_draft_id || '/'
     or p_content_type not in ('image/jpeg', 'image/png', 'image/webp')
     or p_byte_size is null or p_byte_size < 1 or p_byte_size > 8388608 or p_now is null then
    raise exception 'Invalid utility upload registration.' using errcode = '22023';
  end if;
  select * into v from public.utility_upload_drafts where public_id = p_draft_id for update;
  if not found then return 'draft_not_found'; end if;
  if v.status <> 'open' then return 'closed'; end if;
  if p_now >= v.expires_at then return 'expired'; end if;
  if v.object_count >= 20 then return 'limit_reached'; end if;
  insert into public.utility_upload_objects (public_id, draft_id, object_path, content_type, byte_size)
    values (p_object_id, p_draft_id, p_object_path, p_content_type, p_byte_size);
  update public.utility_upload_drafts set object_count = object_count + 1 where public_id = p_draft_id;
  return 'registered';
end;
$$;

-- 4. Flip a draft to its terminal state (delivered/refunded) at run time.
create or replace function public.set_utility_upload_draft_status(p_draft_id text, p_status text)
returns text
language plpgsql
security invoker
set search_path = public
as $$
begin
  if p_draft_id !~ '^updraft_[a-f0-9]{32}$' or p_status not in ('delivered', 'refunded') then
    raise exception 'Invalid utility upload draft status.' using errcode = '22023';
  end if;
  update public.utility_upload_drafts set status = p_status where public_id = p_draft_id;
  return case when found then 'updated' else 'not_found' end;
end;
$$;

-- 5. Cleanup: list object paths whose draft is eligible (delivered/refunded, or
-- expired) and not yet cleaned. The caller deletes those objects from storage,
-- then calls finalize to drop the rows and stamp cleaned_at. Cleanup is idempotent.
create or replace function public.list_utility_upload_cleanup(p_now timestamptz, p_limit integer)
returns table (draft_id text, object_path text)
language sql
security invoker
set search_path = public
as $$
  select o.draft_id, o.object_path
  from public.utility_upload_objects o
  join public.utility_upload_drafts d on d.public_id = o.draft_id
  where d.cleaned_at is null and (d.status in ('delivered', 'refunded') or p_now >= d.expires_at)
  order by o.draft_id
  limit greatest(1, least(coalesce(p_limit, 500), 1000));
$$;

create or replace function public.finalize_utility_upload_cleanup(p_draft_id text, p_now timestamptz)
returns integer
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_removed integer;
begin
  if p_draft_id !~ '^updraft_[a-f0-9]{32}$' or p_now is null then
    raise exception 'Invalid utility upload cleanup.' using errcode = '22023';
  end if;
  delete from public.utility_upload_objects where draft_id = p_draft_id;
  get diagnostics v_removed = row_count;
  update public.utility_upload_drafts set object_count = 0, cleaned_at = p_now where public_id = p_draft_id;
  return v_removed;
end;
$$;

alter table public.utility_upload_drafts enable row level security;
alter table public.utility_upload_objects enable row level security;
revoke all on table public.utility_upload_drafts from public, anon, authenticated;
revoke all on table public.utility_upload_objects from public, anon, authenticated;
grant select, insert, update, delete on table public.utility_upload_drafts to service_role;
grant select, insert, update, delete on table public.utility_upload_objects to service_role;

revoke all on function public.register_utility_upload_object(text, text, text, text, integer, timestamptz) from public, anon, authenticated;
revoke all on function public.set_utility_upload_draft_status(text, text) from public, anon, authenticated;
revoke all on function public.list_utility_upload_cleanup(timestamptz, integer) from public, anon, authenticated;
revoke all on function public.finalize_utility_upload_cleanup(text, timestamptz) from public, anon, authenticated;
grant execute on function public.register_utility_upload_object(text, text, text, text, integer, timestamptz) to service_role;
grant execute on function public.set_utility_upload_draft_status(text, text) to service_role;
grant execute on function public.list_utility_upload_cleanup(timestamptz, integer) to service_role;
grant execute on function public.finalize_utility_upload_cleanup(text, timestamptz) to service_role;

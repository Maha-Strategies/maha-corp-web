-- Keep the Stripe-hosted checkout URL with the local checkout record so a
-- network retry can replay the same payment session instead of making a new
-- session or requiring the buyer to begin again.
alter table public.book_checkouts
  add column if not exists stripe_checkout_url text;

alter table public.book_checkouts
  drop constraint if exists book_checkouts_stripe_checkout_url_check;
alter table public.book_checkouts
  add constraint book_checkouts_stripe_checkout_url_check
  check (stripe_checkout_url is null or stripe_checkout_url ~ '^https://');

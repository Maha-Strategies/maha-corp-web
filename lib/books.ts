import { randomUUID } from 'node:crypto'

// Static catalog of published books. Book content is static (see app/books/*),
// so the slug→title mapping lives in code; only ownership is stored in the
// database (public.book_entitlements). Keep slugs in sync with app/books/.
export const BOOKS = {
  'the-imagined-life': 'The Imagined Life',
  'the-orbital-mind': 'The Orbital Mind',
  'the-synthetic-self': 'The Synthetic Self',
  'the-unfinished-species': 'The Unfinished Species',
} as const

export type BookId = keyof typeof BOOKS

const BOOK_ID_PATTERN = /^[a-z0-9][a-z0-9-]{1,63}$/

// A well-formed slug that also exists in the catalog. Unknown-but-well-formed
// slugs return false so the route can answer 404 rather than leak existence.
export function isKnownBook(value: string): value is BookId {
  return BOOK_ID_PATTERN.test(value) && value in BOOKS
}

export function bookTitle(bookId: BookId): string {
  return BOOKS[bookId]
}

export function createBookCheckoutId(): string {
  return `book_checkout_${randomUUID().replaceAll('-', '')}`
}

export function createBookEntitlementId(): string {
  return `bent_${randomUUID().replaceAll('-', '')}`
}

export function validBookCheckoutId(value: string): boolean {
  return /^book_checkout_[a-f0-9]{32}$/.test(value)
}

export type BookCatalogConfig = {
  stripeSecretKey: string
  webhookSecret: string
  /** price id → book slug; the only authority on what a payment mints. */
  bookByPrice: Record<string, BookId>
  /** book slug → price id used when creating checkout sessions. */
  priceByBook: Partial<Record<BookId, string>>
}

// Env-gated, mirroring creditPackConfig(): returns null when book checkout is
// not enabled or not fully configured, throws when configured incorrectly.
// STRIPE_BOOK_PRICE_MAP is JSON like {"price_ABC":"the-imagined-life"} and is
// the server-side binding between what was paid for and what gets minted —
// Stripe metadata is never trusted for that decision.
export function bookCatalogConfig(): BookCatalogConfig | null {
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY
  const webhookSecret = process.env.STRIPE_BOOKS_WEBHOOK_SECRET
  const rawMap = process.env.STRIPE_BOOK_PRICE_MAP
  if (!stripeSecretKey || !webhookSecret || !rawMap || process.env.BOOK_CHECKOUT_ENABLED !== 'true') return null

  let parsed: unknown
  try { parsed = JSON.parse(rawMap) } catch { throw new Error('STRIPE_BOOK_PRICE_MAP must be valid JSON.') }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error('STRIPE_BOOK_PRICE_MAP must be a JSON object of price id to book slug.')
  }
  const entries = Object.entries(parsed as Record<string, unknown>)
  if (!entries.length) throw new Error('STRIPE_BOOK_PRICE_MAP must contain at least one price mapping.')

  const bookByPrice: Record<string, BookId> = {}
  const priceByBook: Partial<Record<BookId, string>> = {}
  for (const [priceId, slug] of entries) {
    if (!/^price_[A-Za-z0-9]+$/.test(priceId)) throw new Error(`STRIPE_BOOK_PRICE_MAP key "${priceId}" is not a Stripe Price ID.`)
    if (typeof slug !== 'string' || !isKnownBook(slug)) throw new Error(`STRIPE_BOOK_PRICE_MAP maps "${priceId}" to an unknown book.`)
    bookByPrice[priceId] = slug
    priceByBook[slug] ??= priceId
  }
  return { stripeSecretKey, webhookSecret, bookByPrice, priceByBook }
}

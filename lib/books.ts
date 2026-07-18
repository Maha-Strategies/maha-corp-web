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

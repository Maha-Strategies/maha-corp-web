import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

import { openApiDocument } from '../lib/openapi.ts'

// Two public artifacts can describe the same capability and disagree, and
// nothing catches it: the OpenAPI document is generated, the promotion and
// evidence documents are written by hand, and neither reads the other.
//
// The 2026-08-08 infrastructure review found exactly this. The QUBO/Ising
// reference engine is documented as "private and has no customer execution
// endpoint" while `/api/v1/jobs/qubo-ising` is published in the public
// contract. Both cannot be true. A prospective customer or security reviewer
// reading the pair concludes that one of them is careless, which costs more
// credibility than either statement earns.
//
// These tests do not decide which side is right -- that is a product call,
// and either resolution is legitimate. They only require that the two agree,
// so the contradiction has to be resolved deliberately rather than shipped.

const promotionDoc = () => readFile(new URL('../docs/qubo-reference-promotion.md', import.meta.url), 'utf8')

const paths = () => Object.keys((openApiDocument as unknown as { paths: Record<string, unknown> }).paths)

test('a path published in the public contract is not documented as having no endpoint', {
  // Currently failing, deliberately recorded rather than hidden. Resolving it
  // means either withdrawing /api/v1/jobs/qubo-ising from the public contract
  // or republishing the document with current promotion evidence, and both are
  // product decisions. Remove this option once one has been taken; the
  // assertion then becomes a live guard against the contradiction returning.
  todo: 'QUBO reference engine is published publicly and documented as private',
}, async () => {
  const published = paths().includes('/api/v1/jobs/qubo-ising')
  const doc = await promotionDoc()

  // The exact sentence the review flagged. Matched loosely enough to survive
  // rewording, tightly enough not to fire on unrelated prose.
  const claimsPrivate = /\bno customer execution endpoint\b/i.test(doc)
    || /\bengine is private\b/i.test(doc)

  assert.ok(
    !(published && claimsPrivate),
    'docs/qubo-reference-promotion.md states the QUBO reference engine is private with no customer '
    + 'execution endpoint, but /api/v1/jobs/qubo-ising is published in the public OpenAPI contract. '
    + 'Resolve one way: withdraw the route from the public contract, or update the document with the '
    + 'current promotion evidence. Both artifacts are publicly readable.',
  )
})

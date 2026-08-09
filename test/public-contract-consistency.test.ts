import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

import { openApiDocument } from '../lib/openapi.ts'

// Two public artifacts can describe the same capability and disagree, and
// nothing catches it: the OpenAPI document is generated, the promotion and
// evidence documents are written by hand, and neither reads the other.
//
// The 2026-08-08 infrastructure review found exactly this. The QUBO/Ising
// reference engine was documented as "private and has no customer execution
// endpoint" while `/api/v1/jobs/qubo-ising` was published in the public
// contract, the agent card, the offers manifest and the LLM manifest. Both
// could not be true. A prospective customer or security reviewer reading the
// pair concludes that one of them is careless, which costs more credibility
// than either statement earns.
//
// The resolution taken was fail-closed but reversible: the engine is beta and
// withheld from every discovery surface while its vectorized candidate is
// unbenchmarked. These tests hold that state in place. They are a live guard,
// not an aspiration -- if discovery is restored while the document still says
// the engine is unpromoted, this fails.

const STANDALONE_ROUTE = '/api/v1/jobs/qubo-ising'

const promotionDoc = () => readFile(new URL('../docs/qubo-reference-promotion.md', import.meta.url), 'utf8')
const readJson = async (path: string) => JSON.parse(await readFile(new URL(path, import.meta.url), 'utf8'))

const paths = () => Object.keys((openApiDocument as unknown as { paths: Record<string, unknown> }).paths)

/**
 * Whether the promotion document still marks the standalone engine unpromoted.
 * Matched loosely enough to survive rewording, tightly enough not to fire on
 * the prose that merely recounts the history.
 */
async function documentMarksUnpromoted(): Promise<boolean> {
  const doc = await promotionDoc()
  return /\bunpromoted\b/i.test(doc) && /\bundiscoverable\b/i.test(doc)
}

test('the unpromoted standalone engine stays out of the public OpenAPI contract', async () => {
  if (!await documentMarksUnpromoted()) return

  assert.ok(
    !paths().includes(STANDALONE_ROUTE),
    `docs/qubo-reference-promotion.md marks the standalone QUBO engine unpromoted and undiscoverable, but `
    + `${STANDALONE_ROUTE} is published in the public OpenAPI contract. Either withhold the path, or promote `
    + 'the engine with passing A10G evidence and update the document. Both artifacts are publicly readable.',
  )
})

test('the unpromoted standalone engine stays out of the agent card and offers manifest', async () => {
  if (!await documentMarksUnpromoted()) return

  const card = await readJson('../content/discovery/agent-card.json')
  const offers = await readJson('../content/discovery/agent-offers.json')

  // Serialized wholesale rather than walked field by field: an agent reads the
  // whole document, so the endpoint appearing anywhere in it is discovery.
  for (const [name, document] of [['agent card', card], ['offers manifest', offers]] as const) {
    assert.ok(
      !JSON.stringify(document).includes(STANDALONE_ROUTE),
      `${STANDALONE_ROUTE} appears in the ${name} while the promotion document marks the engine unpromoted. `
      + 'An autonomous caller reading that manifest cannot know the engine is unbenchmarked.',
    )
  }
})

test('the unpromoted standalone engine stays out of the LLM manifest', async () => {
  if (!await documentMarksUnpromoted()) return

  const { buildLlmsManifest } = await import('../lib/llms-manifest.ts')
  const manifest = buildLlmsManifest([])

  assert.ok(
    !manifest.includes(STANDALONE_ROUTE),
    `${STANDALONE_ROUTE} is listed in llms.txt while the promotion document marks the engine unpromoted.`,
  )
})

test('the separately benchmarked engines stay published', async () => {
  // The guard above must not be satisfiable by withdrawing everything. These
  // two carry passing A10G evidence of their own and belong in the contract.
  const published = paths()
  assert.ok(published.includes('/api/v1/jobs/tensor-network'), 'the benchmarked tensor-network engine must stay published')
  assert.ok(published.includes('/api/v1/jobs/geometric-registration'), 'the benchmarked registration engine must stay published')
})

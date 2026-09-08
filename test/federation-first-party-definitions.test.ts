import { strict as assert } from 'node:assert'
import { existsSync, readFileSync } from 'node:fs'
import { test } from 'node:test'
import {
  DEFERRED_PENDING_IMPLEMENTATION,
  EXTERNAL_AUTHORITY_REQUIRED,
  FIRST_PARTY_BASIS,
  FIRST_PARTY_DEFINITIONS,
} from '../lib/federation/first-party-definitions.ts'

/**
 * The first draft shipped two definitions whose locators did not resolve, and
 * review then found four more problems that no test caught. The failures are
 * worth naming, because each one sets a limit on what this file can check.
 *
 * A file existed but was the wrong file. Checkable — the first test.
 * A symbol was named but only appeared in an import. Checkable — the second
 * test now requires a declaration.
 * A cited file was real, its description was true, and it still did not
 * implement the concept. NOT checkable. conflicting-literature cited
 * public-claim-defects.ts with an accurate summary of that module, while
 * nothing in it compares two sources. That is why definitions carry
 * supportsDefinitionBecause: a human judgement stated where a reviewer can
 * disagree with it. The last test below asserts the field is present and
 * substantive. It cannot assert the judgement is right.
 */
test('every cited locator resolves to a real file', () => {
  for (const d of FIRST_PARTY_DEFINITIONS) {
    for (const file of citedFiles(d.groundedIn.locator)) {
      assert.ok(existsSync(file), `${d.conceptId} cites ${file}, which does not exist`)
    }
  }
})

test('every named symbol is declared in the cited file, not merely imported there', () => {
  for (const d of FIRST_PARTY_DEFINITIONS) {
    const symbols = citedSymbols(d.groundedIn.locator)
    if (symbols.length === 0) continue
    const bodies = citedFiles(d.groundedIn.locator).map((f) => readFileSync(f, 'utf8'))
    for (const symbol of symbols) {
      const declaration = new RegExp(
        String.raw`(?:export\s+)?(?:async\s+)?(?:const|function|type|interface|class)\s+${symbol}\b`,
      )
      assert.ok(
        bodies.some((body) => declaration.test(body)),
        `${d.conceptId} names ${symbol}, which is not declared in any file it cites`,
      )
    }
  }
})

test('a definition states both what it establishes and what it does not', () => {
  for (const d of FIRST_PARTY_DEFINITIONS) {
    assert.ok(d.establishes.length > 40, `${d.conceptId} has no substantive establishes clause`)
    assert.ok(d.doesNotEstablish.length > 40, `${d.conceptId} has no substantive limit`)
    assert.notEqual(d.establishes, d.doesNotEstablish)
  }
})

test('every definition says why its locator bears the definition', () => {
  for (const d of FIRST_PARTY_DEFINITIONS) {
    const { shows, supportsDefinitionBecause } = d.groundedIn
    assert.ok(supportsDefinitionBecause.length > 60, `${d.conceptId} does not justify its grounding`)
    assert.notEqual(supportsDefinitionBecause, shows, `${d.conceptId} restates shows instead of justifying it`)
  }
})

test('the basis is never claimed to be independent or external', () => {
  assert.equal(FIRST_PARTY_BASIS.basis, 'first-party-documentation')
  assert.match(FIRST_PARTY_BASIS.independence, /authored-by-the-organisation-being-described/)
  assert.match(FIRST_PARTY_BASIS.boundary, /does not establish/)
})

/**
 * Twelve concepts have real external authorities, and writing Maha definitions
 * for them would manufacture authority rather than cite it.
 */
test('no concept is both defined here and reserved to an external authority', () => {
  const defined = new Set(FIRST_PARTY_DEFINITIONS.map((d) => d.conceptId))
  for (const reserved of EXTERNAL_AUTHORITY_REQUIRED) {
    assert.ok(
      !defined.has(reserved.conceptId),
      `${reserved.conceptId} has an external authority (${reserved.authority}) and must not be defined first-party`,
    )
    assert.ok(reserved.authority.length > 5, `${reserved.conceptId} names no authority`)
  }
})

/** A concept with no implementation is a proposal, and must not be defined. */
test('no deferred concept is also defined', () => {
  const defined = new Set(FIRST_PARTY_DEFINITIONS.map((d) => d.conceptId))
  for (const deferred of DEFERRED_PENDING_IMPLEMENTATION) {
    assert.ok(!defined.has(deferred.conceptId), `${deferred.conceptId} is deferred and must not be defined`)
    assert.ok(deferred.whyDeferred.length > 60, `${deferred.conceptId} does not say why it is deferred`)
    assert.ok(deferred.whatWouldGroundIt.length > 30, `${deferred.conceptId} does not say what would ground it`)
  }
})

test('the three groups account for the 29 definitions Tranche 18 left blocked, without overlap', () => {
  const ids = [
    ...FIRST_PARTY_DEFINITIONS.map((d) => d.conceptId),
    ...DEFERRED_PENDING_IMPLEMENTATION.map((d) => d.conceptId),
    ...EXTERNAL_AUTHORITY_REQUIRED.map((d) => d.conceptId),
  ]
  assert.equal(ids.length, 29)
  assert.equal(new Set(ids).size, 29, 'a concept appears on more than one list')
  assert.equal(FIRST_PARTY_DEFINITIONS.length, 15)
  assert.equal(DEFERRED_PENDING_IMPLEMENTATION.length, 2)
  assert.equal(EXTERNAL_AUTHORITY_REQUIRED.length, 12)
})

/**
 * Uncertainty, canonical, reproducibility and retraction all collide with
 * established terms, and this programme has been bitten by exactly this before
 * with calibration and traceability. A colliding term must say what it is not.
 */
test('terms colliding with established usage carry a disambiguation', () => {
  const mustDisambiguate = ['uncertainty-recording', 'canonical-release', 'reproducibility-fixtures', 'correction-and-retraction']
  for (const slug of mustDisambiguate) {
    const found = FIRST_PARTY_DEFINITIONS.find((d) => d.conceptId.endsWith(slug))
    assert.ok(found, `${slug} is not defined`)
    assert.ok(found.notToBeConfusedWith, `${slug} collides with an established term and must say what it is not`)
    assert.ok(found.notToBeConfusedWith.length > 60, `${slug} disambiguation is too thin to be useful`)
  }
})

/**
 * The measurement sense of uncertainty already appears in this codebase, so
 * this definition must not be readable as an interval or an error budget.
 */
test('uncertainty recording does not claim a measurement interval', () => {
  const d = FIRST_PARTY_DEFINITIONS.find((x) => x.conceptId.endsWith('uncertainty-recording'))
  assert.ok(d)
  assert.match(d.notToBeConfusedWith ?? '', /JCGM 100|GUM/)
  assert.match(d.doesNotEstablish, /fixed lookup|vocabulary-level/)
})

test('concept ids are unique', () => {
  const ids = FIRST_PARTY_DEFINITIONS.map((d) => d.conceptId)
  assert.equal(new Set(ids).size, ids.length)
})

function citedFiles(locator: string): string[] {
  return locator
    .split(' — ')[0]
    .split(/,| with | and /)
    .map((part) => part.trim())
    .filter((part) => part.endsWith('.ts'))
}

function citedSymbols(locator: string): string[] {
  const named = locator.split(' — ')[1]
  if (!named) return []
  return named
    .split(/,| and | with /)
    .map((part) => part.trim())
    .filter((part) => /^[A-Za-z_][A-Za-z0-9_]*$/.test(part) && /[A-Z_]/.test(part))
}

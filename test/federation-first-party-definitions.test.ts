import { strict as assert } from 'node:assert'
import { existsSync, readFileSync } from 'node:fs'
import { test } from 'node:test'
import {
  EXTERNAL_AUTHORITY_REQUIRED,
  FIRST_PARTY_BASIS,
  FIRST_PARTY_DEFINITIONS,
} from '../lib/federation/first-party-definitions.ts'

/**
 * Two definitions shipped with locators that did not resolve: a
 * `withhold-noindex` action that is spelled `withhold_noindex`, and a
 * correction-and-retraction definition citing a file that implements source
 * amendment instead. Both were written from memory of the codebase rather than
 * from the codebase. This test reads the cited files.
 */
test('every cited locator resolves to a real file', () => {
  for (const d of FIRST_PARTY_DEFINITIONS) {
    for (const file of citedFiles(d.groundedIn.locator)) {
      assert.ok(existsSync(file), `${d.conceptId} cites ${file}, which does not exist`)
    }
  }
})

test('every symbol named in a locator exists in the file it is attributed to', () => {
  for (const d of FIRST_PARTY_DEFINITIONS) {
    const symbols = citedSymbols(d.groundedIn.locator)
    if (symbols.length === 0) continue
    const bodies = citedFiles(d.groundedIn.locator).map((f) => readFileSync(f, 'utf8'))
    for (const symbol of symbols) {
      assert.ok(
        bodies.some((body) => body.includes(symbol)),
        `${d.conceptId} names ${symbol}, which appears in none of its cited files`,
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

test('the basis is never claimed to be independent or external', () => {
  const text = JSON.stringify(FIRST_PARTY_BASIS).toLowerCase()
  assert.ok(text.includes('first-party'))
  assert.ok(!/\bindependent\b(?!ly)/.test(FIRST_PARTY_BASIS.independence.replace('independence', '')))
  assert.match(FIRST_PARTY_BASIS.boundary, /does not establish/)
})

/**
 * The reason this file is short. Twelve concepts have real external
 * authorities, and writing Maha definitions for them would manufacture
 * authority rather than cite it. A definition appearing on both lists would
 * mean exactly that mistake.
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

test('the two groups together account for the 29 definitions Tranche 18 left blocked', () => {
  assert.equal(FIRST_PARTY_DEFINITIONS.length + EXTERNAL_AUTHORITY_REQUIRED.length, 29)
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

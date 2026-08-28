import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'

import {
  BRIEFS,
  PUBLIC_INTELLIGENCE_BRIEF_SLUGS,
  getAllBriefSlugs,
  getBriefBySlug,
} from '../lib/briefs-data.ts'

const intelligenceRoot = path.join(process.cwd(), 'app', 'intelligence')

function collectPublicRouteSource(directory: string): string {
  return readdirSync(directory, { withFileTypes: true })
    .flatMap((entry) => {
      const entryPath = path.join(directory, entry.name)

      if (entry.isDirectory()) return collectPublicRouteSource(entryPath)

      return /\.(?:ts|tsx|js|jsx|json|md|mdx)$/.test(entry.name)
        ? [readFileSync(entryPath, 'utf8')]
        : []
    })
    .join('\n')
}

test('public intelligence is an explicit provenance-reviewed allowlist', () => {
  assert.deepEqual(PUBLIC_INTELLIGENCE_BRIEF_SLUGS, ['ai-software-cost-trajectory-2040'])
  assert.deepEqual(BRIEFS.map((brief) => brief.slug), PUBLIC_INTELLIGENCE_BRIEF_SLUGS)
  assert.deepEqual(getAllBriefSlugs(), PUBLIC_INTELLIGENCE_BRIEF_SLUGS)
})

test('client-derived brief routes fail closed', () => {
  assert.equal(getBriefBySlug('backside-microchannel-semiconductors'), undefined)
  assert.equal(getBriefBySlug('smartphone-ap-fan-out-substrate-thickness'), undefined)
  assert.equal(getBriefBySlug('us-foundry-sovereignization'), undefined)
})

test('the public intelligence route excludes third-party confidential-service identifiers', () => {
  const publicSource = collectPublicRouteSource(intelligenceRoot)

  assert.doesNotMatch(publicSource, /flash[-\s]?opinions?/i)
  assert.doesNotMatch(publicSource, /uzabase/i)
})

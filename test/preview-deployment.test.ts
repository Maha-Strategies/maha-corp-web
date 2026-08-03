import assert from 'node:assert/strict'
import test from 'node:test'

import { previewOrigin, selectNewestReadyPreview } from '../lib/preview-deployment.ts'

const PROJECT = 'prj_test'

const preview = (overrides: Record<string, unknown> = {}) => ({
  uid: 'dpl_a', url: 'maha-git-abc.vercel.app', target: 'preview', readyState: 'READY',
  createdAt: 1_000, projectId: PROJECT, meta: { githubCommitSha: 'abc123' }, ...overrides,
})

test('the newest ready Preview is selected regardless of list order', () => {
  const chosen = selectNewestReadyPreview({
    deployments: [
      preview({ uid: 'dpl_old', createdAt: 1_000 }),
      preview({ uid: 'dpl_new', createdAt: 3_000, url: 'maha-git-new.vercel.app' }),
      preview({ uid: 'dpl_mid', createdAt: 2_000 }),
    ],
  }, PROJECT)
  assert.equal(chosen.id, 'dpl_new')
  assert.equal(chosen.url, 'maha-git-new.vercel.app')
})

test('Production deployments are never selected', () => {
  assert.throws(
    () => selectNewestReadyPreview({ deployments: [preview({ target: 'production', createdAt: 9_000 })] }, PROJECT),
    /No ready Preview deployment/,
  )
  // Case-insensitively, and staging is not a preview either.
  assert.throws(() => selectNewestReadyPreview({ deployments: [preview({ target: 'PRODUCTION' })] }, PROJECT), /No ready Preview/)
  assert.throws(() => selectNewestReadyPreview({ deployments: [preview({ target: 'staging' })] }, PROJECT), /No ready Preview/)
})

test('a preview whose target is null or absent is still eligible', () => {
  // The list endpoint reports a preview's target as null on some API versions
  // while `vercel inspect` reports "preview". Requiring the literal string made
  // every real preview ineligible and the scheduled run failed with "No ready
  // Preview deployment is available to measure" against twelve of them.
  assert.equal(selectNewestReadyPreview({ deployments: [preview({ target: null })] }, PROJECT).id, 'dpl_a')
  assert.equal(selectNewestReadyPreview({ deployments: [preview({ target: undefined })] }, PROJECT).id, 'dpl_a')
})

test('a null-target preview still loses to nothing and never to Production', () => {
  const chosen = selectNewestReadyPreview({
    deployments: [
      preview({ uid: 'dpl_prod', target: 'production', createdAt: 9_000 }),
      preview({ uid: 'dpl_preview', target: null, createdAt: 5_000 }),
    ],
  }, PROJECT)
  assert.equal(chosen.id, 'dpl_preview')
})

test('a timestamp reported as `created` rather than `createdAt` is accepted', () => {
  const chosen = selectNewestReadyPreview({
    deployments: [{ uid: 'dpl_c', url: 'c.vercel.app', target: null, readyState: 'READY', created: 7_000, projectId: PROJECT }],
  }, PROJECT)
  assert.equal(chosen.id, 'dpl_c')
  assert.equal(chosen.createdAt, 7_000)
})

test('readiness is honoured under either field name', () => {
  assert.equal(selectNewestReadyPreview({ deployments: [preview({ readyState: undefined, state: 'READY' })] }, PROJECT).id, 'dpl_a')
  assert.throws(() => selectNewestReadyPreview({ deployments: [preview({ readyState: 'BUILDING' })] }, PROJECT), /No ready Preview/)
  assert.throws(() => selectNewestReadyPreview({ deployments: [preview({ readyState: 'ERROR' })] }, PROJECT), /No ready Preview/)
})

test('a deployment belonging to another project is rejected', () => {
  assert.throws(() => selectNewestReadyPreview({ deployments: [preview({ projectId: 'prj_other' })] }, PROJECT), /No ready Preview/)
  // Absent projectId is tolerated: some API versions omit it.
  assert.equal(selectNewestReadyPreview({ deployments: [preview({ projectId: undefined })] }, PROJECT).id, 'dpl_a')
})

test('malformed entries are skipped rather than crashing the run', () => {
  const chosen = selectNewestReadyPreview({
    deployments: [null, 'nonsense', preview({ url: '' }), preview({ createdAt: 'soon' }), preview({ uid: 'dpl_ok', createdAt: 5 })],
  }, PROJECT)
  assert.equal(chosen.id, 'dpl_ok')
})

test('an empty or malformed payload fails loudly', () => {
  assert.throws(() => selectNewestReadyPreview({ deployments: [] }, PROJECT), /No ready Preview/)
  assert.throws(() => selectNewestReadyPreview({}, PROJECT), /no deployment list/)
  assert.throws(() => selectNewestReadyPreview(null, PROJECT), /no deployment list/)
})

test('the commit sha is carried through so a trend point is attributable', () => {
  assert.equal(selectNewestReadyPreview({ deployments: [preview()] }, PROJECT).commitSha, 'abc123')
  assert.equal(selectNewestReadyPreview({ deployments: [preview({ meta: {} })] }, PROJECT).commitSha, undefined)
})

test('a bare host becomes an https origin', () => {
  assert.equal(previewOrigin({ id: 'd', url: 'maha.vercel.app', createdAt: 1 }), 'https://maha.vercel.app')
  assert.equal(previewOrigin({ id: 'd', url: 'https://maha.vercel.app', createdAt: 1 }), 'https://maha.vercel.app')
})

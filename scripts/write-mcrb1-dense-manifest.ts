/**
 * Binds the dense release to the corpus, the model and the machine that made it.
 *
 * Kept separate from the runner so the manifest is written from the artifacts
 * as they landed on disk rather than from the in-memory objects that produced
 * them: a manifest derived from the same variables would agree with a truncated
 * write.
 */
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'

const digest = (path: string) => `sha256:${createHash('sha256').update(readFileSync(path)).digest('hex')}`

for (const base of ['benchmarks/mcrb-1/dense', 'public/benchmarks/mcrb-1/dense']) {
  const results = JSON.parse(readFileSync(`${base}/results.json`, 'utf8'))
  const manifest = {
    schemaVersion: '1.0.0',
    benchmark: 'mcrb-1',
    release: results.release,
    additiveTo: results.additiveTo,
    generatedFrom: 'artifacts on disk, after the run completed',
    corpus: {
      name: results.dataset.name,
      version: results.dataset.version,
      license: results.dataset.license,
      archiveUrl: results.dataset.archiveUrl,
      archiveSha256: results.dataset.archiveSha256,
      split: results.dataset.split,
      cases: results.dataset.cases,
      cohortSha256: results.dataset.cohortSha256,
      cohortVerifiedAgainstV1: results.dataset.cohortVerifiedAgainstV1,
    },
    model: {
      ...results.model,
      weightsCommitted: false,
      note: 'Weights are public, free and credential-free. They are pinned by name and commit revision and are deliberately not committed to this repository.',
    },
    environment: results.environment,
    protocol: results.protocol,
    artifacts: {
      results: { path: `${base}/results.json`, sha256: digest(`${base}/results.json`) },
      cases: { path: `${base}/cases.jsonl`, sha256: digest(`${base}/cases.jsonl`) },
      frozenV1Results: { path: 'benchmarks/mcrb-1/results.json', sha256: digest('benchmarks/mcrb-1/results.json') },
      frozenV1Cohort: { path: 'benchmarks/mcrb-1/cohort.json', sha256: digest('benchmarks/mcrb-1/cohort.json') },
    },
    runnerCommand: 'npm run benchmark:mcrb1-dense:publish',
    offlineCommand: 'MCRB_QASPER_DEV_JSON=/abs/path/qasper-dev-v0.3.json HF_HUB_OFFLINE=1 npm run benchmark:mcrb1-dense',
    methodology: 'docs/benchmarks/mcrb1-dense-retriever-baseline.md',
  }
  writeFileSync(`${base}/manifest.json`, `${JSON.stringify(manifest, null, 2)}\n`)
  console.log(`wrote ${base}/manifest.json`)
}

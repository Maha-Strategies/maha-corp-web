/**
 * Offline, reproducible empirical-validation runner.
 *
 * Usage:
 * npm run celestial:validate -- --dataset ./dataset.json \
 *   --validation-start 2024-01-01T00:00:00.000Z --test-start 2025-01-01T00:00:00.000Z
 * Add --forecast ./forecast.json to issue a locked prospective artifact, and
 * --persist to append the dataset, models, and forecast to configured Supabase.
 */

import { readFile } from 'node:fs/promises'

import { createHypothesisRegistryClient } from '../lib/celestial-hypotheses/store.ts'
import {
  ingestExternalOutcomeDataset,
  issueProspectiveForecast,
  trainParallelCelestialModels,
  type ExternalOutcomeDataset,
} from '../lib/celestial-validation/engine.ts'
import { persistExternalDataset, persistFittedModel, persistProspectiveForecast } from '../lib/celestial-validation/store.ts'

function option(name: string): string | null {
  const index = process.argv.indexOf(name)
  return index >= 0 ? process.argv[index + 1] ?? null : null
}

const datasetPath = option('--dataset')
const validationStartsUtc = option('--validation-start')
const testStartsUtc = option('--test-start')
if (!datasetPath || !validationStartsUtc || !testStartsUtc) throw new Error('--dataset, --validation-start, and --test-start are required.')

const payload = JSON.parse(await readFile(datasetPath, 'utf8')) as Omit<ExternalOutcomeDataset, 'version' | 'datasetSha256'>
const dataset = ingestExternalOutcomeDataset(payload)
const fit = trainParallelCelestialModels(dataset, {
  validationStartsUtc,
  testStartsUtc,
  ridgeCandidates: [0.01, 0.1, 1, 10],
  iterations: 2_000,
  learningRate: 0.1,
})

const forecastPath = option('--forecast')
const forecast = forecastPath
  ? issueProspectiveForecast({ ...(JSON.parse(await readFile(forecastPath, 'utf8')) as Parameters<typeof issueProspectiveForecast>[0]), fit })
  : null

if (process.argv.includes('--persist')) {
  const client = createHypothesisRegistryClient()
  if (!client) throw new Error('Supabase persistence is not configured.')
  await persistExternalDataset(client, dataset)
  await persistFittedModel(client, fit.tropical)
  await persistFittedModel(client, fit.sidereal)
  if (forecast) await persistProspectiveForecast(client, forecast)
}

process.stdout.write(`${JSON.stringify({ dataset: { datasetId: dataset.datasetId, datasetSha256: dataset.datasetSha256, rows: dataset.rows.length }, fit, forecast }, null, 2)}\n`)

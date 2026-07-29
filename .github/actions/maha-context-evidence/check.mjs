import { readFileSync, appendFileSync } from 'node:fs'
import { resolve } from 'node:path'

function requiredEnvironment(name) {
  const value = process.env[name]?.trim()
  if (!value) throw new Error(`${name} is required.`)
  return value
}

function parseJsonFile(file, label) {
  try { return JSON.parse(readFileSync(resolve(file), 'utf8')) } catch { throw new Error(`${label} must be readable JSON.`) }
}

function arrayFromFile(file, key, label) {
  const value = parseJsonFile(file, label)
  const items = Array.isArray(value) ? value : value?.[key]
  if (!Array.isArray(items) || items.length === 0) throw new Error(`${label} must contain a non-empty ${key} array.`)
  return items
}

function numberInput(name, minimum, maximum) {
  const value = Number(requiredEnvironment(name))
  if (!Number.isInteger(value) || value < minimum || value > maximum) throw new Error(`${name} must be an integer between ${minimum} and ${maximum}.`)
  return value
}

function setOutput(name, value) {
  const file = process.env.GITHUB_OUTPUT
  if (!file) return
  appendFileSync(file, `${name}=${String(value)}\n`)
}

function summary(lines) {
  const file = process.env.GITHUB_STEP_SUMMARY
  if (file) appendFileSync(file, `${lines.join('\n')}\n`)
}

async function main() {
  const credential = requiredEnvironment('MAHA_CONTEXT_CREDENTIAL')
  const documents = arrayFromFile(requiredEnvironment('INPUT_DOCUMENTS_FILE'), 'documents', 'documents-file')
  const task = requiredEnvironment('INPUT_TASK')
  const tokenBudget = numberInput('INPUT_TOKEN_BUDGET', 64, 16_000)
  const evidenceFile = process.env.INPUT_REQUIRED_EVIDENCE_FILE?.trim()
  const requiredEvidence = evidenceFile ? arrayFromFile(evidenceFile, 'requiredEvidence', 'required-evidence-file') : null
  const threshold = numberInput('INPUT_FAIL_BELOW_EVIDENCE_RETENTION', 0, 100)
  const apiOrigin = requiredEnvironment('INPUT_API_URL').replace(/\/+$/, '')
  const endpoint = requiredEvidence ? '/api/context-pack-evaluations' : '/api/context-packs'
  const clientRequestId = `github-${process.env.GITHUB_RUN_ID ?? 'local'}-${process.env.GITHUB_RUN_ATTEMPT ?? '1'}`.slice(0, 120)
  const response = await fetch(`${apiOrigin}${endpoint}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${credential}`, 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ clientRequestId, task, tokenBudget, documents, ...(requiredEvidence ? { requiredEvidence } : {}) }),
  })
  const result = await response.json().catch(() => null)
  if (!response.ok) throw new Error(result?.error?.message ?? `Maha API returned HTTP ${response.status}.`)
  const pack = result.contextPack ?? result
  const metrics = result.metrics ?? pack.metrics
  if (!pack?.packId || !metrics) throw new Error('Maha API returned an incomplete Context Pack result.')

  setOutput('pack-id', pack.packId)
  setOutput('estimated-reduction-percent', metrics.estimatedReductionPercent)
  setOutput('source-coverage-percent', metrics.sourceCoveragePercent)
  if (requiredEvidence) setOutput('required-evidence-retention-percent', metrics.requiredEvidenceRetentionPercent)

  summary([
    '## Maha Context & Evidence Check',
    '',
    `- Context Pack: \`${pack.packId}\``,
    `- Estimated context reduction: **${metrics.estimatedReductionPercent}%**`,
    `- Source coverage: **${metrics.sourceCoveragePercent}%**`,
    `- Duplicate passages removed: **${metrics.duplicatePassagesRemoved}**`,
    ...(requiredEvidence ? [`- Required evidence retention: **${metrics.requiredEvidenceRetentionPercent}%** (${metrics.retainedEvidenceCount}/${metrics.requiredEvidenceCount})`] : ['- Required evidence retention: not evaluated']),
    '',
    '_The check reports model-neutral estimated tokens and exact-span retention. It does not assess factual accuracy or a downstream model’s answer quality. Source text and compiled context are not written to this summary._',
  ])
  if (requiredEvidence && metrics.requiredEvidenceRetentionPercent < threshold) {
    throw new Error(`Required evidence retention ${metrics.requiredEvidenceRetentionPercent}% is below the configured ${threshold}% threshold.`)
  }
}

main().catch((error) => {
  console.error(`Maha Context & Evidence Check failed: ${error instanceof Error ? error.message : 'unknown error'}`)
  process.exitCode = 1
})

import { readFileSync, appendFileSync } from 'node:fs'
import { resolve } from 'node:path'

function requiredEnvironment(name) {
  const value = process.env[name]?.trim()
  if (!value) throw new Error(`${name} is required.`)
  return value
}

function optionalEnvironment(name) {
  return process.env[name]?.trim() ?? ''
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
  const mode = optionalEnvironment('INPUT_MODE') || 'compiler'
  if (!['compiler', 'preflight'].includes(mode)) throw new Error('mode must be compiler or preflight.')
  const apiOrigin = requiredEnvironment('INPUT_API_URL').replace(/\/+$/, '')
  if (mode === 'preflight') {
    const passageFile = requiredEnvironment('INPUT_AUDIT_PASSAGE_FILE')
    const passage = readFileSync(resolve(passageFile), 'utf8').trim()
    if (!passage) throw new Error('audit-passage-file must contain a sanitized passage.')
    if (passage.length > 6000) throw new Error('audit-passage-file exceeds the public preflight limit of 6,000 characters.')
    const response = await fetch(`${apiOrigin}/api/audit`, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify({ text: passage }) })
    const audit = await response.json().catch(() => null)
    if (!response.ok) throw new Error(audit?.error ?? `Maha public preflight returned HTTP ${response.status}.`)
    if (!audit?.input_hash || !Array.isArray(audit.claims)) throw new Error('Maha public preflight returned an incomplete result.')
    const counts = Object.fromEntries(['VERIFIED', 'SOURCED', 'BOUNDARY', 'ILLUSTRATIVE', 'UNVERIFIED'].map((tag) => [tag, audit.claims.filter((claim) => claim.tag === tag).length]))
    setOutput('pack-id', audit.input_hash)
    setOutput('estimated-reduction-percent', '')
    setOutput('source-coverage-percent', '')
    summary(['## Maha MPS Claim Preflight', '', `- Input hash: \`${audit.input_hash}\``, `- Claims identified: **${audit.claims.length}**`, ...Object.entries(counts).map(([tag, count]) => `- ${tag}: **${count}**`), '', '_Public preflight is automated claim triage, not factual verification or certification. The passage is not written to this summary; only use sanitized, non-sensitive text._'])
    return
  }
  const credential = requiredEnvironment('MAHA_CONTEXT_CREDENTIAL')
  const documents = arrayFromFile(requiredEnvironment('INPUT_DOCUMENTS_FILE'), 'documents', 'documents-file')
  const task = requiredEnvironment('INPUT_TASK')
  const tokenBudget = numberInput('INPUT_TOKEN_BUDGET', 64, 16_000)
  const evidenceFile = process.env.INPUT_REQUIRED_EVIDENCE_FILE?.trim()
  const requiredEvidence = evidenceFile ? arrayFromFile(evidenceFile, 'requiredEvidence', 'required-evidence-file') : null
  const threshold = numberInput('INPUT_FAIL_BELOW_EVIDENCE_RETENTION', 0, 100)
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

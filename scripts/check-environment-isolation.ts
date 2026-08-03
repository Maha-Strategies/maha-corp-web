import { writeFile } from 'node:fs/promises'

import { auditEnvironmentIsolation, type EnvironmentVariable } from '../lib/environment-isolation.ts'

// Preview and Production share one Vercel project, so a single-valued variable
// is the same secret in both. Only the Vercel API can see both sets; a running
// deployment sees its own environment and nothing else.
//
// Sharing is determined from record structure -- one record targeting both
// environments is one value -- so this never requests, handles, or prints a
// secret value.

function required(name: string) {
  const value = process.env[name]?.trim()
  if (!value) throw new Error(`${name} is required.`)
  return value
}

type VercelEnv = { key?: unknown; target?: unknown }

const token = required('VERCEL_TOKEN')
const projectId = required('VERCEL_PROJECT_ID')
const teamId = required('VERCEL_TEAM_ID')

const query = new URLSearchParams({ teamId })
const response = await fetch(`https://api.vercel.com/v9/projects/${encodeURIComponent(projectId)}/env?${query}`, {
  headers: { Authorization: `Bearer ${token}` },
  signal: AbortSignal.timeout(20_000),
})
if (!response.ok) throw new Error(`Vercel environment listing failed with HTTP ${response.status}.`)

const payload = await response.json() as { envs?: unknown }
if (!Array.isArray(payload.envs)) throw new Error('Vercel returned no environment list.')

const variables: EnvironmentVariable[] = []
for (const entry of payload.envs as VercelEnv[]) {
  if (!entry || typeof entry.key !== 'string') continue
  const targets = Array.isArray(entry.target) ? entry.target.filter((t): t is string => typeof t === 'string')
    : typeof entry.target === 'string' ? [entry.target] : []
  variables.push({ key: entry.key, targets })
}

const report = auditEnvironmentIsolation(variables)

const outputPath = process.env.ISOLATION_OUTPUT_PATH?.trim()
if (outputPath) await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, { mode: 0o600 })

console.log(`Checked ${report.checked} variables across Preview and Production.\n`)
if (report.violations.length) {
  console.log(`Shared credentials that must be isolated (${report.violations.length}):`)
  for (const finding of report.violations) console.log(`  ${finding.key}`)
  console.log('')
}
if (report.warnings.length) {
  console.log(`Warnings (${report.warnings.length}):`)
  for (const finding of report.warnings) console.log(`  ${finding.key} — ${finding.state}`)
  console.log('')
}
console.log(`Correctly isolated: ${report.isolated.length}`)
console.log(`Unclassified configuration: ${report.unclassified.length}`)

if (!report.ok) {
  console.error(`\nEnvironment isolation check failed with ${report.violations.length} shared credential(s).`)
  process.exitCode = 1
}

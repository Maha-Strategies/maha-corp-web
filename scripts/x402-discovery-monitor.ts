import { appendFile, readFile } from 'node:fs/promises'
import { classifyDiscoveryReport, discoveryMonitorMatrix } from '../lib/x402/discovery-monitor.ts'

const mode = process.argv[2]
if (mode === 'matrix') {
  const response = await fetch('https://www.mahastrategies.com/.well-known/x402-public-manifest.json', {
    redirect: 'error', signal: AbortSignal.timeout(20_000), headers: { accept: 'application/json' },
  })
  if (!response.ok) throw new Error(`Public manifest unavailable: HTTP ${response.status}`)
  const matrix = JSON.stringify(discoveryMonitorMatrix(await response.json()))
  if (process.env.GITHUB_OUTPUT) await appendFile(process.env.GITHUB_OUTPUT, `matrix=${matrix}\n`)
  console.log(matrix)
} else if (mode === 'classify') {
  let report: unknown = null
  try { report = JSON.parse(await readFile(process.env.REPORT!, 'utf8')) } catch { /* Missing/invalid output is monitor failure. */ }
  const classification = classifyDiscoveryReport(report, process.env.SUBJECT ?? '', process.env.DOCTOR_OUTCOME ?? '')
  if (process.env.GITHUB_OUTPUT) await appendFile(process.env.GITHUB_OUTPUT, `classification=${classification}\n`)
  console.log(classification)
} else throw new Error('Expected matrix or classify')

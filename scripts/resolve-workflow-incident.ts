import { readFile, appendFile } from 'node:fs/promises'

import { releaseIncidentContext } from '../lib/observability/release-alerts.ts'

const input = process.env.WORKFLOW_RUNS_PATH?.trim()
const output = process.env.GITHUB_OUTPUT?.trim()
if (!input || !output) throw new Error('Workflow incident paths are required.')
const context = releaseIncidentContext(JSON.parse(await readFile(input, 'utf8')) as unknown)
await appendFile(output, `previous_conclusion=${context.previousConclusion}\nincident_anchor=${context.incidentAnchor}\n`)
console.log(JSON.stringify(context))

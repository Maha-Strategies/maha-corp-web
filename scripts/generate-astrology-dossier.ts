import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { astrologyChartInput, checkedBirthReport } from '../lib/astrology-input.ts'
import { generateExecutiveDossier } from '../lib/dossier/astrology-dossier.ts'
const args = process.argv.slice(2), get = (name: string) => args[args.indexOf(name) + 1]
if (!args.includes('--input') || !args.includes('--output')) throw new Error('Usage: node --experimental-strip-types scripts/generate-astrology-dossier.ts --input BirthReport.json --output private-report.pdf')
const input = JSON.parse(await readFile(resolve(get('--input')), 'utf8'))
// Recompute the report: a pasted JSON receipt or placement table is not authority.
const chart = astrologyChartInput.parse({ instantUtc: input.instantUtc, latitudeDegrees: input.latitudeDegrees, longitudeDegrees: input.longitudeDegrees, uncertaintyMinutes: input.foundation?.sensitivity?.uncertaintyMinutes, referenceInstantUtc: input.timing?.referenceInstantUtc })
const pdf = await generateExecutiveDossier(checkedBirthReport(chart))
await writeFile(resolve(get('--output')), pdf, { mode: 0o600 })
console.log('Private executive dossier compiled successfully.')

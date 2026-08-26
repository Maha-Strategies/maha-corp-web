import { lstatSync, readFileSync } from 'node:fs'
import { isAbsolute, resolve } from 'node:path'

import { compileEvidenceDossier, type EvidenceDossierDraft } from '../lib/evidence-dossier/compiler.ts'
import { buildEvidenceDossierPackage, writeEvidenceDossierPackage, type DossierEngagement } from '../lib/evidence-dossier/package.ts'

const argv = process.argv.slice(2)
if (argv.some((value) => /token|secret|password|api[-_]?key/i.test(value))) throw new Error('Credential-shaped arguments are prohibited.')

function argument(name: string): string {
  const index = argv.indexOf(name)
  if (index < 0 || !argv[index + 1] || argv[index + 1].startsWith('--')) throw new Error(`${name} is required.`)
  return argv[index + 1]
}

if (argv.length !== 4) throw new Error('Usage: compile-evidence-dossier-package --input /absolute/intake.json --output /absolute/new-directory')
const inputArgument = argument('--input')
const outputArgument = argument('--output')
if (!isAbsolute(inputArgument) || !isAbsolute(outputArgument)) throw new Error('Input and output paths must be absolute.')
const inputPath = resolve(inputArgument)
const outputPath = resolve(outputArgument)
const stat = lstatSync(inputPath)
if (!stat.isFile() || stat.isSymbolicLink()) throw new Error('Input must be a regular file, not a symlink.')
if (stat.size < 2 || stat.size > 2_000_000) throw new Error('Input must contain between 2 bytes and 2 MB.')

const parsed = JSON.parse(readFileSync(inputPath, 'utf8')) as { dossier: EvidenceDossierDraft; engagement: DossierEngagement }
const dossier = compileEvidenceDossier(parsed.dossier)
const bundle = buildEvidenceDossierPackage(dossier, parsed.engagement)
writeEvidenceDossierPackage(bundle, outputPath)
console.log(JSON.stringify({
  dossierId: dossier.dossierId,
  dossierDigest: dossier.provenanceBundle.dossierDigest,
  packageDigest: bundle.manifest.packageDigest,
  offerReady: bundle.manifest.offerReadiness.readyForFixedFeeOffer,
  blockerCount: bundle.manifest.offerReadiness.reasons.length,
  fileCount: bundle.files.length + 1,
}))

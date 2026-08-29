import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'

const STATIC_ROOT = join(process.cwd(), '.next', 'static')

async function files(root: string): Promise<string[]> {
  const entries = await readdir(root, { withFileTypes: true })
  const nested = await Promise.all(entries.map((entry) => entry.isDirectory() ? files(join(root, entry.name)) : [join(root, entry.name)]))
  return nested.flat()
}

const forbiddenLiterals = [
  'CABEZON_PREVIEW_TOKEN',
  'MCP_EVIDENCE_CANARY_CREDENTIAL',
  'EPISTEMIC_RELEASE_AUTHORITY_TOKEN',
  'SUPABASE_SERVICE_ROLE_KEY',
  'cabezon_preview_lifecycles',
  'frontier-source-alignment',
  'pilot-source-alignment',
  'preview-lifecycle.json',
]
const secretValues = [
  process.env.CABEZON_PREVIEW_TOKEN,
  process.env.MCP_EVIDENCE_CANARY_CREDENTIAL,
  process.env.EPISTEMIC_RELEASE_AUTHORITY_TOKEN,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  process.env.VERCEL_AUTOMATION_BYPASS_SECRET,
].map((value) => value?.trim()).filter((value): value is string => Boolean(value && value.length >= 16))

const findings: string[] = []
for (const path of await files(STATIC_ROOT)) {
  const source = await readFile(path, 'utf8').catch(() => '')
  for (const literal of forbiddenLiterals) if (source.includes(literal)) findings.push(`${path}: forbidden literal ${literal}`)
  for (const value of secretValues) if (source.includes(value)) findings.push(`${path}: configured secret value`)
}

if (findings.length) {
  process.stderr.write(`${findings.join('\n')}\n`)
  process.exitCode = 1
} else {
  process.stdout.write(`CABEZON Preview served boundary verified across ${(await files(STATIC_ROOT)).length} static files.\n`)
}

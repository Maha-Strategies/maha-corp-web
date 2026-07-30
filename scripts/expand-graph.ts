import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import { basename, extname, join, relative } from 'node:path'

const SOURCE_DIR = join(process.cwd(), 'research-source')
const OUTPUT_FILE = join(process.cwd(), 'lib/atlas/generated-claims.json')
const STATUSES = new Set(['VERIFIED', 'SOURCED', 'ILLUSTRATIVE', 'UNVERIFIED'])
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const CITATION = /^(?:10\.\d{4,9}\/[-._;()/:a-z0-9]+|arxiv:(?:[a-z-]+\/)?\d{4}\.\d{4,5}(?:v\d+)?)$/i

export type MpsClaimStatus = 'VERIFIED' | 'SOURCED' | 'ILLUSTRATIVE' | 'UNVERIFIED'
export type MpsClaim = { claim_id: string; title: string; summary: string; status: MpsClaimStatus; latex_formulation: string; sources: string[]; tags: string[] }

type RawClaim = Partial<MpsClaim> & { citation?: string | string[]; source?: string | string[] }

async function filesIn(directory: string): Promise<string[]> {
  try {
    const entries = await readdir(directory, { withFileTypes: true })
    const nested = await Promise.all(entries.map(async (entry) => entry.isDirectory() ? filesIn(join(directory, entry.name)) : [join(directory, entry.name)]))
    return nested.flat().filter((file) => ['.md', '.markdown', '.tex', '.latex', '.json'].includes(extname(file).toLowerCase()))
  } catch (error: unknown) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []
    throw error
  }
}

function scalar(value: string): string { return value.trim().replace(/^['"]|['"]$/g, '') }
function list(value: unknown): string[] { if (Array.isArray(value)) return value.map(String).map(scalar).filter(Boolean); if (typeof value === 'string') return value.replace(/^\[|\]$/g, '').split(',').map(scalar).filter(Boolean); return [] }
function markdownRecord(input: string): RawClaim {
  const match = input.match(/^---\s*\n([\s\S]*?)\n---\s*\n?([\s\S]*)$/)
  const fields: Record<string, string> = {}
  if (match) for (const line of match[1].split('\n')) { const separator = line.indexOf(':'); if (separator > 0) fields[line.slice(0, separator).trim()] = scalar(line.slice(separator + 1)) }
  const body = (match?.[2] ?? input).trim()
  return { claim_id: fields.claim_id, title: fields.title, summary: fields.summary ?? body.replace(/\$[^$]+\$/g, '').replace(/\s+/g, ' ').slice(0, 500), status: fields.status as MpsClaimStatus, latex_formulation: fields.latex_formulation ?? (body.match(/\$\$([\s\S]*?)\$\$/)?.[1]?.trim() ?? ''), sources: list(fields.sources ?? fields.citation), tags: list(fields.tags) }
}
function latexRecord(input: string, path: string): RawClaim {
  const fields: Record<string, string> = {}
  for (const line of input.split('\n')) { const match = line.match(/^%\s*mps-([a-z_]+)\s*:\s*(.+)$/i); if (match) fields[match[1]] = scalar(match[2]) }
  return { claim_id: fields.claim_id ?? basename(path, extname(path)), title: fields.title, summary: fields.summary, status: fields.status as MpsClaimStatus, latex_formulation: fields.latex_formulation ?? input.trim(), sources: list(fields.sources ?? fields.citation), tags: list(fields.tags) }
}
function normalize(raw: RawClaim, origin: string): MpsClaim {
  const claim: MpsClaim = { claim_id: String(raw.claim_id ?? '').trim(), title: String(raw.title ?? '').trim(), summary: String(raw.summary ?? '').replace(/\s+/g, ' ').trim(), status: raw.status as MpsClaimStatus, latex_formulation: String(raw.latex_formulation ?? '').trim(), sources: [...new Set(list(raw.sources?.length ? raw.sources : raw.citation ?? raw.source))], tags: [...new Set(list(raw.tags).map((tag) => tag.toLowerCase()))] }
  const errors: string[] = []
  if (!SLUG.test(claim.claim_id)) errors.push('claim_id must be a lowercase slug')
  if (claim.title.length < 12) errors.push('title must be at least 12 characters')
  if (claim.summary.length < 80) errors.push('summary must be at least 80 characters to prevent thin claim pages')
  if (!STATUSES.has(claim.status)) errors.push('status must be VERIFIED, SOURCED, ILLUSTRATIVE, or UNVERIFIED')
  if (!claim.latex_formulation) errors.push('latex_formulation is required')
  if (!claim.sources.length || claim.sources.some((source) => !CITATION.test(source))) errors.push('sources must contain DOI values or arXiv IDs (for example 10.1000/example or arxiv:2104.13478)')
  if (!claim.tags.length) errors.push('at least one tag is required for related-claim linking')
  if (errors.length) throw new Error(`${origin}: ${errors.join('; ')}`)
  return claim
}
async function parseFile(path: string): Promise<RawClaim[]> {
  const contents = await readFile(path, 'utf8'); const extension = extname(path).toLowerCase()
  if (extension === '.json') { const parsed = JSON.parse(contents) as RawClaim | RawClaim[] | { claims?: RawClaim[] }; if (Array.isArray(parsed)) return parsed; if ('claims' in parsed) return parsed.claims ?? []; return [parsed as RawClaim] }
  return [extension === '.md' || extension === '.markdown' ? markdownRecord(contents) : latexRecord(contents, path)]
}
async function main() {
  const files = await filesIn(SOURCE_DIR); const parsed = await Promise.all(files.map(async (path) => ({ path, claims: await parseFile(path) }))); const claims = parsed.flatMap(({ path, claims }) => claims.map((claim) => normalize(claim, relative(process.cwd(), path))))
  const seen = new Set<string>(); for (const claim of claims) { if (seen.has(claim.claim_id)) throw new Error(`Duplicate claim_id: ${claim.claim_id}`); seen.add(claim.claim_id) }
  claims.sort((a, b) => a.claim_id.localeCompare(b.claim_id)); await mkdir(join(process.cwd(), 'lib/atlas'), { recursive: true }); await writeFile(OUTPUT_FILE, `${JSON.stringify(claims, null, 2)}\n`)
  console.log(`Generated ${claims.length} validated claims from ${files.length} source files: ${relative(process.cwd(), OUTPUT_FILE)}`)
}
main().catch((error: unknown) => { console.error(error); process.exitCode = 1 })

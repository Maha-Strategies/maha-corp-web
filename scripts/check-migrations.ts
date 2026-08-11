import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'

import { auditMigrations, type MigrationChange, type MigrationChangeStatus, type MigrationFile } from '../lib/migration-integrity.ts'

const DIR = 'supabase/migrations'

// Exception to the append-only rule, bounded to two exact file digests.
// Run 31473349855 proved this migration had never reached Production and could
// not even replay into the shadow database: it referenced a column that never
// existed. A forward migration cannot repair a predecessor that prevents the
// migration tree from being constructed, so the unapplied file itself must be
// corrected. Any further byte change falls outside this one-time approval.
const APPROVED_UNAPPLIED_AMENDMENTS = [{
  name: '20260810000600_x402_repeat_payers_confirmed_only.sql',
  baseSha256: 'abfcf2b1bfeeb8bd6f8b8e531d4d0331a496584a5af2f32b0a6466489477325c',
  currentSha256: 'fe9bccae4f26fec49275d83660861d4b2ab57b8a6e6911134720d3e2df92c08a',
  evidence: 'https://github.com/Maha-Strategies/maha-corp-web/actions/runs/31473349855',
}] as const

// Run 31474467637 proved that these Maha OS objects already exist in the
// intentionally unified Production project but are absent from the migration
// tree. The baseline must sort before the nine still-pending migrations; the
// following reconciliation must run immediately after it. Both exceptions are
// bounded to exact reviewed digests. Production records only the baseline as
// applied; the reconciliation executes normally.
const APPROVED_HISTORICAL_MIGRATIONS = [
  {
    name: '20260809000250_maha_os_unified_schema_baseline.sql',
    sha256: '86565aa0c98c8542518029e7bf810290b04544b576739c498139eddca2492fb3',
    evidence: 'https://github.com/Maha-Strategies/maha-corp-web/actions/runs/31474467637',
  },
  {
    name: '20260809000251_harden_unified_maha_os_access.sql',
    sha256: '8ba6558289627b75b209129abc5c970cc9f4aa9f76b3df50100df6d743e159c4',
    evidence: 'https://github.com/Maha-Strategies/maha-corp-web/actions/runs/31474467637',
  },
] as const

function git(...args: string[]): string | null {
  try {
    return execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()
  } catch {
    return null
  }
}

function gitFile(base: string, name: string): string | null {
  try {
    return execFileSync('git', ['show', `${base}:${DIR}/${name}`], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
  } catch {
    return null
  }
}

const sha256 = (value: string) => createHash('sha256').update(value).digest('hex')

/**
 * CI passes the base ref explicitly. Locally we fall back to origin/main, and
 * when neither resolves we still run the checks that need no history.
 */
function baseCommit(): string | null {
  const candidates = [process.env.MIGRATION_BASE_REF, process.env.GITHUB_BASE_REF && `origin/${process.env.GITHUB_BASE_REF}`, 'origin/main', 'main']
  for (const candidate of candidates) {
    if (!candidate) continue
    const merged = git('merge-base', 'HEAD', candidate)
    if (merged) return merged
  }
  return null
}

const STATUS: Record<string, MigrationChangeStatus> = { A: 'added', M: 'modified', D: 'deleted', R: 'renamed' }

function changesSince(base: string): MigrationChange[] | null {
  // Two-dot against the working tree rather than three-dot against HEAD, so an
  // edit that has not been committed yet still fails locally. On a pull request
  // the working tree is clean and the two are equivalent.
  const raw = git('diff', '--name-status', '--find-renames', base, '--', DIR)
  if (raw === null) return null
  const changes: MigrationChange[] = []
  const seen = new Set<string>()
  for (const line of raw.split('\n')) {
    if (!line.trim()) continue
    const [code, ...paths] = line.split('\t')
    const status = STATUS[code[0]]
    // A rename reports the old path first and the new path second; the new
    // path is the one a reviewer needs to see named in the finding.
    const name = path.basename(paths[paths.length - 1])
    if (!status || !name.endsWith('.sql')) continue
    changes.push({ name, status })
    seen.add(name)
  }
  // A migration that has not been added to the index yet is still a migration
  // this branch introduces.
  const untracked = git('ls-files', '--others', '--exclude-standard', '--', DIR) ?? ''
  for (const line of untracked.split('\n')) {
    const name = path.basename(line.trim())
    if (name.endsWith('.sql') && !seen.has(name)) changes.push({ name, status: 'added' })
  }
  return changes
}

function namesAt(base: string): string[] | null {
  const raw = git('ls-tree', '--name-only', base, `${DIR}/`)
  if (raw === null) return null
  return raw.split('\n').map((line) => path.basename(line.trim())).filter((name) => name.endsWith('.sql'))
}

const names = (await readdir(DIR)).filter((name) => name.endsWith('.sql')).sort()
const base = baseCommit()
const rawChanges = base ? changesSince(base) : null
const changes = rawChanges && base ? await Promise.all(rawChanges.map(async (change): Promise<MigrationChange> => {
  if (change.status !== 'modified') return change
  const before = gitFile(base, change.name)
  if (before === null) return change
  const after = await readFile(path.join(DIR, change.name), 'utf8')
  return { ...change, baseSha256: sha256(before), currentSha256: sha256(after) }
})) : rawChanges
const baseNames = base ? namesAt(base) : null

const addedFiles: MigrationFile[] = []
for (const change of changes ?? []) {
  if (change.status === 'deleted') continue
  // Every migration is re-scanned when there is no base to diff against.
  if (change.status !== 'added') continue
  const sql = await readFile(path.join(DIR, change.name), 'utf8')
  addedFiles.push({ name: change.name, sql, sha256: sha256(sql) })
}
if (!changes) {
  for (const name of names) addedFiles.push({ name, sql: await readFile(path.join(DIR, name), 'utf8') })
}

const audit = auditMigrations({
  names,
  changes: changes ?? undefined,
  baseNames: baseNames ?? undefined,
  addedFiles,
  approvedAmendments: APPROVED_UNAPPLIED_AMENDMENTS,
  approvedHistorical: APPROVED_HISTORICAL_MIGRATIONS,
})

for (const finding of audit.findings) console.error(`${finding.name ? `${finding.name}: ` : ''}${finding.message} [${finding.code}]`)

if (!audit.ok) {
  console.error(`\nMigration integrity check failed with ${audit.findings.length} finding(s).`)
  process.exitCode = 1
} else {
  const scope = audit.comparedToBase ? `against ${base?.slice(0, 12)}` : 'without a git base (naming and destructive checks only)'
  console.log(`Migration integrity check passed: ${audit.checked} migrations verified ${scope}.`)
}

// Schema changes reach Production by being applied in filename order, exactly
// once, and never edited afterwards. Nothing in the deploy path enforces that,
// so these checks enforce it at review time instead. They are deliberately
// pure: the script supplies the filenames, file contents, and git status.

export type MigrationChangeStatus = 'added' | 'modified' | 'deleted' | 'renamed'

export type MigrationChange = { name: string; status: MigrationChangeStatus; baseSha256?: string; currentSha256?: string }

export type ApprovedMigrationAmendment = {
  name: string
  baseSha256: string
  currentSha256: string
  evidence: string
}

export type MigrationFile = { name: string; sql: string }

export type MigrationFinding = { code: string; name?: string; message: string }

export type MigrationAudit = { ok: boolean; findings: MigrationFinding[]; checked: number; comparedToBase: boolean }

const MIGRATION_NAME = /^(\d{14})_[a-z0-9]+(?:_[a-z0-9]+)*\.sql$/

// `drop column` is included because dropping a column from an append-only
// ledger destroys recorded commercial history just as effectively as dropping
// the table. `delete from` is not included: it appears legitimately inside
// function bodies that clean up transient rows.
const DESTRUCTIVE = [
  { code: 'drop_table', pattern: /\bdrop\s+table\b/i },
  { code: 'drop_schema', pattern: /\bdrop\s+schema\b/i },
  { code: 'drop_database', pattern: /\bdrop\s+database\b/i },
  { code: 'drop_column', pattern: /\bdrop\s+column\b/i },
  // Statement-anchored. TRUNCATE is also a privilege name, so `revoke ...
  // truncate ... from role` mentions it while doing the opposite of
  // discarding data -- it removes the ability to.
  { code: 'truncate', pattern: /(^|;)\s*truncate\b/i },
]

const ALLOW_DESTRUCTIVE = /--\s*migration-allow-destructive:\s*\S+/i

export function migrationTimestamp(name: string): string | null {
  const match = MIGRATION_NAME.exec(name)
  return match ? match[1] : null
}

/** Rejects a prefix that is not a real UTC instant, so ordering stays meaningful. */
function validInstant(stamp: string): boolean {
  const [year, month, day, hour, minute, second] = [
    Number(stamp.slice(0, 4)), Number(stamp.slice(4, 6)), Number(stamp.slice(6, 8)),
    Number(stamp.slice(8, 10)), Number(stamp.slice(10, 12)), Number(stamp.slice(12, 14)),
  ]
  if (month < 1 || month > 12 || day < 1 || day > 31 || hour > 23 || minute > 59 || second > 59) return false
  const date = new Date(Date.UTC(year, month - 1, day, hour, minute, second))
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
}

/** Strips line and block comments so prose about a statement is not read as the statement. */
function withoutComments(sql: string): string {
  return sql.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/--[^\n]*/g, ' ')
}

export function checkNaming(names: readonly string[]): MigrationFinding[] {
  const findings: MigrationFinding[] = []
  const seen = new Map<string, string>()
  for (const name of names) {
    const stamp = migrationTimestamp(name)
    if (!stamp) {
      findings.push({
        code: 'invalid_name', name,
        message: 'Migration names must be <14-digit UTC timestamp>_<lower_snake_case>.sql. Bare dates collide in the Supabase CLI schema_migrations version column.',
      })
      continue
    }
    if (!validInstant(stamp)) {
      findings.push({ code: 'invalid_timestamp', name, message: `The prefix ${stamp} is not a real UTC instant, so its apply order is ambiguous.` })
      continue
    }
    const previous = seen.get(stamp)
    if (previous) {
      findings.push({ code: 'duplicate_timestamp', name, message: `Shares the timestamp ${stamp} with ${previous}. Duplicate versions collide when applied.` })
      continue
    }
    seen.set(stamp, name)
  }
  return findings
}

/**
 * Migrations already merged have been (or will be) applied to Production, so
 * editing one leaves the database and the repository permanently disagreeing.
 */
export function checkAppendOnly(
  changes: readonly MigrationChange[],
  approvedAmendments: readonly ApprovedMigrationAmendment[] = [],
): MigrationFinding[] {
  const findings: MigrationFinding[] = []
  for (const change of changes) {
    if (change.status === 'added') continue
    const approved = change.status === 'modified' && approvedAmendments.some((amendment) => (
      amendment.name === change.name
      && amendment.baseSha256 === change.baseSha256
      && amendment.currentSha256 === change.currentSha256
      && /^https:\/\//.test(amendment.evidence)
    ))
    if (approved) continue
    const verb = change.status === 'deleted' ? 'Deleting' : change.status === 'renamed' ? 'Renaming' : 'Editing'
    findings.push({
      code: `migration_${change.status}`, name: change.name,
      message: `${verb} an already-committed migration cannot change a database where it has already run. Add a new forward migration instead.`,
    })
  }
  return findings
}

/**
 * A new migration whose timestamp sorts before one already merged would apply
 * out of order on any environment that is already ahead of it.
 */
export function checkOrderAgainstBase(added: readonly string[], base: readonly string[]): MigrationFinding[] {
  const baseStamps = base.map(migrationTimestamp).filter((stamp): stamp is string => stamp !== null)
  if (baseStamps.length === 0) return []
  const highest = baseStamps.reduce((max, stamp) => (stamp > max ? stamp : max))
  const findings: MigrationFinding[] = []
  for (const name of added) {
    const stamp = migrationTimestamp(name)
    if (!stamp || stamp > highest) continue
    findings.push({
      code: 'out_of_order', name,
      message: `Timestamp ${stamp} is not after ${highest}, the newest migration already on the base branch. Environments past that point would never apply this file.`,
    })
  }
  return findings
}

/**
 * Destructive DDL is not forbidden, but it must be a stated decision rather
 * than an incidental line in a larger migration.
 */
export function checkDestructive(files: readonly MigrationFile[]): MigrationFinding[] {
  const findings: MigrationFinding[] = []
  for (const file of files) {
    if (ALLOW_DESTRUCTIVE.test(file.sql)) continue
    const body = withoutComments(file.sql)
    for (const { code, pattern } of DESTRUCTIVE) {
      if (!pattern.test(body)) continue
      findings.push({
        code: `destructive_${code}`, name: file.name,
        message: `Contains ${code.replace('_', ' ')}, which can discard recorded commercial history. If it is intended, state why in a "-- migration-allow-destructive: <reason>" comment.`,
      })
    }
  }
  return findings
}

export function auditMigrations(input: {
  names: readonly string[]
  changes?: readonly MigrationChange[]
  baseNames?: readonly string[]
  addedFiles?: readonly MigrationFile[]
  approvedAmendments?: readonly ApprovedMigrationAmendment[]
}): MigrationAudit {
  const comparedToBase = input.changes !== undefined && input.baseNames !== undefined
  const added = (input.changes ?? []).filter((change) => change.status === 'added').map((change) => change.name)
  const findings = [
    ...checkNaming(input.names),
    ...checkAppendOnly(input.changes ?? [], input.approvedAmendments ?? []),
    ...(comparedToBase ? checkOrderAgainstBase(added, input.baseNames ?? []) : []),
    ...checkDestructive(input.addedFiles ?? []),
  ]
  return { ok: findings.length === 0, findings, checked: input.names.length, comparedToBase }
}

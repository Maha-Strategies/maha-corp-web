/**
 * Resolve the IPv4-capable Supavisor session endpoint for an ephemeral
 * Supabase Preview branch.
 *
 * Supabase's Management API returns the authoritative PRIMARY pooler
 * connection string. The shared pooler uses the same host and user in both
 * transaction and session modes; port 5432 selects session mode. We never
 * derive a region hostname or fall back to the branch's IPv6-only direct host.
 */

export const SUPABASE_SESSION_POOLER_PORT = '5432' as const

export type SupabasePoolerEnvironment = Readonly<{
  PGHOST: string
  PGPORT: typeof SUPABASE_SESSION_POOLER_PORT
  PGUSER: string
  PGPASSWORD: string
  PGDATABASE: string
  PGSSLMODE: 'require'
}>

type Json = Record<string, unknown>

const REF = /^[a-z0-9]{20}$/
const POOLER_HOST = /^(?:[a-z0-9-]+\.)+pooler\.supabase\.com$/
const DATABASE = /^[A-Za-z_][A-Za-z0-9_$-]{0,62}$/

const object = (value: unknown, label: string): Json => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} must be an object.`)
  }
  return value as Json
}

const nonempty = (value: unknown, label: string): string => {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`${label} must be a non-empty string.`)
  }
  return value.trim()
}

function primaryEntry(payload: unknown): Json {
  if (!Array.isArray(payload)) {
    throw new Error('Supabase pooler configuration must be an array.')
  }
  const primary = payload
    .map((entry, index) => object(entry, `Supabase pooler configuration[${index}]`))
    .filter((entry) => entry.database_type === 'PRIMARY')
  if (primary.length !== 1) {
    throw new Error(`Expected exactly one PRIMARY Supabase pooler configuration, found ${primary.length}.`)
  }
  return primary[0]
}

function authoritativeConnectionString(entry: Json): string {
  const snake = typeof entry.connection_string === 'string' ? entry.connection_string.trim() : ''
  const camel = typeof entry.connectionString === 'string' ? entry.connectionString.trim() : ''
  if (snake && camel && snake !== camel) {
    throw new Error('Supabase returned conflicting PRIMARY pooler connection strings.')
  }
  return nonempty(snake || camel, 'PRIMARY Supabase pooler connection string')
}

export function previewSessionPoolerEnvironment(input: {
  branchRef: string
  branchPassword: string
  poolerConfiguration: unknown
}): SupabasePoolerEnvironment {
  const branchRef = nonempty(input.branchRef, 'Preview branch ref')
  if (!REF.test(branchRef)) throw new Error('Preview branch ref is malformed.')
  const password = nonempty(input.branchPassword, 'Preview branch password')
  const entry = primaryEntry(input.poolerConfiguration)

  let parsed: URL
  try {
    parsed = new URL(authoritativeConnectionString(entry))
  } catch {
    throw new Error('PRIMARY Supabase pooler connection string is malformed.')
  }
  if (parsed.protocol !== 'postgres:' && parsed.protocol !== 'postgresql:') {
    throw new Error('PRIMARY Supabase pooler connection string must use the Postgres protocol.')
  }

  const host = parsed.hostname.toLowerCase()
  if (!POOLER_HOST.test(host) || host.startsWith('db.')) {
    throw new Error('PRIMARY Supabase pooler host is not an authoritative shared Supavisor endpoint.')
  }

  const user = decodeURIComponent(parsed.username)
  if (!user.endsWith(`.${branchRef}`) || user.slice(0, -(branchRef.length + 1)).length === 0) {
    throw new Error('PRIMARY Supabase pooler user is not bound to the exact Preview branch ref.')
  }

  const database = decodeURIComponent(parsed.pathname.replace(/^\//, ''))
  if (!DATABASE.test(database) || database !== 'postgres') {
    throw new Error('PRIMARY Supabase pooler database must be the isolated postgres database.')
  }

  return {
    PGHOST: host,
    PGPORT: SUPABASE_SESSION_POOLER_PORT,
    PGUSER: user,
    // The connection-string password is deliberately ignored. The isolated
    // branch password travels only through the child process environment.
    PGPASSWORD: password,
    PGDATABASE: database,
    PGSSLMODE: 'require',
  }
}

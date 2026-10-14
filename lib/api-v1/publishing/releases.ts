import { DatabaseSync } from 'node:sqlite'
import { readFileSync, mkdirSync, chmodSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { randomUUID } from 'node:crypto'
import { compileRelease, validateRelease, briefFromRelease, type Release, type RetrievalInput } from '../../agent-publishing/contracts.ts'

/** Local editorial release journal only; payment state belongs to the central gateway. */
export class LocalReleaseJournal {
  readonly db: DatabaseSync
  constructor(path: string, env: NodeJS.ProcessEnv = process.env) {
    if (!['test', 'development'].includes(env.NODE_ENV ?? '') || env.VERCEL || env.VERCEL_ENV) throw Error('publication_journal_local_only')
    mkdirSync(dirname(path), { recursive: true, mode: 0o700 }); this.db = new DatabaseSync(path); chmodSync(path, 0o600)
    this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA busy_timeout=5000;
      CREATE TABLE IF NOT EXISTS artifacts (publication_id TEXT NOT NULL, release_id TEXT NOT NULL, digest TEXT NOT NULL, payload TEXT NOT NULL, PRIMARY KEY(publication_id,release_id));
      CREATE TABLE IF NOT EXISTS events (seq INTEGER PRIMARY KEY AUTOINCREMENT, publication_id TEXT NOT NULL, release_id TEXT NOT NULL, kind TEXT NOT NULL, payload TEXT NOT NULL, digest TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS metadata (key TEXT PRIMARY KEY, value TEXT NOT NULL);
      CREATE TRIGGER IF NOT EXISTS immutable_artifact_update BEFORE UPDATE ON artifacts BEGIN SELECT RAISE(ABORT,'immutable_artifact'); END;
      CREATE TRIGGER IF NOT EXISTS immutable_artifact_delete BEFORE DELETE ON artifacts BEGIN SELECT RAISE(ABORT,'immutable_artifact'); END;
      CREATE TRIGGER IF NOT EXISTS immutable_event_update BEFORE UPDATE ON events BEGIN SELECT RAISE(ABORT,'immutable_event'); END;
      CREATE TRIGGER IF NOT EXISTS immutable_event_delete BEFORE DELETE ON events BEGIN SELECT RAISE(ABORT,'immutable_event'); END;`)
    this.db.prepare('INSERT OR IGNORE INTO metadata VALUES (?,?)').run('stream', randomUUID())
  }
  close() { this.db.close() }
  private atomic<T>(fn: () => T) { this.db.exec('BEGIN IMMEDIATE'); try { const r = fn(); this.db.exec('COMMIT'); return r } catch (error) { this.db.exec('ROLLBACK'); throw error } }
  private last(id: string) { return this.db.prepare('SELECT * FROM events WHERE publication_id=? ORDER BY seq DESC LIMIT 1').get(id) }
  add(release: Release, kind: 'released' | 'corrected' | 'updated', reason: string) {
    validateRelease(release)
    if (!reason.trim() || reason.length > 1000) throw Error('invalid_release_reason')
    return this.atomic(() => {
      const old = this.db.prepare('SELECT digest FROM artifacts WHERE publication_id=? AND release_id=?').get(release.publicationId, release.releaseId)
      if (old) { if (old.digest !== release.artifactSha256) throw Error('immutable_release_identity_conflict'); return false }
      const prior = this.last(release.publicationId)
      if (prior?.kind === 'withdrawn' || (kind === 'released') !== !prior) throw Error('invalid_release_transition')
      if (prior && compareVersion(release.releaseId, String(prior.release_id)) <= 0) throw Error('release_version_not_increasing')
      this.db.prepare('INSERT INTO artifacts VALUES (?,?,?,?)').run(release.publicationId, release.releaseId, release.artifactSha256, JSON.stringify(release))
      this.event(release, kind, reason); return true
    })
  }
  private event(release: Release, kind: string, reason: string) {
    const payload = { publicationId: release.publicationId, releaseId: release.releaseId, artifactSha256: release.artifactSha256,
      licenseSha256: release.licenseSha256, title: release.title, summary: release.summary, kind, reason, occurredAt: new Date().toISOString() }
    this.db.prepare('INSERT INTO events (publication_id,release_id,kind,payload,digest) VALUES (?,?,?,?,?)').run(release.publicationId, release.releaseId, kind, JSON.stringify(payload), hashValue(payload))
  }
  read(input: RetrievalInput, allowWithdrawn = false) {
    if (!allowWithdrawn && this.last(input.publicationId)?.kind === 'withdrawn') throw Error('publication_withdrawn_no_new_purchase')
    const row = this.db.prepare('SELECT digest,payload FROM artifacts WHERE publication_id=? AND release_id=?').get(input.publicationId, input.releaseId)
    if (!row) throw Error('release_not_found')
    const release = validateRelease(JSON.parse(String(row.payload)))
    if (release.artifactSha256 !== row.digest || input.artifactSha256 !== release.artifactSha256 || input.licenseSha256 !== release.licenseSha256) throw Error('release_commitment_mismatch')
    return release
  }
  withdraw(id: string, reason: string) {
    if (!reason.trim() || reason.length > 1000) throw Error('invalid_withdrawal_reason')
    return this.atomic(() => { const last = this.last(id); if (!last) throw Error('publication_not_found'); if (last.kind === 'withdrawn') return false
      const row = this.db.prepare('SELECT payload FROM artifacts WHERE publication_id=? AND release_id=?').get(id, String(last.release_id))!
      this.event(validateRelease(JSON.parse(String(row.payload))), 'withdrawn', reason); return true })
  }
  correction(input: RetrievalInput) {
    const original = this.read(input)
    const first = this.db.prepare('SELECT seq FROM events WHERE publication_id=? AND release_id=? ORDER BY seq LIMIT 1').get(input.publicationId, input.releaseId)!
    const events = this.db.prepare('SELECT release_id,kind FROM events WHERE publication_id=? AND seq>? ORDER BY seq').all(input.publicationId, first.seq)
    if (!events.length || events.some(e => e.kind !== 'corrected')) throw Error('complimentary_correction_not_available')
    let latest = original
    for (const e of events) {
      const row = this.db.prepare('SELECT payload FROM artifacts WHERE publication_id=? AND release_id=?').get(input.publicationId, String(e.release_id))!
      latest = validateRelease(JSON.parse(String(row.payload)))
      if (latest.licenseSha256 !== original.licenseSha256) throw Error('correction_terms_changed')
    }
    return latest
  }
  registry(q = '') {
    if (q.length > 160) throw Error('registry_query_too_long')
    return this.db.prepare('SELECT a.payload FROM artifacts a JOIN events e ON a.publication_id=e.publication_id AND a.release_id=e.release_id WHERE e.seq=(SELECT MAX(seq) FROM events WHERE publication_id=a.publication_id) AND e.kind<>? ORDER BY a.publication_id').all('withdrawn').map(row => {
      const { markdown: _text, findings: _findings, ...metadata } = validateRelease(JSON.parse(String(row.payload)))
      void _text; void _findings; return metadata
    }).filter(e => `${e.title} ${e.summary}`.toLowerCase().includes(q.toLowerCase()))
  }
  feed(cursor: string | null, limit = 20) {
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100) throw Error('invalid_feed_limit')
    return this.atomic(() => {
      const stream = String(this.db.prepare('SELECT value FROM metadata WHERE key=?').get('stream')!.value); let sequence = 0
      if (cursor) {
        const match = /^v1:([a-f0-9-]{36}):(0|[1-9][0-9]{0,12}):([a-f0-9]{64})$/.exec(cursor)
        if (!match || match[1] !== stream) throw Error('foreign_or_invalid_cursor')
        sequence = Number(match[2]); const previous = this.db.prepare('SELECT payload,digest FROM events WHERE seq=?').get(sequence)
        if (sequence === 0 ? match[3] !== '0'.repeat(64) : !previous || hashValue(JSON.parse(String(previous.payload))) !== previous.digest || String(previous.digest).slice(7) !== match[3]) throw Error('cursor_history_mismatch')
      }
      const rows = this.db.prepare('SELECT seq,payload,digest FROM events WHERE seq>? ORDER BY seq LIMIT ?').all(sequence, limit)
      const events = rows.map(row => { const payload = JSON.parse(String(row.payload)); if (hashValue(payload) !== row.digest) throw Error('event_integrity_failed'); return { sequence: Number(row.seq), ...payload, eventSha256: String(row.digest) } })
      const last = rows.at(-1), high = Number(this.db.prepare('SELECT COALESCE(MAX(seq),0) AS n FROM events').get()!.n)
      return { events, nextCursor: last ? `v1:${stream}:${last.seq}:${String(last.digest).slice(7)}` : cursor ?? `v1:${stream}:0:${'0'.repeat(64)}`, hasMore: Number(last?.seq ?? sequence) < high }
    })
  }
  seed(root = process.cwd()) {
    const briefs: unknown = JSON.parse(readFileSync(resolve(root, 'content/agent-publishing/briefs.json'), 'utf8'))
    const lock = JSON.parse(readFileSync(resolve(root, 'content/agent-publishing/release-lock.json'), 'utf8')) as Record<string, string>
    if (!Array.isArray(briefs) || briefs.length !== 3 || Object.keys(lock).length !== 3) throw Error('seed_invalid')
    for (const brief of briefs) { const r = compileRelease(brief); if (lock[`${r.publicationId}@${r.releaseId}`] !== r.artifactSha256) throw Error('seed_drift'); this.add(r, 'released', 'Local preview; human approval pending') }
  }
}
import { digest as hashValue } from '../../agent-publishing/contracts.ts'
function compareVersion(a: string, b: string) { const x = a.split('.').map(Number), y = b.split('.').map(Number); for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] - y[i]; return 0 }
export const revisePreview = (release: Release, version: string, markdown: string) => compileRelease({ ...briefFromRelease(release), releaseId: version, markdown })
export function withLocalReleases<T>(effect: (journal: LocalReleaseJournal) => T, path = resolve('.local-api-v1/publications.sqlite')) {
  const journal = new LocalReleaseJournal(path); try { journal.seed(); return effect(journal) } finally { journal.close() }
}

import { mkdirSync, readFileSync, readdirSync, writeFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

import type { DossierPackage } from './package.ts'

/**
 * Append-only revision store.
 *
 * Revisions may be created and read. Replacement and deletion are not part of
 * the interface at all, so a caller cannot request them and an adapter cannot
 * quietly implement them. A conflicting digest for an existing revision id is
 * rejected rather than reconciled.
 */

export class StorageConflictError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'StorageConflictError'
  }
}

export interface DossierStore {
  append(pkg: DossierPackage): Promise<void>
  get(packageId: string, revisionId: string): Promise<DossierPackage | null>
  /** Revisions for a lineage, oldest first. */
  history(packageId: string): Promise<readonly DossierPackage[]>
  head(packageId: string): Promise<DossierPackage | null>
}

function assertAppendable(existing: DossierPackage | undefined, incoming: DossierPackage): void {
  if (!existing) return
  if (existing.canonicalPayloadDigest === incoming.canonicalPayloadDigest) {
    throw new StorageConflictError(
      `Revision ${incoming.revisionId} already exists with the same digest; revisions are append-only.`,
    )
  }
  throw new StorageConflictError(
    `Revision ${incoming.revisionId} already exists with a different digest. Refusing to replace it.`,
  )
}

export function createInMemoryStore(): DossierStore {
  const byPackage = new Map<string, DossierPackage[]>()
  return {
    async append(pkg) {
      const list = byPackage.get(pkg.packageId) ?? []
      assertAppendable(
        list.find((entry) => entry.revisionId === pkg.revisionId),
        pkg,
      )
      // Frozen so a caller holding the reference cannot mutate stored history.
      byPackage.set(pkg.packageId, [...list, Object.freeze(structuredClone(pkg))])
    },
    async get(packageId, revisionId) {
      return byPackage.get(packageId)?.find((entry) => entry.revisionId === revisionId) ?? null
    },
    async history(packageId) {
      return [...(byPackage.get(packageId) ?? [])]
    },
    async head(packageId) {
      const list = byPackage.get(packageId) ?? []
      return list.length ? list[list.length - 1] : null
    },
  }
}

/**
 * Filesystem adapter for development and tests only. Writes one file per
 * revision and refuses to overwrite an existing one.
 */
export function createFixtureStore(root: string): DossierStore {
  const dirFor = (packageId: string) => join(root, packageId.replace(/[^A-Za-z0-9._-]/g, '-'))
  const fileFor = (packageId: string, revisionId: string) =>
    join(dirFor(packageId), `${revisionId.replace(/[^A-Za-z0-9._-]/g, '-')}.json`)

  const readAll = (packageId: string): DossierPackage[] => {
    const dir = dirFor(packageId)
    if (!existsSync(dir)) return []
    return readdirSync(dir)
      .filter((name) => name.endsWith('.json'))
      .sort()
      .map((name) => JSON.parse(readFileSync(join(dir, name), 'utf8')) as DossierPackage)
      .sort((a, b) => a.timestamps.submittedAt.localeCompare(b.timestamps.submittedAt))
  }

  return {
    async append(pkg) {
      const path = fileFor(pkg.packageId, pkg.revisionId)
      if (existsSync(path)) {
        assertAppendable(JSON.parse(readFileSync(path, 'utf8')) as DossierPackage, pkg)
      }
      mkdirSync(dirFor(pkg.packageId), { recursive: true })
      writeFileSync(path, `${JSON.stringify(pkg, null, 2)}\n`, { flag: 'wx' })
    },
    async get(packageId, revisionId) {
      const path = fileFor(packageId, revisionId)
      return existsSync(path) ? (JSON.parse(readFileSync(path, 'utf8')) as DossierPackage) : null
    },
    async history(packageId) {
      return readAll(packageId)
    },
    async head(packageId) {
      const list = readAll(packageId)
      return list.length ? list[list.length - 1] : null
    },
  }
}

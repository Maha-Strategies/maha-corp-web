import { randomUUID } from 'node:crypto'

import type { NavigatorCandidateInput } from './maha-navigator-research.ts'
import { recommendationFromRegistry } from './navigator-registry-recommendations.ts'
import { configuredNavigatorRegistrySources, type NavigatorRegistryRecord, type NavigatorRegistrySource } from './navigator-registry-sources.ts'

export const NAVIGATOR_REGISTRY_MAX_DRAFTS = 20

export type NavigatorDraftSubmitResult = { ok: boolean; status: number; idempotentReplay: boolean }
export type NavigatorDraftSubmitter = (candidate: NavigatorCandidateInput & { action: 'create_candidate' }) => Promise<NavigatorDraftSubmitResult>

export type NavigatorRegistryRunSummary = {
  runId: string
  sources: { id: string; discovered: number; error: boolean }[]
  discovered: number
  uniqueCompanies: number
  draftsCreated: number
  duplicates: number
  failed: number
  emailAuthorized: false
  outreachAuthorized: false
}

export function dedupeRegistryRecords(records: NavigatorRegistryRecord[]): NavigatorRegistryRecord[] {
  const seen = new Set<string>()
  return records.filter((record) => {
    const key = record.companyDomain.toLowerCase()
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

export async function runNavigatorRegistryScout(options: {
  fetchImpl: typeof fetch
  submit: NavigatorDraftSubmitter
  sources?: NavigatorRegistrySource[]
  limit?: number
  runId?: string
}): Promise<NavigatorRegistryRunSummary> {
  const sources = options.sources ?? configuredNavigatorRegistrySources()
  const sourceResults: NavigatorRegistryRunSummary['sources'] = []
  const records: NavigatorRegistryRecord[] = []
  for (const source of sources) {
    try {
      const found = await source.read(options.fetchImpl)
      records.push(...found)
      sourceResults.push({ id: source.id, discovered: found.length, error: false })
    } catch {
      console.error(`Navigator registry source "${source.id}" failed; no drafts were created from it.`)
      sourceResults.push({ id: source.id, discovered: 0, error: true })
    }
  }
  const limit = Number.isInteger(options.limit) ? Math.max(1, Math.min(NAVIGATOR_REGISTRY_MAX_DRAFTS, options.limit!)) : NAVIGATOR_REGISTRY_MAX_DRAFTS
  const unique = dedupeRegistryRecords(records).slice(0, limit)
  let draftsCreated = 0, duplicates = 0, failed = 0
  for (const record of unique) {
    const candidate = recommendationFromRegistry(record)
    try {
      const result = await options.submit({ action: 'create_candidate', ...candidate })
      if (!result.ok) failed += 1
      else if (result.idempotentReplay) duplicates += 1
      else draftsCreated += 1
    } catch { failed += 1 }
  }
  return {
    runId: options.runId ?? randomUUID(), sources: sourceResults, discovered: records.length, uniqueCompanies: unique.length,
    draftsCreated, duplicates, failed, emailAuthorized: false, outreachAuthorized: false,
  }
}

export function httpNavigatorDraftSubmitter(origin: string, token: string): NavigatorDraftSubmitter {
  return async (body) => {
    const response = await fetch(`${origin}/api/admin/navigator/research`, {
      method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body), cache: 'no-store',
    })
    let idempotentReplay = false
    try {
      const result = await response.json() as { operation?: { idempotentReplay?: unknown; idempotent_replay?: unknown } }
      idempotentReplay = result.operation?.idempotentReplay === true || result.operation?.idempotent_replay === true
    } catch { /* preserve the HTTP result */ }
    return { ok: response.ok, status: response.status, idempotentReplay }
  }
}

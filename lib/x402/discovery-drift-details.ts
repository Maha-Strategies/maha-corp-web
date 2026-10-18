/** Bounded diagnostic projection, not a replacement for the full integrity digest.
 * Never calls a service, validates a payment or declares a stale digest current. */
type Row = Record<string, unknown>
const object = (v: unknown): Row | null => v !== null && typeof v === 'object' && !Array.isArray(v) ? v as Row : null
function stable(v: unknown): string {
  let nodes = 0
  function visit(x: unknown, depth = 0): unknown {
    if (++nodes > 20000 || depth > 24) throw Error('comparison_bound')
    if (Array.isArray(x)) return x.map(y => visit(y, depth + 1))
    const row = object(x)
    return row ? Object.fromEntries(Object.keys(row).sort().map(k => [k, visit(row[k], depth + 1)])) : x
  }
  return JSON.stringify(visit(v)) ?? 'undefined'
}
const owns = (v: Row, k: string) => Object.hasOwn(v, k)
export const MAX_DRIFT_PATHS = 64
export type DriftArea = 'additional_payment_options' | 'payment_terms' | 'description' | 'resource_metadata'
  | 'input_schema' | 'input_example' | 'request_transport' | 'output_schema' | 'output_example' | 'commerce_metadata' | 'other_metadata'
export type DiscoveryDriftDetails = {
  basis: 'returned_fields_only'
  paymentOptions: 'unchanged' | 'expanded' | 'changed' | 'not_comparable'
  addedNetworks: string[]
  removedNetworks: string[]
  changedAreas: DriftArea[]
  changedPaths: string[]
  uncomparedPaths: string[]
  truncated: boolean
  resolution: 'inspect_no_automatic_payment'
}
function paymentOption(v: unknown): Row | null {
  const x = object(v)
  if (!x || !['scheme', 'network', 'asset', 'payTo', 'amount'].every(k => typeof x[k] === 'string')
    || !/^\d+$/.test(x.amount as string) || typeof x.maxTimeoutSeconds !== 'number'
    || !Number.isFinite(x.maxTimeoutSeconds)) return null
  return x
}
function area(path: string): DriftArea {
  if (path.startsWith('/extensions/bazaar/schema/properties/input')) return 'input_schema'
  if (/^\/extensions\/bazaar\/info\/input\/(method|type|bodyType)$/.test(path)) return 'request_transport'
  if (path.startsWith('/extensions/bazaar/info/input')) return 'input_example'
  if (path.startsWith('/extensions/bazaar/schema/properties/output')) return 'output_schema'
  if (path.startsWith('/extensions/bazaar/info/output')) return 'output_example'
  if (path === '/resource/description') return 'description'
  if (path.startsWith('/resource/')) return 'resource_metadata'
  if (path.startsWith('/extensions/maha-offer')) return 'commerce_metadata'
  return 'other_metadata'
}
export function describeDiscoveryDrift(indexedValue: unknown, liveValue: unknown): DiscoveryDriftDetails {
  const indexed = object(indexedValue) ?? {}, live = object(liveValue) ?? {}
  const details: DiscoveryDriftDetails = { basis: 'returned_fields_only', paymentOptions: 'not_comparable',
    addedNetworks: [], removedNetworks: [], changedAreas: [], changedPaths: [], uncomparedPaths: [],
    truncated: false, resolution: 'inspect_no_automatic_payment' }
  const areas = new Set<DriftArea>(), paths = new Set<string>(), uncompared = new Set<string>()
  let nodes = 0
  function changed(path: string, classification = area(path)) {
    areas.add(classification)
    if (paths.size < MAX_DRIFT_PATHS) paths.add(path)
    else details.truncated = true
  }
  function walk(a: unknown, b: unknown, path: string, depth = 0) {
    if (++nodes > 20000 || depth > 20) { changed(path); details.truncated = true; return }
    if (Object.is(a, b)) return
    const ar = object(a), br = object(b)
    if (ar && br) {
      for (const k of [...new Set([...Object.keys(ar), ...Object.keys(br)])].sort()) {
        walk(ar[k], br[k], path + '/' + k.replaceAll('~', '~0').replaceAll('/', '~1'), depth + 1)
        if (nodes > 20000) break
      }
    } else if (Array.isArray(a) && Array.isArray(b) && a.length === b.length) {
      for (let i = 0; i < a.length; i++) { walk(a[i], b[i], path + '/' + i, depth + 1); if (nodes > 20000) break }
    } else changed(path)
  }
  const ia = Array.isArray(indexed.accepts) ? indexed.accepts : null
  const la = Array.isArray(live.accepts) ? live.accepts : null
  try { if (ia?.length && la?.length && ia.length <= 64 && la.length <= 64 && ia.every(paymentOption) && la.every(paymentOption)
    && new Set(ia.map(stable)).size === ia.length && new Set(la.map(stable)).size === la.length) {
    const before = new Set(ia.map(stable)), after = new Set(la.map(stable))
    const retained = [...before].every(x => after.has(x))
    details.paymentOptions = retained ? before.size === after.size ? 'unchanged' : 'expanded' : 'changed'
    const oldNetworks = new Set(ia.map(x => x.network)), newNetworks = new Set(la.map(x => x.network))
    details.addedNetworks = [...newNetworks].filter(x => !oldNetworks.has(x)).sort()
    details.removedNetworks = [...oldNetworks].filter(x => !newNetworks.has(x)).sort()
    if (details.paymentOptions !== 'unchanged') changed('/accepts', retained ? 'additional_payment_options' : 'payment_terms')
  } else uncompared.add('/accepts')
  } catch { uncompared.add('/accepts'); details.truncated = true }
  const ir = object(indexed.resource), lr = object(live.resource) ?? {}
  for (const key of ['url', 'description', 'mimeType', 'serviceName', 'iconUrl', 'tags']) {
    const present = ir ? owns(ir, key) : key === 'url' ? typeof indexed.resource === 'string' : owns(indexed, key)
    const value = ir ? ir[key] : key === 'url' ? indexed.resource : indexed[key]
    if (!present || value === null || value === undefined) { if (owns(lr, key)) uncompared.add('/resource/' + key); continue }
    walk(value, lr[key], '/resource/' + key)
  }
  const ie = object(indexed.extensions), le = object(live.extensions)
  if (ie && le) {
    const a = { ...ie }, b = { ...le }
    // The full-digest comparison retains this commitment. Exclude its
    // necessarily different value only from the explanatory field diff.
    delete a['declaration-integrity']; delete b['declaration-integrity']
    walk(a, b, '/extensions')
  } else if (ie || le) uncompared.add('/extensions')
  details.changedAreas = [...areas].sort()
  details.changedPaths = [...paths].sort()
  details.uncomparedPaths = [...uncompared].sort()
  return details
}

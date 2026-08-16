/**
 * The full IANA time-zone list, taken from the platform rather than curated.
 *
 * An earlier version of the birth form offered fifteen hand-picked zones, which
 * looked like a closed set and did not generalise. The platform ships the whole
 * database, so there is no reason to hand-pick.
 */

/** A small fallback for runtimes without `Intl.supportedValuesOf`. */
const FALLBACK_ZONES = [
  'UTC', 'Africa/Cairo', 'Africa/Johannesburg', 'Africa/Lagos', 'Africa/Nairobi',
  'America/Chicago', 'America/Denver', 'America/Los_Angeles', 'America/Mexico_City',
  'America/New_York', 'America/Sao_Paulo', 'America/Toronto',
  'Asia/Dubai', 'Asia/Hong_Kong', 'Asia/Jakarta', 'Asia/Kolkata', 'Asia/Seoul',
  'Asia/Shanghai', 'Asia/Singapore', 'Asia/Tokyo',
  'Australia/Sydney', 'Europe/Berlin', 'Europe/London', 'Europe/Madrid',
  'Europe/Moscow', 'Europe/Paris', 'Pacific/Auckland',
]

/**
 * Current IANA names for zones the platform still lists under an older name.
 *
 * `Intl.supportedValuesOf` returns CLDR's canonical set, which keeps the
 * historical spellings — `Asia/Calcutta`, not `Asia/Kolkata`. Both resolve
 * identically, but somebody born in Kolkata should not have to know to look
 * under Calcutta, so both names are offered.
 */
const MODERN_ALIASES = [
  'Asia/Kolkata', 'Asia/Kathmandu', 'Asia/Ho_Chi_Minh', 'Asia/Yangon', 'Asia/Thimphu',
  'Europe/Kyiv', 'America/Argentina/Buenos_Aires', 'America/Nuuk',
  'Africa/Asmara', 'Atlantic/Faroe', 'Pacific/Pohnpei', 'Pacific/Chuuk',
]

export function listTimeZones(): string[] {
  const supported = (Intl as { supportedValuesOf?: (key: string) => string[] }).supportedValuesOf
  const zones = typeof supported === 'function' ? supported.call(Intl, 'timeZone') : FALLBACK_ZONES
  // `UTC` is not always present in the platform list but is a legitimate choice.
  const candidates = [...new Set([...zones, ...MODERN_ALIASES, 'UTC'])]
  // An alias only helps if this runtime actually accepts it.
  return candidates.filter(isKnownTimeZone).sort((a, b) => a.localeCompare(b))
}

/** Zones grouped by their region prefix, for a navigable `optgroup` list. */
export function groupTimeZones(zones: string[] = listTimeZones()): { region: string; zones: string[] }[] {
  const groups = new Map<string, string[]>()
  for (const zone of zones) {
    const region = zone.includes('/') ? zone.split('/')[0] : 'Other'
    const existing = groups.get(region) ?? []
    existing.push(zone)
    groups.set(region, existing)
  }
  return [...groups.entries()]
    .map(([region, entries]) => ({ region, zones: entries.sort((a, b) => a.localeCompare(b)) }))
    .sort((a, b) => a.region.localeCompare(b.region))
}

export function isKnownTimeZone(zone: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: zone })
    return true
  } catch {
    return false
  }
}

/** Human label for a zone, e.g. `Asia/Kolkata` → `Kolkata (Asia)`. */
export function timeZoneLabel(zone: string): string {
  if (!zone.includes('/')) return zone
  const parts = zone.split('/')
  const city = parts[parts.length - 1].replace(/_/g, ' ')
  return `${city} (${parts[0]})`
}

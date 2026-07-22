// Contact-form source capture and solicitation screening. These are deliberately
// deterministic: no model makes acceptance or revenue-routing decisions.

export const CONTACT_REFERRAL_SOURCES = [
  'search', 'developer_directory', 'referral', 'social', 'newsletter', 'event', 'direct', 'other',
] as const

export type ContactReferralSource = typeof CONTACT_REFERRAL_SOURCES[number]

const SOLICITATION_PATTERNS = [
  /\bseo\b.*\b(traffic|visibility|ranking|rankings|keywords?)\b/i,
  /\b(backlinks?|guest posts?|link building)\b/i,
  /\bshare (your )?target keywords?\b/i,
  /\bimprov(?:e|ing) (your )?(search engine )?(visibility|traffic|rankings?)\b/i,
  /\b(send|share) (a )?(full )?proposal\b/i,
]

export function parseContactReferralSource(value: unknown): ContactReferralSource {
  if (typeof value !== 'string' || !CONTACT_REFERRAL_SOURCES.includes(value as ContactReferralSource)) return 'other'
  return value as ContactReferralSource
}

export function optionalCampaignValue(value: unknown, name: string): string | undefined {
  if (value === undefined || value === null || value === '') return undefined
  if (typeof value !== 'string') throw new Error(`${name} must be a string.`)
  const parsed = value.trim()
  if (parsed.length < 1 || parsed.length > 120 || !/^[a-zA-Z0-9][a-zA-Z0-9._ -]*$/.test(parsed)) throw new Error(`${name} is not valid.`)
  return parsed
}

export function contactSourcePath(value: unknown): string {
  if (value !== '/contact') return '/contact'
  return '/contact'
}

export function isLikelyCommercialSolicitation(input: { question: string; context?: string }): boolean {
  const text = `${input.question}\n${input.context ?? ''}`
  return SOLICITATION_PATTERNS.some((pattern) => pattern.test(text))
}

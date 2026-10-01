export const OFFER_BY_SERVICE = {
  verified_research: 'verified-research-brief',
  rapid_intelligence: 'rapid-intelligence-brief',
  mps_evidence_audit: 'mps-evidence-audit',
  mps_audit: 'mps-evidence-audit',
  token_request: 'mps-preflight',
  support: 'mps-preflight',
  general: 'rapid-intelligence-brief',
  partnership_assessment: 'partnership-assessment',
} as const

export type ServiceCode = keyof typeof OFFER_BY_SERVICE

export const SERVICE_OPTIONS: Array<{ value: ServiceCode; label: string }> = [
  { value: 'verified_research', label: 'Verified Research Brief — $2,500 / 10 business days' },
  { value: 'rapid_intelligence', label: 'Rapid Intelligence Brief — from $500 / five business days' },
  { value: 'mps_evidence_audit', label: 'MPS Evidence Audit — high-stakes document review' },
  { value: 'mps_audit', label: 'MPS Evidence Audit — manuscript or report' },
  { value: 'token_request', label: 'Cognitive Gateway Access Token Request' },
  { value: 'support', label: 'Technical Support / Troubleshooting' },
  { value: 'partnership_assessment', label: 'Design partnership / workflow assessment' },
  { value: 'general', label: 'General Inquiry' },
]

export function contactService(value: string | null): ServiceCode {
  return value && Object.hasOwn(OFFER_BY_SERVICE, value) ? value as ServiceCode : 'verified_research'
}

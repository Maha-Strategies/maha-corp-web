export const CELESTIAL_SERVICE_POLICY = {
  version: 'celestial-service-policy/1',
  apiStability: 'maha-celestial-api/1 requests and response fields remain compatible within major version 1; additive fields may be introduced.',
  metering: {
    unit: 'completed-report',
    rules: { 'facts-only': 1, 'jyotisha-source-bound': 3, 'comparative-natal': 5 },
    failedValidationUnits: 0,
    disclosure: 'The API gateway request credit and completed-report units are recorded separately. Contract pricing controls invoicing.',
  },
  serviceObjective: {
    availability: '99.9% monthly for contracted Enterprise production traffic',
    severityOneAcknowledgement: '30 minutes',
    recoveryPointObjective: '24 hours for encrypted saved-report metadata; unsaved reports have no recovery commitment',
    boundary: 'These are service objectives, not a public SLA. Credits and remedies apply only when stated in an executed order form.',
  },
  incidentPolicy: {
    statuses: ['investigating', 'identified', 'monitoring', 'resolved'],
    severities: ['sev1', 'sev2', 'sev3', 'maintenance'],
    disclosure: 'Customer-safe incident summaries exclude report, natal, consent, and participant data.',
  },
  reproducibility: {
    guarantee: 'Canonical result data are reproducible only when the request, interpretation pack, registry, compiler, ephemeris, and time-zone dataset versions are identical.',
    exclusions: ['Third-party geocoding output', 'narrative meaning', 'predictive accuracy', 'future availability of withdrawn packs'],
  },
} as const

export function completedReportUnits(packId: keyof typeof CELESTIAL_SERVICE_POLICY.metering.rules): number {
  return CELESTIAL_SERVICE_POLICY.metering.rules[packId]
}

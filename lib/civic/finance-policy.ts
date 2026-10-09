/** Technical restrictions for this preview; not a determination of legal eligibility. */
export const CIVIC_FINANCE_POLICY = Object.freeze({
  mode: 'research-read-only',
  acceptsPoliticalContributions: false,
  executesCampaignPayments: false,
  signsWalletTransactions: false,
  complianceStatus: 'jurisdiction-and-entity-review-required',
} as const)

export const CIVIC_FINANCE_DISABLED_MESSAGE =
  'Political contribution intake and campaign payment execution are unavailable. Jurisdiction, entity, funding-source and reporting requirements must be reviewed before implementing these capabilities.'

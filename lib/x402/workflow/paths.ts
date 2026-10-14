/** Stable contract paths; kept dependency-free for buyer SDKs. */
export const WORKFLOW_ROUTES = {
  'catalogue-price-unit-audit': ['verify', 'payments', 'price-units'],
  'dataset-null-pattern-audit': ['verify', 'datasets', 'null-patterns'],
  'dataset-key-integrity': ['verify', 'datasets', 'key-integrity'],
  'dataset-join-loss-preview': ['compute', 'datasets', 'join-loss'],
  'dataset-schema-evolution-plan': ['verify', 'datasets', 'schema-evolution'],
  'dataset-export-roundtrip-check': ['verify', 'datasets', 'export-roundtrip'],
  'research-publication-update-snapshot': ['intel', 'publications', 'updates'],
  'research-data-software-links': ['intel', 'publications', 'declared-relations'],
  'research-funding-lineage': ['intel', 'publications', 'declared-funding'],
  'research-bibliography-resolution': ['library', 'bibliography', 'resolve-dois'],
  'research-trial-status-snapshot': ['intel', 'trials', 'registry-status'],
} as const

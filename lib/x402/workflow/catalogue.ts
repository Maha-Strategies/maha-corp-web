/** Buyer-safe contract metadata. No server, roadmap file, database or source reader imports. */
export const WORKFLOW_DEFINITIONS = {
  'catalogue-price-unit-audit': { amount: '11900', title: 'Catalogue Price Unit Audit', description: 'Normalize caller-supplied token amounts using explicit per-chain decimals; unknown metadata stays unknown. No exchange-rate or USD-peg certification.' },
  'dataset-null-pattern-audit': { amount: '8900', title: 'Dataset Null Pattern Audit', description: 'Count missing fields, nulls, empty strings and populated cells separately. No imputation or private-data detection.' },
  'dataset-key-integrity': { amount: '10525', title: 'Dataset Key Integrity', description: 'Check typed composite keys for incomplete and duplicate records. No coercion or repairs.' },
  'dataset-join-loss-preview': { amount: '17500', title: 'Dataset Join Loss Preview', description: 'Measure join multiplication and unmatched records without returning joined cells. Declared keys only.' },
  'dataset-schema-evolution-plan': { amount: '29525', title: 'Dataset Schema Evolution Plan', description: 'Compare old/new field declarations for directional breaking changes. No semantic-equivalence proof or data migration.' },
  'dataset-export-roundtrip-check': { amount: '21900', title: 'Dataset Export Roundtrip Check', description: 'Compare parsed exports for cell types, field presence and order changes. No automatic correction; cell values are not returned.' },
  'research-publication-update-snapshot': { amount: '27900', title: 'Publication Update Snapshot', description: 'Read exact-DOI Crossref update metadata with source hashes. Missing notices do not prove that a paper is unretracted.' },
  'research-data-software-links': { amount: '18900', title: 'Declared Publication Relations', description: 'Return bounded relationships declared in Crossref metadata. Linked resource types, availability and reproducibility are not verified; linked files are not fetched.' },
  'research-funding-lineage': { amount: '23900', title: 'Declared Funding Metadata', description: 'Return bounded publisher-deposited Crossref funder and award metadata. No independent grant verification or completeness claim.' },
  'research-bibliography-resolution': { amount: '16900', title: 'Exact DOI Bibliography Resolution', description: 'Resolve up to five exact DOIs to public metadata. No fuzzy matching, abstracts, author lists or full-text delivery.' },
  'research-trial-status-snapshot': { amount: '45025', title: 'Trial Registry Status Snapshot', description: 'Read public ClinicalTrials.gov NCT status and last-update metadata. No clinical advice, participant/contact data or independent study validation.' },
} as const

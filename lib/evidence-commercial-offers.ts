export const EVIDENCE_COMMERCIAL_TERMS_VERSION = 'maha-evidence-commercial-terms/1.0' as const

export const EVIDENCE_COMMERCIAL_OFFERS = {
  evidencePreflight: {
    offerId: 'evidence-preflight-free',
    name: 'Evidence Preflight',
    state: 'available-free',
    priceUsd: 0,
    path: '/tools/evidence-preflight',
    scope: 'Deterministic structural triage for one to three caller-supplied claims, DOI or public URL metadata, authorized excerpts, exact locators, and rights/access declarations.',
    evidenceBoundary: 'No source is fetched, opened, authenticated, compared, or independently verified. A ready result is ready for source inspection, not verified.',
    privacy: 'Claim text and excerpts are processed transiently and returned to the browser. The durable ledger stores only keyed pseudonyms and aggregate request metadata.',
    turnaround: 'Returned in the browser during the submission request, subject to the published daily limit and service availability.',
    refund: 'No payment is collected, so no refund applies.',
  },
  mpsDocumentPreflight: {
    offerId: 'mps-preflight',
    name: 'MPS Document Preflight',
    state: 'self-service-checkout',
    priceUsd: 49,
    path: '/mps/preflight',
    scope: 'Automated claim-level triage for one nonfiction document extract of up to 12,000 characters, with a private claim map and verification backlog.',
    evidenceBoundary: 'Automated triage is not primary-source verification, certification, legal advice, investment advice, or a human Evidence Audit.',
    privacy: 'The document is processed transiently. Maha stores an input digest and the private report, including claim excerpts, but not the submitted source document as a separate retained object.',
    turnaround: 'Processing begins after Stripe confirms payment and the customer submits the extract. The report is normally generated during that private session; recovery may require support if a dependency fails.',
    refund: 'If payment is confirmed but Maha cannot deliver the report, the customer may choose a rerun or a full refund. A delivered report is non-refundable except where required by law.',
  },
  verifiedEvidenceDossier: {
    offerId: 'verified-evidence-dossier',
    name: 'Verified Evidence Dossier',
    state: 'qualification-first-purchase-disabled',
    priceUsd: 250,
    path: '/evidence-audit#verified-evidence-dossier',
    scope: 'A bounded source-inspection engagement for up to ten claims, with located evidence, claim-level findings, explicit limitations, and digest-bound JSON-LD and PDF deliverables.',
    evidenceBoundary: 'Verified applies only to the source identities, passages, locators, checks, and bounded findings recorded in the delivered dossier. It is not certification of universal truth, legal clearance, patent clearance, consensus, or independent reproduction.',
    privacy: 'Only material accepted during scoping may enter the private review workspace. Confidential, privileged, export-controlled, or restricted material requires a separately agreed handling basis.',
    turnaround: 'Turnaround is confirmed in writing after source access and scope are accepted and before any payment is requested.',
    refund: 'Public checkout is disabled. If checkout is later enabled, the accepted scope, delivery date, failure remedy, and refund terms must be presented before payment.',
  },
} as const

export type EvidenceCommercialOffer = (typeof EVIDENCE_COMMERCIAL_OFFERS)[keyof typeof EVIDENCE_COMMERCIAL_OFFERS]

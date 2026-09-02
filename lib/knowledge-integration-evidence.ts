export const KNOWLEDGE_INTEGRATIONS_PATH = '/knowledge/integrations'
export const EXACTZK_EVIDENCE_PATH = `${KNOWLEDGE_INTEGRATIONS_PATH}/exactzk-independent-reproduction`
export const EXACTZK_RELEASE_DATE = '2026-09-01'
export const NSGOODS_PREFLIGHT_V3_EVIDENCE_PATH = `${KNOWLEDGE_INTEGRATIONS_PATH}/nsgoods-preflight-v3-fixture-validation`
export const NSGOODS_PREFLIGHT_V3_RELEASE_DATE = '2026-09-02'

export const EXACTZK_EVIDENCE = {
  title: 'ExactZK independent circuit-provenance reproduction',
  summary:
    'A cryptographically signed record that Maha Strategies independently reproduced the expected MNIST MLP verifying-key digests at one pinned ExactZK bundle revision.',
  bundleRevision: '54637f58522169deff89f03bfaa4bb765ff92eca',
  publicationCommit: 'a2bc90d0a33a548fbcae09bb1756a4fc31286f4a',
  ezklVersion: '23.0.5',
  verifyingKeySha256: '1ed847e127419bc1d7db2a22779f75284975bf1908b33a43486ca9070e4ef627',
  verifyingKeyKeccak256: 'dd03fb0c69e96cc02cbcc6bed8ef51665f934c01cddaf2a855bd1c7fce94675f',
  signedFileSha256: '39ef9f94bec3adf3a85c955ca40381a48c7d20e75afa613a18e600e8bbb8d009',
  canonicalPayloadSha256: '978523dfd9d96b2d3a598d6f6db3389a0cb28b9a69d52171218f130b755af87f',
  did: 'did:key:zQ3shMymYG2u2NQqbPH9xLLSzo2FT5iqDoyqUbvtX8nJ9FY9T',
  signedArtifactPath: '/artifacts/integrations/exactzk-independent-reproduction-attestation-001.json',
  integrationRecordPath: '/artifacts/integrations/exactzk-independent-reproduction-record-2026-09-01.json',
  upstreamRepository: 'https://github.com/achemperety/exactzk-mnistmlp-provenance-demo',
  upstreamPublication:
    'https://github.com/achemperety/exactzk-mnistmlp-provenance-demo/blob/a2bc90d0a33a548fbcae09bb1756a4fc31286f4a/attestations/001-maha-strategies-2026-08-31.json',
} as const

export const NSGOODS_PREFLIGHT_V3_EVIDENCE = {
  title: 'NSGoods composite preflight v3 fixture validation',
  summary:
    'A sanitized record of Maha Strategies’ offline consumer verification of the frozen NSGoods preflight_v3 contract, signed fixtures, signer authority, invariants, tamper resistance and cross-version rejection behavior.',
  schemaVersion: 'preflight_v3',
  auditKind: 'fixture-only-offline-consumer-verification',
  auditedAt: '2026-09-01T12:01:11.619272Z',
  authorizedCompositeSigner: '0x57fF0F084Cba33e6761503f90eEF0Da9F159350c',
  schemaSha256: '7c9e99de9391183a262f84d94ae4c21babcdb5e5d5d17a0346d233c3d310f44a',
  combinedFixtureAndSchemaSha256: 'cf1e2b16bc626eba01af48d84f1b5026a01d104c993cd097600900c22cf6251f',
  validationRecordPath: '/artifacts/integrations/nsgoods-preflight-v3-fixture-validation-2026-09-01.json',
  contractUrl: 'https://x402.nsgoods.org/preflight/schema/preflight_v3.html',
  schemaUrl: 'https://x402.nsgoods.org/preflight/schema/preflight_v3.schema.json',
  fixtureDigestUrl: 'https://x402.nsgoods.org/preflight/fixtures/preflight_v3/DIGEST',
  proofManifestUrl: 'https://x402.nsgoods.org/proof/index.json',
} as const

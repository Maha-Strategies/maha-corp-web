export const KNOWLEDGE_INTEGRATIONS_PATH = '/knowledge/integrations'
export const EXACTZK_EVIDENCE_PATH = `${KNOWLEDGE_INTEGRATIONS_PATH}/exactzk-independent-reproduction`
export const EXACTZK_RELEASE_DATE = '2026-09-01'

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

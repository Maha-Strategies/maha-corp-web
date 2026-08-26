import assert from 'node:assert/strict'
import { readFileSync, rmSync } from 'node:fs'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

import { compileEvidenceDossier, type EvidenceDossierDraft } from '../lib/evidence-dossier/compiler.ts'
import { DEMONSTRATION_DOSSIER } from '../lib/evidence-dossier/demonstration.ts'
import { passageDigest, provenanceDigest, sha256Hex } from '../lib/evidence-dossier/digest.ts'
import {
  DOSSIER_OFFER_LIST_PRICE_USD,
  buildEvidenceDossierPackage,
  evaluateDossierOfferReadiness,
  validateEvidenceDossierPackage,
  writeEvidenceDossierPackage,
  type DossierEngagement,
} from '../lib/evidence-dossier/package.ts'
import { validateDossier } from '../lib/evidence-dossier/validator.ts'
import { EPISTEMIC_RECORDS } from '../lib/epistemic-pilots.ts'
import { epistemicReviewTargetHash } from '../lib/epistemic-publication.ts'
import { FRONTIER_ALIGNMENT_AUDIT, alignmentBlockers, type AlignmentVerdict } from '../lib/frontier-source-alignment.ts'
import { substantialPageContractDigest } from '../lib/substantial-page-compiler.ts'
import { compilePilots } from '../lib/substantial-page-pilots.ts'
import { evaluateSubstantialPageGate } from '../lib/substantial-page.ts'
import { adaptSubstantialPageToDossier } from '../lib/evidence-dossier/substantial-page-adapter.ts'

const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T

function draft(): EvidenceDossierDraft {
  const source = clone(DEMONSTRATION_DOSSIER)
  const {
    schemaVersion: _, epistemicBaseVersion: __, provenanceBundle: ___,
    passages, claims, comparisons, ...base
  } = source
  return {
    ...base,
    passages: passages.map(({ passageHash: _, ...passage }) => passage),
    claims: claims.map(({ provenanceDigest: _, ...claim }) => claim),
    comparisons: comparisons.map(({ provenanceDigest: _, ...comparison }) => comparison),
  }
}

function rehearsal(): DossierEngagement {
  return {
    mode: 'internal-rehearsal',
    listPriceUsd: DOSSIER_OFFER_LIST_PRICE_USD,
    contractedPriceUsd: 0,
    cashReceivedUsd: 0,
    requestedAt: '2026-08-26T00:00:00Z',
    deliveryTargetDays: 10,
    customerReference: null,
  }
}

test('draft compilation computes every digest and produces a valid dossier', () => {
  const compiled = compileEvidenceDossier(draft())
  assert.deepEqual(validateDossier(compiled), [])
  for (const passage of compiled.passages) assert.equal(passage.passageHash, passageDigest(passage))
  for (const claim of compiled.claims) assert.equal(claim.provenanceDigest, provenanceDigest(claim))
  for (const comparison of compiled.comparisons) assert.equal(comparison.provenanceDigest, provenanceDigest(comparison))
  assert.equal(compiled.provenanceBundle.dossierDigest, provenanceDigest(compiled))
})

test('compilation is deterministic across top-level input ordering', () => {
  const first = draft()
  const reordered = draft()
  reordered.sources = [...reordered.sources].reverse()
  reordered.passages = [...reordered.passages].reverse()
  reordered.claims = [...reordered.claims].reverse()
  reordered.comparisons = [...reordered.comparisons].reverse()
  assert.deepEqual(compileEvidenceDossier(first), compileEvidenceDossier(reordered))
})

test('the validator detects stale fragment and dossier digests', () => {
  const compiled = compileEvidenceDossier(draft())
  const stalePassage = clone(compiled)
  stalePassage.passages[0].excerpt += ' changed'
  assert.ok(validateDossier(stalePassage).some((issue) => issue.code === 'passage-hash-mismatch'))
  assert.ok(validateDossier(stalePassage).some((issue) => issue.code === 'dossier-digest-mismatch'))

  const staleClaim = clone(compiled)
  staleClaim.claims[0].auditedStatement += ' changed'
  assert.ok(validateDossier(staleClaim).some((issue) => issue.code === 'claim-digest-mismatch'))
})

test('the package emits a deterministic manifest and complete delivery set', () => {
  const compiled = compileEvidenceDossier(draft())
  const first = buildEvidenceDossierPackage(compiled, rehearsal())
  const second = buildEvidenceDossierPackage(compiled, rehearsal())
  assert.deepEqual(first, second)
  assert.equal(first.files.length, 8)
  assert.deepEqual(first.files.map((entry) => entry.path), [
    'claim-ledger.csv', 'comparison-matrix.csv', 'dossier.canonical.json', 'dossier.json',
    'passage-ledger.csv', 'print-report.html', 'reviewer-packet.md', 'source-ledger.csv',
  ])
  for (const entry of first.files) {
    assert.equal(entry.sha256, `sha256:${sha256Hex(entry.content)}`)
    assert.equal(entry.bytes, Buffer.byteLength(entry.content, 'utf8'))
  }
  assert.equal(first.manifest.files.length, first.files.length)
  assert.match(first.manifest.packageDigest, /^sha256:[a-f0-9]{64}$/)
  assert.match(first.files.find((entry) => entry.path === 'print-report.html')!.content, /noindex,nofollow/)
  assert.deepEqual(validateEvidenceDossierPackage(first), [])
})

test('package verification detects file and manifest tampering', () => {
  const bundle = buildEvidenceDossierPackage(compileEvidenceDossier(draft()), rehearsal())
  bundle.files[0].content += 'tampered'
  const issues = validateEvidenceDossierPackage(bundle)
  assert.ok(issues.includes(`package-file-size-mismatch:${bundle.files[0].path}`))
  assert.ok(issues.includes(`package-file-digest-mismatch:${bundle.files[0].path}`))
})

test('a package writes once and refuses to overwrite its directory', () => {
  const root = mkdtempSync(join(tmpdir(), 'maha-dossier-package-'))
  const target = join(root, 'output')
  try {
    const bundle = buildEvidenceDossierPackage(compileEvidenceDossier(draft()), rehearsal())
    writeEvidenceDossierPackage(bundle, target)
    assert.equal(JSON.parse(readFileSync(join(target, 'manifest.json'), 'utf8')).packageDigest, bundle.manifest.packageDigest)
    assert.throws(() => writeEvidenceDossierPackage(bundle, target), /exist/i)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('internal rehearsals cannot be recorded as revenue or customer work', () => {
  const dishonest = { ...rehearsal(), contractedPriceUsd: 5_000, cashReceivedUsd: 5_000, customerReference: 'customer' }
  assert.throws(() => buildEvidenceDossierPackage(compileEvidenceDossier(draft()), dishonest), /internal rehearsal cannot record/i)
})

test('paid-pilot accounting separates list price, contract, and cash', () => {
  const paid: DossierEngagement = {
    ...rehearsal(),
    mode: 'paid-pilot',
    contractedPriceUsd: 3_500,
    cashReceivedUsd: 1_000,
    customerReference: 'bounded-customer-reference',
  }
  const bundle = buildEvidenceDossierPackage(compileEvidenceDossier(draft()), paid)
  assert.equal(bundle.manifest.engagement.listPriceUsd, 5_000)
  assert.equal(bundle.manifest.engagement.contractedPriceUsd, 3_500)
  assert.equal(bundle.manifest.engagement.cashReceivedUsd, 1_000)
})

test('schema validity does not masquerade as fixed-fee offer readiness', () => {
  const decision = evaluateDossierOfferReadiness(compileEvidenceDossier(draft()))
  assert.equal(decision.readyForFixedFeeOffer, false)
  assert.ok(decision.reasons.includes('offer-source-scope-outside-5-to-12'))
  assert.ok(decision.reasons.includes('offer-source-not-inspected'))
  assert.ok(decision.reasons.includes('offer-internal-audit-missing'))
})

test('print output escapes dossier-controlled HTML', () => {
  const malicious = draft()
  malicious.title = '<script>alert(1)</script>'
  const bundle = buildEvidenceDossierPackage(compileEvidenceDossier(malicious), rehearsal())
  const report = bundle.files.find((entry) => entry.path === 'print-report.html')!.content
  assert.doesNotMatch(report, /<script>alert/)
  assert.match(report, /&lt;script&gt;alert/)
  for (const heading of ['Sources', 'Passages', 'Claims', 'Comparisons', 'Contradictions', 'Unsupported inferences', 'Limitations', 'Boundary']) {
    assert.match(report, new RegExp(`<h2>${heading}</h2>`))
  }
})

test('ledger exports neutralize spreadsheet formulas', () => {
  const formula = draft()
  formula.claims[0].auditedStatement = '=HYPERLINK("https://example.invalid","open")'
  const bundle = buildEvidenceDossierPackage(compileEvidenceDossier(formula), rehearsal())
  const ledger = bundle.files.find((entry) => entry.path === 'claim-ledger.csv')!.content
  assert.match(ledger, /"'=HYPERLINK\(""https:\/\/example\.invalid""/)
  assert.doesNotMatch(ledger, /,"=HYPERLINK/)
})

test('the compiler remains local, noncanonical, and credential-free', () => {
  const cli = readFileSync(new URL('../scripts/compile-evidence-dossier-package.ts', import.meta.url), 'utf8')
  const sitemap = readFileSync(new URL('../app/sitemap.ts', import.meta.url), 'utf8')
  const llms = readFileSync(new URL('../lib/llms-manifest.ts', import.meta.url), 'utf8')
  assert.match(cli, /Credential-shaped arguments are prohibited/)
  assert.doesNotMatch(cli, /fetch\(|process\.env|Authorization/)
  assert.doesNotMatch(sitemap, /compile-evidence-dossier-package/)
  assert.doesNotMatch(llms, /compile-evidence-dossier-package/)
})

function hbnAdapterInput() {
  const slug = 'advanced-materials-hexagonal-boron-nitride-dielectrics'
  const record = EPISTEMIC_RECORDS.find((entry) => entry.slug === slug)!
  const compiledPage = compilePilots().find((entry) => entry.slug === slug)!
  const source = record.sources[0]
  const claim = record.claims[0]
  return {
    record,
    compiledPage,
    dossierId: 'internal-rehearsal-hbn-dielectrics-test',
    generatedAt: '2026-08-26T00:00:00Z',
    corpusRevision: compiledPage.contract.recordRevisionSha256,
    reviewState: 'illustrative-draft' as const,
    intendedUse: 'Test the bounded internal adapter workflow without producing a public or customer-facing artifact.',
    methodology: 'Bind an eligible substantial-page contract to explicitly inspected evidence without retrieval or invented locators.',
    prohibitedUses: ['No manufacturing inference.', 'No performance guarantee.', 'No external-review claim.'],
    limitations: ['One bounded claim only.', 'One inspected source only.', 'No replication assessment.', 'No commercial readiness claim.'],
    disclaimer: 'Internal rehearsal only. It does not establish scientific truth, independent reproduction, external endorsement, or commercial validation.',
    attestations: [{
      sourceId: source.id,
      verifiedAt: '2026-08-26',
      metadataProvenance: 'Test attestation tied to the inspected publisher abstract.',
      extractionMethod: 'publisher-html-read' as const,
      passages: [{
        passageId: 'passage-hbn-test',
        claimIds: [claim.id],
        locator: source.exactLocator,
        locatorKind: 'section' as const,
        excerpt: source.establishes,
        isParaphrase: true,
        sourceRevision: source.identifiers[0]!.value,
      }],
    }],
  }
}

test('an eligible substantial page compiles into a bounded dossier rehearsal', () => {
  const dossier = adaptSubstantialPageToDossier(hbnAdapterInput())
  assert.deepEqual(validateDossier(dossier), [])
  assert.equal(dossier.claims.length, 1)
  assert.equal(dossier.passages[0].originalDocumentInspected, true)
  const packageBundle = buildEvidenceDossierPackage(dossier, rehearsal())
  assert.equal(packageBundle.manifest.offerReadiness.readyForFixedFeeOffer, false)
  assert.ok(packageBundle.manifest.offerReadiness.reasons.includes('offer-claim-scope-outside-8-to-15'))
})

test('the adapter fails closed without inspected passages or an eligible page', () => {
  const missing = hbnAdapterInput()
  missing.attestations = []
  assert.throws(() => adaptSubstantialPageToDossier(missing), /attestation missing/i)

  const blocked = hbnAdapterInput()
  blocked.compiledPage = { ...blocked.compiledPage, decision: { ...blocked.compiledPage.decision, pageEligible: false, reasons: ['alignment-blocked'] } }
  assert.throws(() => adaptSubstantialPageToDossier(blocked), /decision does not match/i)
})

function blockedAlignmentInput(verdict: AlignmentVerdict) {
  const audit = FRONTIER_ALIGNMENT_AUDIT.find((entry) => entry.evidence.subjectAligned === verdict)!
  const record = EPISTEMIC_RECORDS.find((entry) => entry.id === audit.recordId)!
  const base = hbnAdapterInput()
  const contract = {
    ...clone(base.compiledPage.contract),
    recordId: record.id,
    recordRevisionSha256: epistemicReviewTargetHash(record),
  }
  const decision = evaluateSubstantialPageGate(record, contract, EPISTEMIC_RECORDS, alignmentBlockers(record.id))
  return {
    ...base,
    record,
    compiledPage: {
      ...base.compiledPage,
      contract,
      decision: { ...decision, reasons: [...decision.reasons].sort() },
      contractDigest: substantialPageContractDigest(contract),
    },
    attestations: [],
  }
}

test('every non-clear alignment state fails at the dossier boundary', () => {
  for (const [verdict, blocker] of [
    ['insufficient-evidence', 'source-alignment-insufficient-evidence'],
    ['inaccessible-source', 'source-inaccessible'],
    ['mismatched', 'source-subject-mismatched'],
    ['partially-supported', 'source-subject-partially-supported'],
  ] as const) {
    assert.throws(() => adaptSubstantialPageToDossier(blockedAlignmentInput(verdict)), new RegExp(blocker))
  }

  const positional = FRONTIER_ALIGNMENT_AUDIT.find((entry) => entry.assignmentOrigin === 'positional-legacy')!
  const positionalInput = blockedAlignmentInput(positional.evidence.subjectAligned)
  assert.throws(() => adaptSubstantialPageToDossier(positionalInput), /source-assignment-positional-legacy/)

  const unknown = hbnAdapterInput()
  unknown.record = { ...unknown.record, id: 'urn:maha:record:not-audited' }
  assert.throws(() => adaptSubstantialPageToDossier(unknown), /alignment-audit-missing/)
})

test('metadata-only resolution cannot become passage-supported dossier evidence', () => {
  const audit = FRONTIER_ALIGNMENT_AUDIT.find((entry) => entry.evidence.metadataVerified && !entry.evidence.sourceContentInspected)!
  const input = blockedAlignmentInput(audit.evidence.subjectAligned)
  assert.throws(() => adaptSubstantialPageToDossier(input), /source-not-inspected|source-alignment-insufficient-evidence/)
})

test('the adapter independently rejects forged decisions, stale revisions, and tampered contracts', () => {
  const forged = hbnAdapterInput()
  forged.compiledPage = {
    ...forged.compiledPage,
    decision: { ...forged.compiledPage.decision, pageEligible: false, reasons: ['caller-supplied'] },
  }
  assert.throws(() => adaptSubstantialPageToDossier(forged), /decision does not match/)

  const stale = hbnAdapterInput()
  stale.compiledPage = {
    ...stale.compiledPage,
    contract: { ...stale.compiledPage.contract, recordRevisionSha256: `sha256:${'0'.repeat(64)}` },
  }
  stale.compiledPage.contractDigest = substantialPageContractDigest(stale.compiledPage.contract)
  assert.throws(() => adaptSubstantialPageToDossier(stale), /record revision is stale/)

  const tampered = hbnAdapterInput()
  tampered.compiledPage = {
    ...tampered.compiledPage,
    contract: {
      ...tampered.compiledPage.contract,
      directAnswer: { ...tampered.compiledPage.contract.directAnswer, text: `${tampered.compiledPage.contract.directAnswer.text} tampered` },
    },
  }
  assert.throws(() => adaptSubstantialPageToDossier(tampered), /contract digest mismatch/)
})

test('dossier passages cannot detach from cited claims, declared sources, or exact locators', () => {
  const unknownClaim = hbnAdapterInput()
  unknownClaim.attestations[0].passages[0].claimIds = ['urn:maha:claim:not-cited']
  assert.throws(() => adaptSubstantialPageToDossier(unknownClaim), /unresolved or uncited claim/)

  const wrongSource = hbnAdapterInput()
  wrongSource.attestations[0].sourceId = 'source-not-declared'
  assert.throws(() => adaptSubstantialPageToDossier(wrongSource), /attestation missing/)

  const noLocator = hbnAdapterInput()
  noLocator.attestations[0].passages[0].locator = ''
  assert.throws(() => adaptSubstantialPageToDossier(noLocator), /requires a locator and bounded text/)
})

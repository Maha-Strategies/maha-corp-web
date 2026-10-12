import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { SCIENCE_IDS, SCIENCE_PRODUCTS, SCIENCE_SAMPLES, SCIENCE_INPUT_SCHEMAS, SCIENCE_VERSION, type ScienceId } from '../lib/x402/science/contracts.ts'
import { buildMicroProduct, verifyMicroProduct, microDigest } from '../lib/x402/micro-products.ts'
import { MICRO_OFFERS } from '../lib/x402/micro-offers.ts'
import { microExecutionAllowed } from '../lib/x402/micro-release.ts'
import { schemaAccepts } from '../lib/x402/micro-schema.ts'
import { validate } from './helpers/json-schema.ts'
import { fixture } from './helpers/micro-payment-fixture.ts'
import { MICRO_RECOVERY_MODE_HEADER, MICRO_RECOVERY_PAYER_HEADER } from '../lib/x402/micro-recovery-contract.ts'
import { assertUniqueCohortPrices } from '../lib/x402/micro-price-policy.ts'
import { X402_OFFERS } from '../lib/x402/offers.ts'
import { OPERATOR_SETTLEMENT_RECEIPTS } from '../lib/x402/operator-settlement-receipts.ts'
import priceReservations from '../lib/x402/science/price-reservations.json' with { type: 'json' }

const sample = (id: ScienceId) => structuredClone(SCIENCE_SAMPLES[id])
const findings = async (id: ScienceId, change = {}) => (await buildMicroProduct(id, { ...sample(id), ...change })).result.findings as Record<string, unknown>
function near(actual: unknown, expected: number, tolerance = 1e-8) { assert.equal(typeof actual, 'number'); assert.ok(Math.abs(Number(actual) - expected) <= tolerance, `${actual} != ${expected}`) }
const refs: Record<ScienceId, (f: Record<string, unknown>) => void> = {
  'quantum-measurement-uncertainty': f => { assert.equal(f.shots, 100); assert.deepEqual(f.probabilities, [.5, .5]); near((f.intervals as { lower: number }[])[0].lower, .4038315303659956) },
  'quantum-state-validity': f => { assert.equal(f.valid, true); near(f.minimumEigenvalue, 0) },
  'quantum-observable-expectations': f => { near(f.X, 1); near(f.Y, 0); near(f.Z, 0) },
  'quantum-state-fidelity-purity': f => { near(f.fidelity, .5); near(f.purity, 1) },
  'quantum-coherence-budget': f => { near(f.relaxationSurvival, .9048374180359595); near(f.coherenceFraction, .8824969025845955); assert.equal(f.physicalT2Constraint, true) },
  'quantum-readout-calibration': f => { near(f.correctedZeroFraction, .47058823529411764); assert.equal(f.correctedClipped, false) },
  'quantum-circuit-lint': f => { assert.equal(f.valid, true); assert.equal(f.depth, 2); assert.equal(f.simulated, false) },
  'quantum-randomized-benchmarking-fit': f => { near(f.decayPerClifford, .9); near(f.errorPerClifford, .05) },
  'quantum-rabi-ramsey-analysis': f => { near(f.frequency, 10); near(f.decay, .2); near(f.amplitude, .4); assert.equal(f.parameterConfidenceInterval, null) },
  'quantum-stabilizer-consistency': f => { assert.equal(f.consistent, true); assert.equal(f.independentGenerators, 2); assert.equal(f.logicalQubits, 0) },
  'quantum-surface-code-resource-scenario': f => { assert.equal(f.physicalQubits, 98); near(f.errorPerLogicalCycle, .0001); near(f.unionBoundFailure, .02) },
  'quantum-benchmark-comparability': f => assert.equal(f.comparableDeclarations, true),
  'quantum-architecture-requirements': f => assert.equal((f.assessments as { meetsDeclaredConstraints: boolean }[])[0].meetsDeclaredConstraints, true),
  'biology-fasta-quality': f => { assert.equal(f.valid, true); assert.deepEqual(f.records, [{ id: 'synthetic', length: 5, ambiguous: 1 }]) },
  'biology-dna-rna-composition': f => { assert.equal(f.calledBases, 4); near(f.gcFractionOfCalledBases, .5); near(f.ambiguousFraction, 1 / 3) },
  'biology-protein-sequence-descriptors': f => { assert.equal(f.length, 4); near(f.averageMassDa, 436.43698); assert.equal(f.modifiedResiduesSupported, false) },
  'biology-pairwise-sequence-comparison': f => { assert.equal(f.score, 4); near(f.identityFraction, .75); assert.equal(f.gaps, 1) },
  'biology-accession-version-check': f => { assert.equal(f.uniqueMatch, true); assert.equal(f.authoritativeDatabaseQueried, false) },
  'biology-protein-confidence-audit': f => { near(f.meanPlddt, 68.75); near(f.veryLowFraction, .25) },
  'biology-qpcr-run-quality': f => { near(f.meanCt, 22.1); near(f.ctSD, .1); assert.deepEqual(f.issues, []) },
  'biology-qpcr-relative-expression': f => { near(f.expressionRatio, 4); near(f.deltaDeltaCt, -2) },
  'biology-assay-control-coverage': f => assert.equal(f.covered, true),
  'biology-research-dose-response-fit': f => { near(f.halfResponseDose, 4); near(f.hillSlope, 1) },
  'biology-replicate-batch-confounding': f => { assert.equal(f.biologicalUnits, 2); assert.deepEqual(f.fullyConditionConfoundedBatches, ['b1', 'b2']) },
  'biology-translation-boundary-check': f => { assert.equal(f.frameMatches, false); assert.equal(f.humanEfficacyEstablished, false) },
  'biology-design-assay-evidence-brief': f => { assert.equal(f.provenanceDeclarationsComplete, true); assert.equal(f.designOrAssayVerified, false) },
  'chemistry-formula-mass-check': f => near(f.molarMassGPerMol, 180.156),
  'chemistry-dilution-calculator': f => { near(f.stockVolumeL, .001); near(f.diluentVolumeL, .009) },
  'chemistry-concentration-basis': f => near(f.value, 58.44),
  'chemistry-smiles-validation': f => { assert.equal(f.valid, true); assert.equal(f.atoms, 3); assert.equal(f.canonicalSmiles, 'CCO') },
  'chemistry-molecular-descriptor-pack': f => { near(f.averageMass, 46.069); near(f.exactMass, 46.041864812); near(f.tpsa, 20.23); assert.equal(f.hydrogenBondDonors, 1) },
  'chemistry-molecular-identity-comparison': f => assert.equal(f.identicalCanonicalStructure, true),
  'chemistry-fingerprint-similarity': f => { near(f.tanimoto, 1); assert.equal(f.identityEstablished, false) },
  'chemistry-reaction-conservation': f => { assert.equal(f.balanced, true); assert.equal(f.feasibilityEstablished, false) },
  'chemistry-spectrum-peak-comparison': f => { assert.deepEqual(f.unmatchedReferenceIndices, [1, 2]); assert.equal(f.compoundIdentityEstablished, false) },
  'chemistry-arrhenius-fit': f => { near(f.activationEnergyJPerMol, 41572.3130907662, .000001); near(f.preExponential, 22026.465794806718, .000001) },
  'chemistry-electrochemical-normalizer': f => near(f.convertedPotentialV, .253),
  'chemistry-enzyme-kinetics-fit': f => { near(f.Vmax, 10); near(f.Km, 2) },
  'materials-property-record-check': f => { assert.equal(f.declarationsComplete, true); near(f.relativeUncertainty, .01) },
  'materials-particle-size-summary': f => { near(f.D10Micrometers, 1); near(f.D50Micrometers, 2); near(f.D90Micrometers, 4); near(f.weightedMeanMicrometers, 2.25) },
  'materials-sheet-resistance': f => near(f.sheetResistanceOhmPerSquare, 10),
  'materials-thermal-expansion-mismatch': f => near(f.mismatchStrain, .0005),
  'materials-thermal-stack-resistance': f => { near(f.areaNormalizedResistanceM2KPerW, .0002); near(f.resistanceKPerW, .02) },
  'materials-stress-strain-analysis': f => { near(f.elasticModulusMPa, 100000); near(f.ultimateStressMPa, 300); near(f.energyDensityMJPerM3, 2.35) },
  'materials-xrd-peak-analysis': f => { const spacings = f.dSpacingAngstrom as number[]; near(spacings[2], 1.5406); assert.equal(f.phaseIdentityEstablished, false) },
  'materials-optical-bandgap-fit': f => { near(f.bandgapEV, 1); near(f.fitWindowSensitivityEV, 0) },
  'materials-raman-reference-comparison': f => { assert.deepEqual(f.unmatchedReferenceIndices, [2]); assert.equal(f.uniqueMaterialIdentityEstablished, false) },
  'materials-candidate-comparison': f => { const rows = f.assessments as { score: number | null }[]; near(rows[0].score, .5); assert.equal(rows[1].score, null) },
  'materials-deposition-compatibility': f => { assert.equal((f.declaredConstraintConflicts as string[]).length, 2); assert.equal(f.compatibilityValidated, false) },
  'materials-qualification-evidence-brief': f => { assert.deepEqual(f.missingTests, ['thermal-cycle']); assert.equal(f.qualificationEstablished, false) },
}
for (const id of SCIENCE_IDS) {
  test(`${id}: analytical/reference result and independent schemas`, async () => {
    const input = sample(id), offer = MICRO_OFFERS.find(o => o.id === id)!
    assert.deepEqual(validate(input, SCIENCE_INPUT_SCHEMAS[id]), [])
    const response = await buildMicroProduct(id, input)
    refs[id](response.result.findings as Record<string, unknown>)
    assert.equal(response.result.methodVersion, SCIENCE_VERSION)
    assert.deepEqual(validate(response, offer.discovery.outputSchema), [])
    assert.deepEqual(response, offer.discovery.output)
    assert.ok(await verifyMicroProduct(id, input, response))
    const forged = structuredClone(response); forged.result = { ...forged.result, methodVersion: 'invented-version' }
    const body = { ...forged } as Record<string, unknown>; delete body.receiptDigest; forged.receiptDigest = microDigest(body)
    assert.equal(await verifyMicroProduct(id, input, forged), false)
    assert.ok(Buffer.byteLength(JSON.stringify(response)) <= 65536)
  })
  test(`${id}: fail-closed input and production contract`, async () => {
    for (const bad of [{}, { ...sample(id), extra: 'private' }, { ...sample(id), dataClass: 'patient' }]) await assert.rejects(buildMicroProduct(id, bad))
    const offer = MICRO_OFFERS.find(o => o.id === id)!
    assert.equal(offer.status, 'available'); assert.equal(microExecutionAllowed(id, 'production'), true)
    assert.ok(offer.description.length <= 180); assert.ok(offer.serviceName)
    assert.ok(offer.tags.includes(id.split('-')[0] === 'materials' ? 'materials' : id.split('-')[0]))
    assert.ok(readFileSync(new URL(`../app/api/v1/micro/${id}/route.ts`, import.meta.url), 'utf8').includes(`microHandlers('${id}')`))
    const f = fixture(offer, { environment: 'production' }); const response = await f.handlers.POST(f.request())
    assert.equal(response.status, 402); assert.equal(f.calls.resolve, 1); assert.equal(f.calls.settle, 0)
  })
  test(`${id}: mocked x402 paid delivery and no-payment recovery`, async () => {
    const f = fixture(MICRO_OFFERS.find(o => o.id === id)!), signature = await f.signature()
    const invalid = await f.handlers.POST(f.request({}, { 'PAYMENT-SIGNATURE': signature }))
    assert.equal(invalid.status, 400); assert.equal(f.calls.settle, 0); assert.equal(f.calls.verify, 0)
    const paid = await f.handlers.POST(f.request(undefined, { 'PAYMENT-SIGNATURE': signature }))
    assert.equal(paid.status, 200); const original = await paid.json(); assert.equal(f.calls.settle, 1)
    const recovery = await f.handlers.POST(f.request(undefined, { [MICRO_RECOVERY_MODE_HEADER]: 'replay', [MICRO_RECOVERY_PAYER_HEADER]: `0x${'4'.repeat(40)}` }))
    assert.equal(recovery.status, 200); assert.deepEqual(await recovery.json(), original); assert.equal(f.calls.settle, 1)
    assert.equal(recovery.headers.get('x-maha-payment-replayed'), 'true')
  })
}
test('frozen membership, price window, exact cap and reserved amounts', () => {
  assert.equal(SCIENCE_IDS.length, 50)
  assert.deepEqual(Object.keys(refs).sort(), [...SCIENCE_IDS].sort())
  assert.equal(new Set(SCIENCE_IDS.map(id => SCIENCE_PRODUCTS[id].amount)).size, 50)
  assert.equal(SCIENCE_IDS.reduce((s, id) => s + BigInt(SCIENCE_PRODUCTS[id].amount), BigInt(0)), BigInt(3577000))
  for (const id of SCIENCE_IDS) assert.ok(BigInt(SCIENCE_PRODUCTS[id].amount) >= BigInt(2000) && BigInt(SCIENCE_PRODUCTS[id].amount) <= BigInt(300000))
  assertUniqueCohortPrices(X402_OFFERS, SCIENCE_IDS, OPERATOR_SETTLEMENT_RECEIPTS.map(r => ({ id: r.offerId, amount: r.amountBaseUnits })))
  assertUniqueCohortPrices(X402_OFFERS, SCIENCE_IDS, priceReservations.reservations)
})
test('numeric schema rejects nonfinite and out-of-range inputs, not only integer values', () => {
  assert.equal(schemaAccepts({ type: 'number', minimum: 0, maximum: 1 }, .25), true)
  for (const x of [NaN, Infinity, -Infinity, '0.2', -.1, 1.1]) assert.equal(schemaAccepts({ type: 'number', minimum: 0, maximum: 1 }, x), false)
})
test('quantum complex states, signs, nonphysical inputs and stabilizer phases', async () => {
  near((await findings('quantum-observable-expectations', { state: { real: [.5, 0, 0, .5], imag: [0, -.5, .5, 0] } })).Y, 1)
  assert.equal((await findings('quantum-state-validity', { state: { real: [1, 1, 1, 0], imag: [0, 0, 0, 0] } })).valid, false)
  await assert.rejects(findings('quantum-observable-expectations', { state: { real: [1, 1, 1, 0], imag: [0, 0, 0, 0] } }))
  const g = (pauli: string, sign = '+') => ({ pauli, sign })
  assert.equal((await findings('quantum-stabilizer-consistency', { generators: [g('XX'), g('ZZ'), g('YY')] })).consistent, false)
  assert.equal((await findings('quantum-stabilizer-consistency', { generators: [g('XX'), g('ZZ'), g('YY', '-')] })).consistent, true)
  assert.equal((await findings('quantum-stabilizer-consistency', { generators: [g('X'), g('Z')] })).commuting, false)
  await assert.rejects(findings('quantum-readout-calibration', { pZeroGivenZero: .5, pZeroGivenOne: .5 }))
  assert.equal((await findings('quantum-readout-calibration', { observedZeroFraction: 0 })).physical, false)
  assert.equal((await findings('quantum-coherence-budget', { T2Seconds: .01 })).physicalT2Constraint, false)
  await assert.rejects(findings('quantum-surface-code-resource-scenario', { distance: 4 }))
})
test('sequence, assay and version ambiguities stay explicit', async () => {
  assert.equal((await findings('biology-fasta-quality', { fasta: '>a\nACGT\n>a\nACGT' })).valid, false)
  assert.equal((await findings('biology-dna-rna-composition', { sequence: 'NNN' })).gcFractionOfCalledBases, null)
  await assert.rejects(findings('biology-dna-rna-composition', { sequence: 'ACGU', alphabet: 'DNA' }))
  await assert.rejects(findings('biology-qpcr-relative-expression', { referenceStable: false }))
  await assert.rejects(findings('biology-research-dose-response-fit', { dose: [1, 1, 1], normalizedResponse: [.2, .5, .8] }))
  const accession = sample('biology-accession-version-check'); accession.records = [...accession.records as unknown[], ...accession.records as unknown[]]
  assert.equal((await findings('biology-accession-version-check', accession)).uniqueMatch, false)
})
test('molecular identity preserves stereo, charge and salts; invalid valence refuses descriptors', async () => {
  assert.equal((await findings('chemistry-smiles-validation', { smiles: 'C(C)(C)(C)(C)C' })).valid, false)
  await assert.rejects(findings('chemistry-molecular-descriptor-pack', { smiles: 'C(C)(C)(C)(C)C' }))
  assert.equal((await findings('chemistry-molecular-identity-comparison', { left: 'N[C@H](C)O', right: 'N[C@@H](C)O' })).identicalCanonicalStructure, false)
  assert.equal((await findings('chemistry-molecular-identity-comparison', { left: 'CC(=O)O', right: 'CC(=O)[O-]' })).identicalCanonicalStructure, false)
  assert.equal((await findings('chemistry-molecular-identity-comparison', { left: 'CCO.[Na+]', right: 'CCO' })).identicalCanonicalStructure, false)
  for (const formula of ['C0', 'H2O)', '(H2O', '()', 'C999999999', 'Xx2']) await assert.rejects(findings('chemistry-formula-mass-check', { formula }))
  near((await findings('chemistry-formula-mass-check', { formula: 'Ca(OH)2' })).molarMassGPerMol, 74.092)
  await assert.rejects(findings('chemistry-dilution-calculator', { targetMolPerL: 2 }))
  assert.equal((await findings('chemistry-electrochemical-normalizer', { targetConditions: 'different-condition' })).convertedPotentialV, null)
})
test('materials missing records, invalid weights and model conditions fail closed', async () => {
  await assert.rejects(findings('materials-particle-size-summary', { weights: [0, 0, 0] }))
  await assert.rejects(findings('materials-sheet-resistance', { thicknessM: 0 }))
  await assert.rejects(findings('materials-thermal-stack-resistance', { interfaceResistanceM2KPerW: [] }))
  await assert.rejects(findings('materials-optical-bandgap-fit', { fitStartIndex: 3, fitEndIndex: 4 }))
  assert.equal((await findings('materials-property-record-check', { unit: 'unreviewed' })).declarationsComplete, false)
  assert.equal((await findings('materials-qualification-evidence-brief', { evidence: [] })).qualificationEstablished, false)
})

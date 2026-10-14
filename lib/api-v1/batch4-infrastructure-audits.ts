import { z } from 'zod'
import { input, object, list, id, digest, count, signed, utc, cents, finding as f, metric as m, unique, type AuditResult, type AuditSpec } from './batch4-audit-core.ts'
import { demandDigest } from '../x402/demand6/digest.ts'
const base = { dataClass: 'synthetic', nonpersonalMetadata: true }, hash = 'sha256:' + 'a'.repeat(64)
const time = '2026-01-01T00:00:00.000Z', day1 = '2026-01-02T00:00:00.000Z', day90 = '2026-04-01T00:00:00.000Z'
const seconds = z.number().int().min(0).max(31536000)
const asset = z.string().regex(/^0x[a-fA-F0-9]{40}$/), transaction = z.string().regex(/^0x[a-fA-F0-9]{64}$/)
const assetExample = '0x' + 'a'.repeat(40), transactionExample = '0x' + 'b'.repeat(64)
const records = <T extends z.ZodRawShape>(shape: T, minimum = 1) => list(object({ id, ...shape }), minimum, 32)
const spec = <S extends z.ZodType>(id: string, description: string, schema: S, sample: Record<string, unknown>, adverse: Record<string, unknown>, codes: string[], metricKeys: string[], run: (value: z.output<S>) => AuditResult): AuditSpec =>
  ({ id, description, input: schema, sample: { ...base, ...sample }, adverse: { ...base, ...adverse }, expectedCodes: codes.slice(0, 1), codes, metricKeys, run: value => run(schema.parse(value)) })
const scalarField = object({ name: id, type: z.enum(['string', 'number', 'integer', 'boolean']), required: z.boolean(), nullable: z.boolean() })
const phase = { name: 'count', type: 'integer', required: true, nullable: false }
const vector = object({ x: signed, y: signed, z: signed })
const pose = { id: 'body', epoch: time, frame: 'ICRS', unit: 'm', vector: { x: 1000, y: 0, z: 0 } }
const body = records({ epoch: utc, frame: z.enum(['ICRS', 'declared-Earth-fixed']), unit: z.enum(['m', 'km']), vector })
const doi = z.string().max(200).regex(/^(?:https:\/\/doi\.org\/)?10\.\d{4,9}\/[A-Za-z0-9._();/:+-]+$/i)
const normalizedDoi = (value: string) => value.replace(/^https:\/\/doi\.org\//i, '').toLowerCase()
export const INFRASTRUCTURE_AUDITS: AuditSpec[] = [
  spec('recovery-manifests-timestamp-order-audit', 'Check supplied result/receipt expiry declarations against original creation and retention windows, including attempted deadline extension. No journal writes or payment recovery is performed.',
    input({ contentRetentionSeconds: seconds, receiptRetentionSeconds: seconds, manifests: records({ createdAt: utc, contentExpiresAt: utc, receiptExpiresAt: utc }) }),
    { contentRetentionSeconds: 86400, receiptRetentionSeconds: 7776000, manifests: [{ id: 'p1', createdAt: time, contentExpiresAt: day1, receiptExpiresAt: day90 }] },
    { contentRetentionSeconds: 86400, receiptRetentionSeconds: 7776000, manifests: [{ id: 'p1', createdAt: time, contentExpiresAt: day90, receiptExpiresAt: day90 }] }, ['content-deadline-mismatch', 'receipt-deadline-mismatch', 'receipt-before-content'], ['checked-manifests'], i => {
      unique(i.manifests.map((r) => r.id)); return { findings: i.manifests.flatMap((r) => [...(Date.parse(r.contentExpiresAt) - Date.parse(r.createdAt) !== i.contentRetentionSeconds * 1000 ? [f('content-deadline-mismatch', r.id)] : []), ...(Date.parse(r.receiptExpiresAt) - Date.parse(r.createdAt) !== i.receiptRetentionSeconds * 1000 ? [f('receipt-deadline-mismatch', r.id)] : []), ...(r.receiptExpiresAt < r.contentExpiresAt ? [f('receipt-before-content', r.id)] : [])]), metrics: [m('checked-manifests', 'cohort', i.manifests.length)] }
    }),
  spec('settlement-receipts-duplicate-record-identities', 'Detect duplicated declared chain/asset/transaction/log-index receipt locators and conflicting amounts. No receipt RPC lookup or claim that ordinary transfers are x402 delivery.',
    input({ receipts: records({ network: z.enum(['eip155:8453', 'eip155:42161', 'eip155:137']), asset, transaction, logIndex: count, amountUnits: cents }) }),
    { receipts: [{ id: 'r1', network: 'eip155:8453', asset: assetExample, transaction: transactionExample, logIndex: 1, amountUnits: '10' }] },
    { receipts: [{ id: 'r1', network: 'eip155:8453', asset: assetExample, transaction: transactionExample, logIndex: 1, amountUnits: '10' }, { id: 'r2', network: 'eip155:8453', asset: assetExample, transaction: transactionExample, logIndex: 1, amountUnits: '10' }] }, ['duplicate-receipt-locator', 'conflicting-receipt-amount'], ['unique-locator-count'], i => {
      unique(i.receipts.map((r) => r.id)); const groups = new Map<string, typeof i.receipts>()
      for (const r of i.receipts) { const key = demandDigest([r.network, r.asset.toLowerCase(), r.transaction.toLowerCase(), r.logIndex]); groups.set(key, [...(groups.get(key) ?? []), r]) }
      return { findings: [...groups.values()].filter(g => g.length > 1).map(g => f(new Set(g.map(r => r.amountUnits)).size > 1 ? 'conflicting-receipt-amount' : 'duplicate-receipt-locator', ...g.map(r => r.id))), metrics: [m('unique-locator-count', 'cohort', groups.size)] }
    }),
  spec('api-contracts-schema-directionality', 'Compare closed scalar API field declarations for request acceptance breaks: new required fields, removed/type-changed fields and loss of nullability. No arbitrary JSON Schema execution or full subtyping claim.',
    input({ before: list(scalarField, 1, 32), after: list(scalarField, 0, 32) }), { before: [phase], after: [phase] },
    { before: [phase], after: [] }, ['field-removed', 'field-type-changed', 'nullability-narrowed', 'new-required-field', 'optional-became-required'], ['breaking-change-count'], i => {
      unique(i.before.map((r) => r.name)); unique(i.after.map((r) => r.name)); const before = new Map(i.before.map((r) => [r.name, r])), after = new Map(i.after.map((r) => [r.name, r])), findings = []
      for (const r of i.before) { const a = after.get(r.name); if (!a) findings.push(f('field-removed', r.name)); else { if (a.type !== r.type && !(r.type === 'integer' && a.type === 'number')) findings.push(f('field-type-changed', r.name)); if (r.nullable && !a.nullable) findings.push(f('nullability-narrowed', r.name)); if (!r.required && a.required) findings.push(f('optional-became-required', r.name)) } }
      for (const r of i.after) if (!before.has(r.name) && r.required) findings.push(f('new-required-field', r.name))
      return { findings, metrics: [m('breaking-change-count', 'contract', findings.length)] }
    }),
  spec('tool-schemas-required-field-coverage', 'Check a supplied tool declaration for required names absent from its closed scalar property list and request examples missing declared required fields. No tool execution or conformance certification.',
    input({ properties: list(scalarField, 1, 32), requiredNames: list(id, 0, 32), exampleNames: list(id, 0, 32) }),
    { properties: [phase], requiredNames: ['count'], exampleNames: ['count'] },
    { properties: [phase], requiredNames: ['count'], exampleNames: [] }, ['required-example-field-missing', 'required-property-undeclared', 'example-field-undeclared'], ['declared-required-count'], i => {
      unique(i.properties.map((r) => r.name)); unique(i.requiredNames); unique(i.exampleNames); const names = new Set(i.properties.map((r) => r.name))
      return { findings: [...i.requiredNames.filter((k: string) => !i.exampleNames.includes(k)).map((k: string) => f('required-example-field-missing', k)), ...i.requiredNames.filter((k: string) => !names.has(k)).map((k: string) => f('required-property-undeclared', k)), ...i.exampleNames.filter((k: string) => !names.has(k)).map((k: string) => f('example-field-undeclared', k))], metrics: [m('declared-required-count', 'tool', i.requiredNames.length)] }
    }),
  spec('tabular-records-unit-label-consistency', 'Compare tabular cell unit labels with a supplied column-unit contract; report mismatched labels and unknown columns without guessing conversions.',
    input({ columns: records({ unit: z.enum(['m', 'mm', 's', 'ms', 'Pa', 'kPa', 'MPa', 'ratio']) }), cells: records({ columnId: id, unit: z.enum(['m', 'mm', 's', 'ms', 'Pa', 'kPa', 'MPa', 'ratio']) }) }),
    { columns: [{ id: 'length', unit: 'mm' }], cells: [{ id: 'cell', columnId: 'length', unit: 'mm' }] },
    { columns: [{ id: 'length', unit: 'mm' }], cells: [{ id: 'cell', columnId: 'length', unit: 'm' }] }, ['cell-unit-label-mismatch', 'column-undeclared'], ['checked-cells'], i => {
      unique(i.columns.map((r) => r.id)); unique(i.cells.map((r) => r.id)); const columns = new Map(i.columns.map((r) => [r.id, r]))
      return { findings: i.cells.flatMap((r) => { const c = columns.get(r.columnId); return !c ? [f('column-undeclared', r.id)] : c.unit !== r.unit ? [f('cell-unit-label-mismatch', r.id)] : [] }), metrics: [m('checked-cells', 'table', i.cells.length)] }
    }),
  spec('package-manifests-identifier-crosswalk-audit', 'Audit caller-supplied npm package/version alias mappings for missing targets and identity/version changes. Does not install packages, download code or scan vulnerabilities.',
    input({ packages: records({ name: id, version: id }), aliases: records({ targetId: id, expectedName: id, expectedVersion: id }) }),
    { packages: [{ id: 'pkg', name: 'example', version: '1.0.0' }], aliases: [{ id: 'alias', targetId: 'pkg', expectedName: 'example', expectedVersion: '1.0.0' }] },
    { packages: [{ id: 'pkg', name: 'example', version: '2.0.0' }], aliases: [{ id: 'alias', targetId: 'pkg', expectedName: 'example', expectedVersion: '1.0.0' }] }, ['package-version-mismatch', 'package-name-mismatch', 'package-target-missing'], ['matching-aliases'], i => {
      unique(i.packages.map((r) => r.id)); unique(i.aliases.map((r) => r.id)); const packages = new Map(i.packages.map((r) => [r.id, r])); let matching = 0
      return { findings: i.aliases.flatMap((r) => { const p = packages.get(r.targetId); if (!p) return [f('package-target-missing', r.id)]; const findings = [...(p.name !== r.expectedName ? [f('package-name-mismatch', r.id)] : []), ...(p.version !== r.expectedVersion ? [f('package-version-mismatch', r.id)] : [])]; if (!findings.length) matching++; return findings }), metrics: [m('matching-aliases', 'manifest', matching)] }
    }),
  spec('robotics-telemetry-record-sequence-diff', 'Compare two declared telemetry-message orders and hashes for added, removed, changed and reordered messages. No live telemetry capture, timing causality or robot control.',
    input({ before: records({ payloadDigest: digest }, 0), after: records({ payloadDigest: digest }, 0) }),
    { before: [{ id: 'm1', payloadDigest: hash }], after: [{ id: 'm1', payloadDigest: hash }] },
    { before: [{ id: 'm1', payloadDigest: hash }], after: [{ id: 'm1', payloadDigest: 'sha256:' + 'b'.repeat(64) }] }, ['message-content-changed', 'message-added', 'message-removed', 'message-order-changed'], ['matching-id-count'], i => {
      unique(i.before.map((r) => r.id)); unique(i.after.map((r) => r.id)); const before = new Map(i.before.map((r) => [r.id, r])), after = new Map(i.after.map((r) => [r.id, r])), findings = []
      for (const r of i.before) { const a = after.get(r.id); if (!a) findings.push(f('message-removed', r.id)); else if (a.payloadDigest !== r.payloadDigest) findings.push(f('message-content-changed', r.id)) }
      for (const r of i.after) if (!before.has(r.id)) findings.push(f('message-added', r.id))
      const b = i.before.filter((r) => after.has(r.id)).map((r) => r.id), a = i.after.filter((r) => before.has(r.id)).map((r) => r.id)
      if (demandDigest(a) !== demandDigest(b)) findings.push(f('message-order-changed', ...b))
      return { findings, metrics: [m('matching-id-count', 'stream', b.length)] }
    }),
  spec('neural-interface-records-source-coverage-map', 'Check declared neural feature metadata against supplied source-artifact digests and pipeline revisions. No raw EEG, participant identifiers, model training or human-performance claim.',
    input({ expectedPipelineRevision: digest, sources: records({ artifactDigest: digest }, 0), features: records({ sourceId: id, sourceDigest: digest, pipelineRevision: digest }) }),
    { expectedPipelineRevision: hash, sources: [{ id: 's1', artifactDigest: hash }], features: [{ id: 'f1', sourceId: 's1', sourceDigest: hash, pipelineRevision: hash }] },
    { expectedPipelineRevision: hash, sources: [], features: [{ id: 'f1', sourceId: 's1', sourceDigest: hash, pipelineRevision: hash }] }, ['feature-source-missing', 'feature-source-digest-mismatch', 'pipeline-revision-mismatch'], ['bound-feature-count'], i => {
      unique(i.sources.map((r) => r.id)); unique(i.features.map((r) => r.id)); const sources = new Map(i.sources.map((r) => [r.id, r])); let bound = 0
      return { findings: i.features.flatMap((r) => { const s = sources.get(r.sourceId); const issues = [...(!s ? [f('feature-source-missing', r.id)] : s.artifactDigest !== r.sourceDigest ? [f('feature-source-digest-mismatch', r.id)] : []), ...(r.pipelineRevision !== i.expectedPipelineRevision ? [f('pipeline-revision-mismatch', r.id)] : [])]; if (!issues.length) bound++; return issues }), metrics: [m('bound-feature-count', 'cohort', bound)] }
    }),
  spec('ephemeris-snapshots-export-semantic-parity', 'Compare supplied fixed-epoch position exports by exact integer metre scaling, preserving declared coordinate frames. No ephemeris query, frame rotation or celestial prediction.',
    input({ before: body, after: body }), { before: [pose], after: [{ ...pose, unit: 'km', vector: { x: 1, y: 0, z: 0 } }] },
    { before: [pose], after: [{ ...pose, frame: 'declared-Earth-fixed' }] }, ['position-frame-mismatch', 'position-value-mismatch', 'position-record-missing'], ['comparable-position-count'], i => {
      unique(i.before.map((r) => r.id)); unique(i.after.map((r) => r.id)); const a = new Map(i.after.map((r) => [r.id, r])); let comparable = 0; const findings = []
      for (const r of i.before) { const v = a.get(r.id); if (!v) findings.push(f('position-record-missing', r.id)); else if (r.epoch !== v.epoch || r.frame !== v.frame) findings.push(f('position-frame-mismatch', r.id)); else { comparable++; if ((['x', 'y', 'z'] as const).some(k => BigInt(r.vector[k]) * BigInt(r.unit === 'km' ? 1000 : 1) !== BigInt(v.vector[k]) * BigInt(v.unit === 'km' ? 1000 : 1))) findings.push(f('position-value-mismatch', r.id)) } }
      for (const r of i.after) if (!i.before.some((b) => b.id === r.id)) findings.push(f('position-record-missing', r.id))
      return { findings, metrics: [m('comparable-position-count', 'snapshot', comparable)] }
    }),
  spec('bibliographies-identifier-crosswalk-audit', 'Normalize supplied DOI URL/bare-ID aliases and check declared title-digest consistency. No DOI resolution, source reading or claim support assessment.',
    input({ entries: records({ doi, titleDigest: digest }) }), { entries: [{ id: 'b1', doi: '10.1234/Example', titleDigest: hash }, { id: 'b2', doi: 'https://doi.org/10.1234/example', titleDigest: hash }] },
    { entries: [{ id: 'b1', doi: '10.1234/Example', titleDigest: hash }, { id: 'b2', doi: 'https://doi.org/10.1234/example', titleDigest: 'sha256:' + 'b'.repeat(64) }] }, ['doi-alias-title-conflict'], ['normalized-doi-count'], i => {
      unique(i.entries.map((r) => r.id)); const groups = new Map<string, typeof i.entries>()
      for (const r of i.entries) { const key = normalizedDoi(r.doi); groups.set(key, [...(groups.get(key) ?? []), r]) }
      return { findings: [...groups.values()].filter(g => new Set(g.map(r => r.titleDigest)).size > 1).map(g => f('doi-alias-title-conflict', ...g.map(r => r.id))), metrics: [m('normalized-doi-count', 'bibliography', groups.size)] }
    }),
  spec('reading-plans-reference-integrity-map', 'Verify supplied reading-plan unit references against declared edition/section manifests. No book text, licensing grant, availability check or manuscript lookup.',
    input({ units: records({ editionDigest: digest }, 0), plan: records({ unitId: id, editionDigest: digest }) }),
    { units: [{ id: 'unit1', editionDigest: hash }], plan: [{ id: 'step1', unitId: 'unit1', editionDigest: hash }] },
    { units: [], plan: [{ id: 'step1', unitId: 'unit1', editionDigest: hash }] }, ['reading-unit-missing', 'reading-edition-mismatch'], ['bound-reading-steps'], i => {
      unique(i.units.map((r) => r.id)); unique(i.plan.map((r) => r.id)); const units = new Map(i.units.map((r) => [r.id, r])); let bound = 0
      return { findings: i.plan.flatMap((r) => { const u = units.get(r.unitId); if (!u) return [f('reading-unit-missing', r.id)]; if (u.editionDigest !== r.editionDigest) return [f('reading-edition-mismatch', r.id)]; bound++; return [] }), metrics: [m('bound-reading-steps', 'plan', bound)] }
    }),
  spec('grant-records-declared-bound-audit', 'Compare a supplied public/synthetic grant budget with declared line, duration and total ceilings using exact minor units. No funding forecast, eligibility verdict or application submission.',
    input({ months: count, maximumMonths: count, maximumTotalMinor: cents, maximumLineMinor: cents, currency: z.enum(['USD', 'EUR', 'LKR']), lines: records({ amountMinor: cents }) }),
    { months: 9, maximumMonths: 12, maximumTotalMinor: '6000000', maximumLineMinor: '4000000', currency: 'USD', lines: [{ id: 'research', amountMinor: '3000000' }] },
    { months: 9, maximumMonths: 12, maximumTotalMinor: '2000000', maximumLineMinor: '4000000', currency: 'USD', lines: [{ id: 'research', amountMinor: '3000000' }] }, ['grant-total-exceeds-bound', 'grant-line-exceeds-bound', 'grant-duration-exceeds-bound'], ['total-minor'], i => {
      unique(i.lines.map((r) => r.id)); const total = i.lines.reduce((n: bigint, r) => n + BigInt(r.amountMinor), BigInt(0))
      return { findings: [...(total > BigInt(i.maximumTotalMinor) ? [f('grant-total-exceeds-bound', 'budget')] : []), ...i.lines.filter((r) => BigInt(r.amountMinor) > BigInt(i.maximumLineMinor)).map((r) => f('grant-line-exceeds-bound', r.id)), ...(i.months > i.maximumMonths ? [f('grant-duration-exceeds-bound', 'budget')] : [])], metrics: [m('total-minor', 'budget', total)] }
    }),
  spec('scientific-dataset-records-missingness-cooccurrence', 'Count joint absence of source, method and unit declarations in public/synthetic dataset metadata. No raw specimen data, imputation or scientific validity determination.',
    input({ records: records({ sourceId: id.nullable(), method: id.nullable(), unit: id.nullable() }) }),
    { records: [{ id: 'd1', sourceId: 's1', method: 'measurement', unit: 'mm' }] },
    { records: [{ id: 'd1', sourceId: null, method: null, unit: 'mm' }] }, ['dataset-joint-missingness'], ['source-method-null-pairs', 'source-unit-null-pairs', 'method-unit-null-pairs'], i => {
      unique(i.records.map((r) => r.id)); const pairs = [['sourceId', 'method', 'source-method-null-pairs'], ['sourceId', 'unit', 'source-unit-null-pairs'], ['method', 'unit', 'method-unit-null-pairs']] as const
      return { findings: i.records.filter((r) => (['sourceId', 'method', 'unit'] as const).filter(k => r[k] === null).length >= 2).map((r) => f('dataset-joint-missingness', r.id)), metrics: pairs.map(([a, b, key]) => m(key, 'cohort', i.records.filter((r) => r[a] === null && r[b] === null).length)) }
    }),
  spec('license-records-condition-coverage-map', 'Compare declared license-condition checklists with supplied fulfilled/unfulfilled/unknown evidence labels. Does not interpret law, grant permissions or certify license compliance.',
    input({ requiredConditions: list(id, 1, 32), evidence: records({ conditionId: id, status: z.enum(['fulfilled', 'unfulfilled', 'unknown']), sourceRevision: digest }) }),
    { requiredConditions: ['attribution'], evidence: [{ id: 'e1', conditionId: 'attribution', status: 'fulfilled', sourceRevision: hash }] },
    { requiredConditions: ['attribution'], evidence: [{ id: 'e1', conditionId: 'attribution', status: 'unknown', sourceRevision: hash }] }, ['license-condition-undetermined', 'license-condition-unfulfilled', 'license-condition-missing', 'license-condition-conflicting'], ['declared-fulfilled-count'], i => {
      unique(i.requiredConditions); unique(i.evidence.map((r) => r.id)); const findings = []; let fulfilled = 0
      for (const c of i.requiredConditions) { const values = new Set(i.evidence.filter((r) => r.conditionId === c).map((r) => r.status)); if (!values.size) findings.push(f('license-condition-missing', c)); else if (values.size > 1) findings.push(f('license-condition-conflicting', c)); else if (values.has('unknown')) findings.push(f('license-condition-undetermined', c)); else if (values.has('unfulfilled')) findings.push(f('license-condition-unfulfilled', c)); else fulfilled++ }
      return { findings, metrics: [m('declared-fulfilled-count', 'license', fulfilled)] }
    }),
]

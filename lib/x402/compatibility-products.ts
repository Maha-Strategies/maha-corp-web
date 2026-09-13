import { CELESTIAL_VOCABULARY, type CompatibilityId } from './compatibility-contracts.ts'
import { microDigest } from './micro-products.ts'

type Row = Record<string, unknown>
type Issue = { ruleId: string; field: string; explanation: string; neededNext: string }
const text = (v: unknown): string | null => typeof v === 'string' && v.trim() && !['unknown', 'unspecified', 'not-provided', 'n/a'].includes(v.trim().toLowerCase()) ? v : null
const get = (r: Row, path: string): unknown => path.split('.').reduce<unknown>((v, k) => v && typeof v === 'object' ? (v as Row)[k] : undefined, r)
const issue = (ruleId: string, field: string, explanation: string, neededNext: string): Issue => ({ ruleId, field, explanation, neededNext })
export const CELESTIAL_RULE_SET = {
  version: 'maha-celestial-compatibility/0.1-draft', vocabulary: CELESTIAL_VOCABULARY,
  numericBounds: { julianDay: [0, 5000000], longitudeDeg: [-180, 180], latitudeDeg: [-90, 90], heightMeters: [-12000, 100000] },
  observerProfile: { datum: 'WGS84', latitudeType: 'geodetic', heightReference: 'ellipsoidal' },
  ayanamsaProfile: 'Exact caller-pinned modelId and definitionVersion, not independently resolved or verified.',
  comparisonBoundary: 'Only this declared profile is compared. Equal labels do not prove equal hidden settings, numerically equal outputs or correct computation.',
  rules: {
    'C-DECLARED': 'Compare explicit supported scalar declarations; missing and unsupported labels remain unresolved.',
    'C-DECIMAL': 'Compare bounded decimal declarations exactly after removing insignificant zeros; no physical conversion.',
    'C-OBSERVER': 'Observer is required for either topocentric result or house cusps: WGS84, geodetic latitude, ellipsoidal metre height.',
    'C-SIDEREAL': 'Either sidereal declaration requires ayanamsa modelId and definitionVersion on both sides. No alias resolution.',
    'C-KIND': 'Body, lunar-node and house-cusp kinds must agree with target and applicability fields.',
    'C-APPLICABILITY': 'Equatorial declarations require zodiac not-applicable. Ecliptic declarations require tropical or sidereal.',
    'C-PRECEDENCE': 'An explicit difference or contradiction establishes incompatible declarations even when other information is missing; otherwise any unresolved prerequisite prevents compatibility.',
  },
}
const decimalKey = (v: string) => {
  const [whole, fraction = ''] = v.split('.')
  const tail = fraction.replace(/0+$/, '')
  const normalized = tail ? `${whole}.${tail}` : whole
  return normalized === '-0' ? '0' : normalized
}

export function celestialCompatibility(input: Row): Row {
  const left = input.left as Row, right = input.right as Row
  const fields: { field: string; left: string | null; right: string | null; state: string; ruleId: string }[] = []
  const issues: Issue[] = [], missing = new Set<string>()
  let mismatch = false
  const check = (field: string, options?: readonly string[], numeric = false, applicable = true) => {
    const l = text(get(left, field)), r = text(get(right, field)), ruleId = numeric ? 'C-DECIMAL' : 'C-DECLARED'
    let state = 'not-applicable'
    if (applicable) {
      const valid = (v: string | null) => Boolean(v && (!options || options.includes(v)) && (!field.startsWith('ayanamsa.') || !['none', 'not-applicable'].includes(v.trim().toLowerCase())))
      if (!valid(l) || !valid(r)) {
        state = 'missing-or-unsupported'
        for (const [side, value] of [['left', l], ['right', r]] as const) if (!valid(value)) missing.add(`${side}.${field}`)
        issues.push(issue(ruleId, field, 'A required declaration is missing or outside the supported vocabulary.', 'Supply both explicit declarations using this rule-set vocabulary; do not infer a default.'))
      } else if ((numeric ? decimalKey(l!) : l) !== (numeric ? decimalKey(r!) : r)) {
        state = 'different'; mismatch = true
        issues.push(issue(ruleId, field, 'The declared values differ; no conversion or equivalence mapping was attempted.', 'Reconcile this convention explicitly before comparing calculated values.'))
      } else state = 'match'
    }
    fields.push({ field, left: l, right: r, state, ruleId })
  }
  for (const [field, vocabulary] of Object.entries(CELESTIAL_VOCABULARY)) check(field, vocabulary)
  check('julianDay', undefined, true)
  const needsObserver = [left, right].some(r => r.origin === 'topocentric' || r.resultKind === 'house-cusps')
  for (const field of ['longitudeDeg', 'latitudeDeg', 'heightMeters']) check(`observer.${field}`, undefined, true, needsObserver)
  check('observer.datum', ['WGS84'], false, needsObserver)
  check('observer.latitudeType', ['geodetic'], false, needsObserver)
  check('observer.heightReference', ['ellipsoidal'], false, needsObserver)
  const sidereal = [left, right].some(r => r.zodiac === 'sidereal')
  for (const field of ['modelId', 'definitionVersion']) check(`ayanamsa.${field}`, undefined, false, sidereal)
  for (const [side, row] of [['left', left], ['right', right]] as const) {
    for (const [path, min, max] of [['julianDay', 0, 5000000], ['observer.longitudeDeg', -180, 180], ['observer.latitudeDeg', -90, 90], ['observer.heightMeters', -12000, 100000]] as const) {
      const v = get(row, path)
      if (v != null && (Number(v) < min || Number(v) > max)) throw new Error('out-of-bounds-coordinate')
    }
    const contradict = (field: string, explanation: string) => { mismatch = true; issues.push(issue('C-KIND', `${side}.${field}`, explanation, 'Correct the internally inconsistent declaration; this service will not choose a setting.')) }
    if (row.resultKind === 'body-position' && ['lunar-node', 'house-cusps'].includes(String(row.targetBody))) contradict('targetBody', 'Body-position kind cannot describe a node or house-cusp target.')
    if (row.resultKind === 'lunar-node-position') {
      if (text(row.targetBody) && row.targetBody !== 'lunar-node' && CELESTIAL_VOCABULARY.targetBody.includes(row.targetBody as never)) contradict('targetBody', 'Lunar-node kind requires the lunar-node target.')
      if (row.nodeConvention === 'not-applicable') contradict('nodeConvention', 'Lunar nodes require an explicit mean or true convention.')
    } else if (['body-position', 'house-cusps'].includes(String(row.resultKind)) && ['mean', 'true'].includes(String(row.nodeConvention))) contradict('nodeConvention', 'A node convention was declared for a non-node result.')
    if (row.resultKind === 'house-cusps') {
      if (text(row.targetBody) && row.targetBody !== 'house-cusps' && CELESTIAL_VOCABULARY.targetBody.includes(row.targetBody as never)) contradict('targetBody', 'House-cusp kind requires a house-cusp target.')
      if (row.houseSystem === 'not-applicable') contradict('houseSystem', 'House cusps require a house system.')
      if (['apparent', 'geometric'].includes(String(row.positionConvention))) contradict('positionConvention', 'This rule set requires not-applicable for house-cusp positionConvention.')
      if (row.coordinateFrame === 'equatorial') contradict('coordinateFrame', 'This rule set supports house cusps in ecliptic coordinates only.')
    } else if (['body-position', 'lunar-node-position'].includes(String(row.resultKind))) {
      if (CELESTIAL_VOCABULARY.houseSystem.filter(v => v !== 'not-applicable').includes(row.houseSystem as never)) contradict('houseSystem', 'A house system was declared for a non-house result.')
      if (row.positionConvention === 'not-applicable') contradict('positionConvention', 'Position results require apparent or geometric convention.')
    }
    if ((row.coordinateFrame === 'equatorial' && ['tropical', 'sidereal'].includes(String(row.zodiac))) || (row.coordinateFrame === 'ecliptic' && row.zodiac === 'not-applicable')) contradict('zodiac', 'The zodiac applicability contradicts the coordinate frame.')
    if (row.zodiac !== 'sidereal' && ['tropical', 'not-applicable'].includes(String(row.zodiac)) && row.ayanamsa != null) contradict('ayanamsa', 'An ayanamsa was supplied for a non-sidereal declaration.')
  }
  return { ruleSetVersion: CELESTIAL_RULE_SET.version, ruleSetDigest: microDigest(CELESTIAL_RULE_SET),
    state: mismatch ? 'incompatible-declared-conventions' : missing.size ? 'insufficient-information' : 'compatible-declared-conventions',
    fields, issues, missingPrerequisites: [...missing].sort(), calculationsVerified: false, conventionsInferred: false, conversionPerformed: false, predictionValidated: false }
}

export const EVIDENCE_RULE_SET = {
  version: 'maha-evidence-frame-compatibility/0.1-draft',
  allow: [
    { id: 'E-PERFORMANCE', claim: 'independent-performance', evidence: 'empirical-measurement', roles: ['independent-evaluator'], next: 'Independent measurements of the declared system, version, conditions and outcome.' },
    { id: 'E-WORDING', claim: 'original-wording', evidence: 'primary-text', roles: ['primary-text'], next: 'Located primary wording in the exact declared edition.' },
    { id: 'E-EDITION', claim: 'original-wording', evidence: 'critical-edition', roles: ['primary-text'], next: 'A located critical-edition passage with the same explicit edition identifier.' },
    { id: 'E-HISTORY', claim: 'historical-occurrence', evidence: 'empirical-measurement', roles: ['empirical-observer', 'independent-evaluator'], next: 'Event-relevant observations with explicit temporal coverage and source locator.' },
    { id: 'E-PHYSICAL', claim: 'physical-model-validation', evidence: 'empirical-measurement', roles: ['empirical-observer', 'independent-evaluator'], next: 'Empirical comparison for the declared model, conditions and outcome; mathematical consistency alone is insufficient.' },
    { id: 'E-VENDOR-ATTRIBUTION', claim: 'vendor-stated-position', evidence: 'vendor-brochure', roles: ['vendor'], next: 'A located vendor statement attributed to that vendor, not called independently validated.' },
    { id: 'E-MATH', claim: 'mathematical-identity', evidence: 'mathematical-proof', roles: ['mathematical-derivation'], next: 'A derivation in the declared mathematical assumptions and domain.' },
    { id: 'E-TRADITION', claim: 'tradition-stated-authority', evidence: 'religious-tradition', roles: ['religious-authority'], next: 'A located statement within the same explicitly declared tradition; no historical corroboration implied.' },
  ],
  deny: [
    { id: 'E-VENDOR-NOT-INDEPENDENT', claim: 'independent-performance', evidence: 'vendor-brochure', explanation: 'A vendor brochure is not independent performance evidence.', next: 'Independent measurements of the same system, version, conditions and outcome.' },
    { id: 'E-COMMENTARY-NOT-ORIGINAL', claim: 'original-wording', evidence: 'later-commentary', explanation: 'Later commentary does not itself establish the original wording.', next: 'A located primary text or critical edition with the requested edition binding.' },
    { id: 'E-AUTHORITY-NOT-HISTORY', claim: 'historical-occurrence', evidence: 'religious-tradition', explanation: 'Religious authority does not by itself establish historical occurrence.', next: 'Independent, event-relevant historical or empirical evidence, with dates and locators.' },
    { id: 'E-IDENTITY-NOT-PHYSICS', claim: 'physical-model-validation', evidence: 'mathematical-proof', explanation: 'A mathematical derivation does not empirically validate a physical model.', next: 'Empirical measurements and comparison conditions for the declared physical model.' },
  ],
  common: 'Require source identity, locator, equal explicit scopes, claimAsOfDate and evidencePublishedDate. Evidence published after the declared as-of date is unavailable for that assertion. Wording requires equal editions; historical occurrence requires eventDate within explicit coverage. Unknown pairings or roles never pass. A known failed rule takes precedence while all missing prerequisites remain reported.',
}
const validDate = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v) && Number.isFinite(Date.parse(v + 'T00:00:00Z')) && new Date(v + 'T00:00:00Z').toISOString().slice(0, 10) === v
export function evidenceFrameCompatibility(input: Row): Row {
  const rows = input.pairs as Row[]
  const ids = rows.map(r => text(r.pairId)).filter(v => v !== null)
  if (ids.length !== new Set(ids).size) throw new Error('duplicate-pair-id')
  const pairs = rows.map((row, index) => {
    for (const key of ['claimAsOfDate', 'evidencePublishedDate', 'eventDate', 'coverageStart', 'coverageEnd']) if (row[key] != null && !validDate(String(row[key]))) throw new Error('invalid-calendar-date')
    const issues: Issue[] = []; let failed = false, unresolved = false
    const missing = (field: string) => { unresolved = true; issues.push(issue('E-REQUIRED', field, 'Required information is missing.', `Supply an explicit ${field}; no value is inferred.`)) }
    for (const field of ['claimType', 'evidenceType', 'sourceRole', 'claimScope', 'evidenceScope', 'sourceId', 'locator', 'claimAsOfDate', 'evidencePublishedDate']) if (!text(row[field])) missing(field)
    const fail = (id: string, field: string, explanation: string, next: string) => { failed = true; issues.push(issue(id, field, explanation, next)) }
    const deny = EVIDENCE_RULE_SET.deny.find(r => r.claim === row.claimType && r.evidence === row.evidenceType)
    const allow = EVIDENCE_RULE_SET.allow.find(r => r.claim === row.claimType && r.evidence === row.evidenceType && r.roles.includes(String(row.sourceRole)))
    if (deny) fail(deny.id, 'evidenceType', deny.explanation, deny.next)
    else if (row.claimType === 'independent-performance' && row.sourceRole === 'vendor') fail('E-INDEPENDENCE', 'sourceRole', 'Vendor-supplied evidence does not establish the requested independence.', 'Supply a separately identified independent evaluator and its measurements.')
    else if (!allow) { unresolved = true; issues.push(issue('E-UNMAPPED', 'claimType/evidenceType/sourceRole', 'No configured allow rule covers this declared combination.', 'Obtain a reviewed rule or inspect the evidence relationship manually; unknown does not mean false.')) }
    if (text(row.claimScope) && text(row.evidenceScope) && row.claimScope !== row.evidenceScope) fail('E-SCOPE', 'evidenceScope', 'Declared scopes differ; containment or equivalence was not inferred.', 'Supply evidence explicitly scoped to the assertion, or document a separately reviewed scope mapping.')
    if (text(row.claimAsOfDate) && text(row.evidencePublishedDate) && String(row.evidencePublishedDate) > String(row.claimAsOfDate)) fail('E-AS-OF', 'evidencePublishedDate', 'Evidence was published after the assertion as-of date.', 'Use evidence available by that date or explicitly change the assertion as-of date.')
    if (row.claimType === 'original-wording') {
      for (const field of ['claimEdition', 'evidenceEdition']) if (!text(row[field])) missing(field)
      if (text(row.claimEdition) && text(row.evidenceEdition) && row.claimEdition !== row.evidenceEdition) fail('E-EDITION-BINDING', 'evidenceEdition', 'Declared editions do not match.', 'Locate the wording in the claimed edition; edition conversion is not performed.')
    }
    if (row.claimType === 'historical-occurrence') {
      for (const field of ['eventDate', 'coverageStart', 'coverageEnd']) if (!text(row[field])) missing(field)
      if (text(row.coverageStart) && text(row.coverageEnd) && String(row.coverageStart) > String(row.coverageEnd)) throw new Error('reversed-coverage')
      if (['eventDate', 'coverageStart', 'coverageEnd'].every(k => text(row[k])) && (String(row.eventDate) < String(row.coverageStart) || String(row.eventDate) > String(row.coverageEnd))) fail('E-EVENT-COVERAGE', 'eventDate', 'Declared evidence coverage excludes the claimed event date.', 'Supply event-relevant coverage; a later publication date alone does not disqualify retrospective evidence.')
    }
    if (allow && !failed && !unresolved) issues.push(issue(allow.id, 'declared-frame', 'The declared evidence category is potentially appropriate. Content and truth were not checked.', allow.next))
    return { index, pairId: text(row.pairId), state: failed ? 'frame-transfer-not-justified' : unresolved ? 'required-information-missing' : 'declared-frames-compatible', issues, matchedRuleId: deny?.id ?? allow?.id ?? null }
  })
  return { ruleSetVersion: EVIDENCE_RULE_SET.version, ruleSetDigest: microDigest(EVIDENCE_RULE_SET), pairs, arbitraryProseRead: false, sourcesInspected: false, assertionsVerified: false }
}
export const buildCompatibilityProduct = (id: CompatibilityId, input: Row): Row => id === 'celestial-result-compatibility' ? celestialCompatibility(input) : evidenceFrameCompatibility(input)

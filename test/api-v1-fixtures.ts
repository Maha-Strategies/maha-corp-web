export const CLOCK = Date.parse('2026-10-13T10:00:00Z')
export const GROWTH_INPUTS = {
  'catalogue-price-unit-audit': { dataClass: 'synthetic', quotes: [{ id: 'quote', network: 'eip155:8453', asset: '0x' + '1'.repeat(40), amount: '10000' }], assetMetadata: [] },
  'dataset-null-pattern-audit': { dataClass: 'synthetic', columns: ['x'], rows: [{ x: 0 }, { x: null }, {}] },
  'dataset-key-integrity': { dataClass: 'synthetic', keyFields: ['id'], rows: [{ id: 1 }, { id: 1 }] },
  'dataset-join-loss-preview': { dataClass: 'synthetic', keyFields: ['id'], left: [{ id: 1 }], right: [{ id: 1 }, { id: 2 }] },
  'dataset-schema-evolution-plan': { dataClass: 'synthetic', before: [{ name: 'x', type: 'integer', required: false, nullable: true, unit: 'm' }], after: [{ name: 'x', type: 'number', required: false, nullable: true, unit: 'm' }], rejectExtraFields: true },
  'dataset-export-roundtrip-check': { dataClass: 'synthetic', before: [{ x: 1 }], after: [{ x: '1' }] },
} as const
export const DOI = '10.1234/example'
export const work = { DOI, title: ['<b>Synthetic public title</b>'], publisher: 'Fixture publisher', type: 'journal-article',
  published: { 'date-parts': [[2026, 2, 30]] }, indexed: { 'date-time': '2026-10-12T00:00:00Z' },
  abstract: 'EXCLUDED_ABSTRACT', author: [{ given: 'EXCLUDED_PERSON' }], relation: { 'is-supplemented-by': [{ id: '10.1234/data', 'id-type': 'doi' }] },
  funder: [{ name: 'Fixture funder', DOI: '10.13039/000000001', award: ['PUBLIC_AWARD'] }] }
export const read = async (url: string) => ({ status: 200, durationMs: 1, headers: { 'content-type': 'application/json' }, body: JSON.stringify(url.includes('clinicaltrials.gov')
  ? { protocolSection: { identificationModule: { nctId: 'NCT00000001' }, statusModule: { overallStatus: 'COMPLETED', lastUpdatePostDateStruct: { date: '2026-10-12' } }, contactsLocationsModule: { phone: 'EXCLUDED_CONTACT' } } }
  : url.includes('?') ? { status: 'ok', message: { 'total-results': 0, items: [] } } : { status: 'ok', 'message-type': 'work', message: work }) })

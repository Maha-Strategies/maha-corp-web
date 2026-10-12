import type { DemandInput } from './contracts.ts'
type Finding = { row: number; column: number; code: string }
export function csvPreflight(input: DemandInput<'csv-import-preflight'>) {
  const records: string[][] = [], findings: Finding[] = []
  let truncated = false, row: string[] = [], field = '', state: 'plain' | 'quoted' | 'closed' = 'plain'
  const add = (code: string, rowNumber: number, column: number) => { if (findings.length < 300) findings.push({ row: rowNumber, column, code }); else truncated = true }
  const finishField = () => { if (field.length > 1000 || row.length >= 64) throw new Error('csv_work_bound'); row.push(field); field = ''; state = 'plain' }
  const finishRow = () => { finishField(); records.push(row); row = []; if (records.length > 501) throw new Error('csv_work_bound') }
  const csv = input.csv.replace(/^\uFEFF/, '')
  if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(csv)) throw new Error('invalid_csv_controls')
  for (let i = 0; i < csv.length; i++) {
    const ch = csv[i]
    if (state === 'quoted') {
      if (ch === '"' && csv[i + 1] === '"') { field += '"'; i++ }
      else if (ch === '"') state = 'closed'
      else field += ch
    } else if (ch === input.delimiter) finishField()
    else if (ch === '\n' || ch === '\r') { if (ch === '\r' && csv[i + 1] === '\n') i++; finishRow() }
    else if (ch === '"' && state === 'plain' && !field.length) state = 'quoted'
    else { if (ch === '"' || state === 'closed') add('malformed_quoting', records.length + 1, row.length + 1); field += ch }
    if (field.length > 1000) throw new Error('csv_work_bound')
  }
  if (state === 'quoted') add('unclosed_quote', records.length + 1, row.length + 1)
  if (field.length || row.length || state !== 'plain') finishRow()
  const headers = records.shift() ?? []
  if (!headers.length) add('missing_header', 0, 0)
  const seen = new Set<string>()
  headers.forEach((name, i) => { if (!name.trim()) add('empty_header', 0, i + 1); if (seen.has(name)) add('duplicate_header', 0, i + 1); seen.add(name) })
  for (const [i, col] of input.columns.entries()) if (!headers.includes(col.name)) add('declared_column_missing', 0, i + 1)
  for (const [i, name] of headers.entries()) if (!input.columns.some(c => c.name === name)) add('undeclared_column', 0, i + 1)
  for (const [r, values] of records.entries()) {
    if (values.length !== headers.length) add('inconsistent_column_count', r + 1, 0)
    for (const [c, value] of values.entries()) {
      if (/^\s*[=+@-]/.test(value)) add('spreadsheet_formula_prefix', r + 1, c + 1)
      const declared = input.columns.find(x => x.name === headers[c])
      if (!declared) continue
      if (!value.length) { if (declared.required) add('required_value_missing', r + 1, c + 1); continue }
      const valid = declared.type === 'string' || (declared.type === 'integer' ? /^-?(0|[1-9]\d{0,17})$/.test(value)
        : declared.type === 'number' ? /^-?(?:0|[1-9]\d{0,17})(?:\.\d{1,18})?(?:[eE][+-]?\d{1,2})?$/.test(value) && Number.isFinite(Number(value))
        : declared.type === 'boolean' ? /^(true|false)$/.test(value)
        : /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value)
      if (!valid) add('declared_type_mismatch', r + 1, c + 1)
    }
  }
  return { recordsChecked: records.length, columnsObserved: headers.length, findings, findingsTruncated: truncated,
    readyUnderDeclaredSchema: !findings.length && !truncated, cellsExecuted: false as const }
}

export function validGtin(value: string): boolean {
  if (!/^(?:\d{8}|\d{12}|\d{13}|\d{14})$/.test(value)) return false
  let sum = 0
  for (let i = value.length - 2, position = 0; i >= 0; i--, position++) sum += Number(value[i]) * (position % 2 === 0 ? 3 : 1)
  return (10 - sum % 10) % 10 === Number(value.at(-1))
}
export function cataloguePreflight(input: DemandInput<'product-catalogue-preflight'>) {
  const findings: Finding[] = [], skus = new Set<string>()
  let truncated = false
  const add = (row: number, column: number, code: string) => { if (findings.length < 300) findings.push({ row, column, code }); else truncated = true }
  for (const [i, product] of input.products.entries()) {
    if (skus.has(product.sku)) add(i + 1, 1, 'duplicate_sku')
    skus.add(product.sku)
    if (!/^(0|[1-9]\d{0,15})(?:\.\d{1,2})?$/.test(product.price) || !/[1-9]/.test(product.price)) add(i + 1, 2, 'price_not_positive_decimal')
    if (!/^[A-Z]{3}$/.test(product.currency)) add(i + 1, 3, 'currency_code_shape_invalid')
    if (input.expectedCurrency !== null && product.currency !== input.expectedCurrency) add(i + 1, 3, 'currency_differs_from_declared_feed_currency')
    if (product.gtin !== null && !validGtin(product.gtin)) add(i + 1, 4, 'invalid_gtin_check_digit_or_length')
  }
  return { recordsChecked: input.products.length, findings, findingsTruncated: truncated, structurallyValid: !findings.length && !truncated, marketplaceApprovalEstablished: false as const }
}

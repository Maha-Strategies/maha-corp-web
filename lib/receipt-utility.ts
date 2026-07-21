// Receipt → clean CSV micro-utility. The free demo parses ONE pasted receipt;
// it doubles as the qualifier (behavioral intent) and the pre-flight
// feasibility check (garbage in → `feasible: false` BEFORE anyone pays).
// No input is ever persisted — the text goes to the model and the result comes
// back; only counts/hashes are logged.

export const RECEIPT_UTILITY = 'receipts-to-csv' as const
export const MAX_RECEIPT_CHARS = 8_000
export const MIN_RECEIPT_CHARS = 12
export const MAX_BATCH_RECEIPTS = 20

export class ReceiptUtilityError extends Error {
  readonly status: number
  constructor(message: string, status = 400) {
    super(message)
    this.name = 'ReceiptUtilityError'
    this.status = status
  }
}

export type ReceiptLineItem = {
  description: string
  quantity: number | null
  unitPrice: number | null
  amount: number | null
  category: string
}

export type ParsedReceipt = {
  feasible: boolean
  confidence: number
  note: string
  merchant: string | null
  purchasedAt: string | null
  currency: string | null
  subtotal: number | null
  tax: number | null
  total: number | null
  lineItems: ReceiptLineItem[]
}

export type ReceiptRunner = (prompt: string) => Promise<string>

export function validateReceiptText(value: unknown): string {
  if (typeof value !== 'string') throw new ReceiptUtilityError('Paste the text of a receipt to parse.')
  const text = value.trim()
  if (text.length < MIN_RECEIPT_CHARS) throw new ReceiptUtilityError('That is too short to be a receipt.')
  if (text.length > MAX_RECEIPT_CHARS) throw new ReceiptUtilityError(`Receipt text exceeds the ${MAX_RECEIPT_CHARS.toLocaleString()}-character free-demo limit.`, 413)
  return text
}

export function buildReceiptPrompt(text: string): string {
  return [
    'You convert one raw, messy receipt into structured accounting data.',
    'Return ONLY a JSON object (no prose, no code fence) with this exact shape:',
    '{',
    '  "feasible": boolean,        // false if the text is not actually a receipt/invoice',
    '  "confidence": number,       // 0..1, your confidence in the extraction',
    '  "note": string,             // one short sentence; if not feasible, say why',
    '  "merchant": string|null,',
    '  "purchasedAt": string|null, // ISO 8601 date if determinable, else null',
    '  "currency": string|null,    // ISO 4217 code, e.g. "USD"',
    '  "subtotal": number|null, "tax": number|null, "total": number|null,',
    '  "lineItems": [ { "description": string, "quantity": number|null, "unitPrice": number|null, "amount": number|null, "category": string } ]',
    '}',
    'Rules: amounts are plain numbers (no currency symbols). If the input is not a receipt, set feasible=false, confidence low, lineItems=[]. Never invent line items that are not present.',
    '',
    'RECEIPT:',
    text,
  ].join('\n')
}

// Instruction text paired with an image block for the vision model. Same output
// contract as buildReceiptPrompt, so parseReceiptResponse handles both modalities.
export function buildReceiptImagePrompt(): string {
  return [
    'The attached image is a photo or scan of ONE receipt or invoice.',
    'Read it and return ONLY a JSON object (no prose, no code fence) with this exact shape:',
    '{',
    '  "feasible": boolean,        // false if the image is not actually a receipt/invoice or is unreadable',
    '  "confidence": number,       // 0..1, your confidence in the extraction',
    '  "note": string,             // one short sentence; if not feasible, say why',
    '  "merchant": string|null,',
    '  "purchasedAt": string|null, // ISO 8601 date if determinable, else null',
    '  "currency": string|null,    // ISO 4217 code, e.g. "USD"',
    '  "subtotal": number|null, "tax": number|null, "total": number|null,',
    '  "lineItems": [ { "description": string, "quantity": number|null, "unitPrice": number|null, "amount": number|null, "category": string } ]',
    '}',
    'Rules: amounts are plain numbers (no currency symbols). If the image is not a legible receipt, set feasible=false, confidence low, lineItems=[]. Never invent line items you cannot read.',
  ].join('\n')
}

function num(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null
  return Math.round(value * 100) / 100
}

function str(value: unknown, max = 200): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed ? trimmed.slice(0, max) : null
}

// Tolerant parse of the model's JSON (strips an accidental code fence), then
// hard-validates and clamps every field so the CSV layer only sees clean data.
export function parseReceiptResponse(raw: string): ParsedReceipt {
  const stripped = raw.trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim()
  let body: Record<string, unknown>
  try {
    const parsed = JSON.parse(stripped)
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) throw new Error('not an object')
    body = parsed as Record<string, unknown>
  } catch {
    throw new ReceiptUtilityError('The parser returned an unreadable result. Try again.', 502)
  }

  const rawItems = Array.isArray(body.lineItems) ? body.lineItems : []
  const lineItems: ReceiptLineItem[] = rawItems.slice(0, 200).map((item) => {
    const object = (typeof item === 'object' && item !== null ? item : {}) as Record<string, unknown>
    return {
      description: str(object.description, 300) ?? '(unlabeled item)',
      quantity: num(object.quantity),
      unitPrice: num(object.unitPrice),
      amount: num(object.amount),
      category: str(object.category, 60) ?? 'uncategorized',
    }
  })

  const confidenceRaw = typeof body.confidence === 'number' ? body.confidence : 0
  const confidence = Math.max(0, Math.min(1, confidenceRaw))
  const feasible = body.feasible === true && lineItems.length > 0

  return {
    feasible,
    confidence,
    note: str(body.note, 300) ?? (feasible ? 'Parsed.' : 'This does not look like a receipt.'),
    merchant: str(body.merchant, 200),
    purchasedAt: str(body.purchasedAt, 40),
    currency: str(body.currency, 8),
    subtotal: num(body.subtotal),
    tax: num(body.tax),
    total: num(body.total),
    lineItems,
  }
}

export async function runReceiptParse(text: string, runner: ReceiptRunner): Promise<ParsedReceipt> {
  return parseReceiptResponse(await runner(buildReceiptPrompt(text)))
}

// The deliverable subset of a run: the receipts that parsed into usable data.
// A run with none of these is refunded — you are charged only for what parsed.
export function feasibleReceipts(parsed: (ParsedReceipt | null)[]): ParsedReceipt[] {
  return parsed.filter((receipt): receipt is ParsedReceipt => receipt?.feasible === true)
}

// Validate a paid batch: an array of 1..MAX_BATCH_RECEIPTS receipt strings,
// each held to the same bounds as a single receipt. Throws on the first bad one.
export function validateReceiptBatch(value: unknown): string[] {
  if (!Array.isArray(value) || value.length === 0) throw new ReceiptUtilityError('Provide an array of at least one receipt.')
  if (value.length > MAX_BATCH_RECEIPTS) throw new ReceiptUtilityError(`A single run accepts at most ${MAX_BATCH_RECEIPTS} receipts.`)
  return value.map((entry) => validateReceiptText(entry))
}

// Optional text side of a mixed image/text run: 0..MAX_BATCH_RECEIPTS strings.
// Images may be the sole input, so an empty or absent list is allowed here; the
// combined image+text minimum is enforced separately at run time.
export function validateOptionalReceiptTexts(value: unknown): string[] {
  if (value === undefined || value === null) return []
  if (!Array.isArray(value)) throw new ReceiptUtilityError('receipts must be an array of strings.')
  if (value.length > MAX_BATCH_RECEIPTS) throw new ReceiptUtilityError(`A single run accepts at most ${MAX_BATCH_RECEIPTS} receipts.`)
  return value.map((entry) => validateReceiptText(entry))
}

function csvCell(value: string | number | null): string {
  if (value === null) return ''
  const text = String(value)
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

// Deterministic CSV from a parsed receipt — the shippable asset. Header matches
// common accounting imports; a trailing totals row summarizes the receipt.
export function receiptCsv(parsed: ParsedReceipt): string {
  const header = ['description', 'quantity', 'unit_price', 'amount', 'category', 'merchant', 'purchased_at', 'currency']
  const rows = parsed.lineItems.map((item) => [
    csvCell(item.description),
    csvCell(item.quantity),
    csvCell(item.unitPrice),
    csvCell(item.amount),
    csvCell(item.category),
    csvCell(parsed.merchant),
    csvCell(parsed.purchasedAt),
    csvCell(parsed.currency),
  ].join(','))
  const totals = [
    csvCell('TOTAL'), '', '', csvCell(parsed.total ?? parsed.subtotal), csvCell(parsed.tax === null ? '' : `tax:${parsed.tax}`),
    csvCell(parsed.merchant), csvCell(parsed.purchasedAt), csvCell(parsed.currency),
  ].join(',')
  return [header.join(','), ...rows, totals].join('\r\n')
}

// Combined CSV for a paid batch. A leading `receipt` column groups the rows,
// and each receipt is followed by its own TOTAL row. Callers pass only the
// receipts worth delivering (feasible ones); an empty list yields header-only.
export function receiptBatchCsv(receipts: ParsedReceipt[]): string {
  const header = ['receipt', 'description', 'quantity', 'unit_price', 'amount', 'category', 'merchant', 'purchased_at', 'currency']
  const lines = [header.join(',')]
  receipts.forEach((parsed, index) => {
    const label = String(index + 1)
    for (const item of parsed.lineItems) {
      lines.push([
        csvCell(label), csvCell(item.description), csvCell(item.quantity), csvCell(item.unitPrice), csvCell(item.amount),
        csvCell(item.category), csvCell(parsed.merchant), csvCell(parsed.purchasedAt), csvCell(parsed.currency),
      ].join(','))
    }
    lines.push([
      csvCell(label), csvCell('TOTAL'), '', '', csvCell(parsed.total ?? parsed.subtotal),
      csvCell(parsed.tax === null ? '' : `tax:${parsed.tax}`), csvCell(parsed.merchant), csvCell(parsed.purchasedAt), csvCell(parsed.currency),
    ].join(','))
  })
  return lines.join('\r\n')
}

import { createHash, randomUUID } from 'node:crypto'

export const PHYSICAL_COMMERCE_DEMO_ID = 'maha:physical-commerce-tea-demo:v1'
export const PHYSICAL_COMMERCE_DEMO_URL = 'https://www.mahastrategies.com/agentic-commerce/physical-goods-demo'
export const PHYSICAL_COMMERCE_DEMO_CONTRACT_URL = 'https://www.mahastrategies.com/.well-known/maha/physical-commerce-demo.json'

const UNIT_PRODUCT_PRICE_USD = 25
const FREIGHT_USD = 120
const MAHA_COMMISSION_RATE = 0.10
const MIN_QUANTITY = 20
const MAX_QUANTITY = 100

export type PhysicalCommerceDemoInput = {
  clientEnquiryRef: string
  quantity: number
  destinationCountry: 'US'
}

export type PhysicalCommerceDemoEvent = {
  sequence: number
  state: string
  actor: string
  occurredAt: string
  humanApprovalRequired: boolean
  demonstrationOnly: true
  detail: string
  previousEventHash: string | null
  eventHash: string
}

export type PhysicalCommerceDemoResult = {
  schemaVersion: '1.0.0'
  demonstrationOnly: true
  commercialAvailability: 'unavailable'
  orderId: string
  clientEnquiryRef: string
  startedAt: string
  completedAt: string
  actors: Array<{
    id: string
    role: string
    status: 'real-platform' | 'fictional-counterparty'
    responsibility: string
  }>
  offer: {
    offeringRef: typeof PHYSICAL_COMMERCE_DEMO_ID
    title: string
    originCountry: 'LK'
    netWeightGramsPerPack: 100
    quantity: number
    destinationCountry: 'US'
    certificationClaims: []
  }
  quote: {
    currency: 'USD'
    unitProductPrice: number
    productSubtotal: number
    illustrativeFreight: number
    totalBuyerPayment: number
    mahaCommissionRate: number
    mahaCommission: number
    exporterProductProceeds: number
    customsDutiesAndTaxesIncluded: false
    incoterm: 'DAP — illustrative only, not a binding Incoterms quotation'
  }
  settlement: {
    mode: 'simulated-escrow'
    realFundsMoved: false
    buyerPaymentHeld: number
    releasedToExporter: number
    releasedToMaha: number
    freightAllocation: number
  }
  events: PhysicalCommerceDemoEvent[]
  evidence: {
    eventChainHead: string
    quoteHash: string
    simulatedTrackingReference: string
    reportHash: string
  }
  warnings: string[]
  productionRequirements: string[]
}

export class PhysicalCommerceDemoInputError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'PhysicalCommerceDemoInputError'
  }
}

function canonical(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`
  return `{${Object.entries(value as Record<string, unknown>)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, entry]) => `${JSON.stringify(key)}:${canonical(entry)}`)
    .join(',')}}`
}

function digest(value: unknown): string {
  return `sha256:${createHash('sha256').update(canonical(value)).digest('hex')}`
}

function money(value: number) {
  return Number(value.toFixed(2))
}

export function parsePhysicalCommerceDemoInput(value: unknown): PhysicalCommerceDemoInput {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new PhysicalCommerceDemoInputError('The request body must be a JSON object.')
  }
  const record = value as Record<string, unknown>
  if (typeof record.clientEnquiryRef !== 'string' || !/^[A-Za-z0-9._:-]{8,120}$/.test(record.clientEnquiryRef)) {
    throw new PhysicalCommerceDemoInputError('clientEnquiryRef must be an 8-120 character idempotency reference.')
  }
  if (!Number.isInteger(record.quantity) || Number(record.quantity) < MIN_QUANTITY || Number(record.quantity) > MAX_QUANTITY) {
    throw new PhysicalCommerceDemoInputError(`quantity must be an integer from ${MIN_QUANTITY} through ${MAX_QUANTITY}.`)
  }
  if (record.destinationCountry !== 'US') {
    throw new PhysicalCommerceDemoInputError('The bounded demonstration supports the fictional US destination only.')
  }
  return {
    clientEnquiryRef: record.clientEnquiryRef,
    quantity: Number(record.quantity),
    destinationCountry: 'US',
  }
}

export function runPhysicalCommerceDemo(
  input: PhysicalCommerceDemoInput,
  options: { startedAt?: string; orderId?: string } = {},
): PhysicalCommerceDemoResult {
  const checked = parsePhysicalCommerceDemoInput(input)
  const startedAt = options.startedAt ?? new Date().toISOString()
  const startMs = Date.parse(startedAt)
  if (!Number.isFinite(startMs)) throw new PhysicalCommerceDemoInputError('startedAt must be a valid ISO-8601 timestamp.')
  const orderId = options.orderId ?? `demo-order-${randomUUID()}`
  const productSubtotal = money(checked.quantity * UNIT_PRODUCT_PRICE_USD)
  const mahaCommission = money(productSubtotal * MAHA_COMMISSION_RATE)
  const exporterProductProceeds = money(productSubtotal - mahaCommission)
  const totalBuyerPayment = money(productSubtotal + FREIGHT_USD)
  const quote = {
    currency: 'USD' as const,
    unitProductPrice: UNIT_PRODUCT_PRICE_USD,
    productSubtotal,
    illustrativeFreight: FREIGHT_USD,
    totalBuyerPayment,
    mahaCommissionRate: MAHA_COMMISSION_RATE,
    mahaCommission,
    exporterProductProceeds,
    customsDutiesAndTaxesIncluded: false as const,
    incoterm: 'DAP — illustrative only, not a binding Incoterms quotation' as const,
  }

  const eventDefinitions = [
    ['ENQUIRY_RECEIVED', 'did:example:buyer-agent', false, 'A fictional buyer agent requested a bounded Sri Lankan tea offer.'],
    ['PRODUCT_MATCHED', 'did:web:mahastrategies.com', false, 'Maha matched the enquiry to the demonstration offer without claiming real stock.'],
    ['QUOTE_PENDING', 'did:web:mahastrategies.com', false, 'An illustrative quote was prepared for exporter review.'],
    ['QUOTE_APPROVED', 'did:example:licensed-exporter-required', true, 'A fictional licensed-exporter role approved the illustrative quote.'],
    ['BUYER_ACCEPTED', 'did:example:buyer-agent', true, 'A fictional buyer role accepted the illustrative quote.'],
    ['AWAITING_PAYMENT', 'did:web:mahastrategies.com', false, 'The order entered a simulated escrow-funding state.'],
    ['FUNDED', 'urn:maha:demo:escrow', false, 'The simulated escrow recorded funding; no blockchain or fiat transfer occurred.'],
    ['EXPORTER_ACCEPTED', 'did:example:licensed-exporter-required', true, 'The fictional exporter role accepted responsibility for fulfillment.'],
    ['PACKED', 'did:example:licensed-exporter-required', false, 'The fictional exporter role recorded a packing event.'],
    ['EXPORT_CLEARED', 'did:example:licensed-exporter-required', true, 'The demo recorded a fictional export-clearance event, not a government filing.'],
    ['SHIPPED', 'urn:maha:demo:carrier', false, 'A simulated tracking reference was attached as shipment evidence.'],
    ['DELIVERED', 'urn:maha:demo:carrier', false, 'The fictional carrier role recorded delivery.'],
    ['RELEASED', 'urn:maha:demo:escrow', false, 'Simulated escrow allocations were released to the fictional exporter and Maha.'],
  ] as const

  let previousEventHash: string | null = null
  const events = eventDefinitions.map(([state, actor, humanApprovalRequired, detail], index) => {
    const eventWithoutHash = {
      sequence: index + 1,
      state,
      actor,
      occurredAt: new Date(startMs + index * 60_000).toISOString(),
      humanApprovalRequired,
      demonstrationOnly: true as const,
      detail,
      previousEventHash,
    }
    const event = { ...eventWithoutHash, eventHash: digest(eventWithoutHash) }
    previousEventHash = event.eventHash
    return event
  })

  const reportWithoutHash = {
    orderId,
    clientEnquiryRef: checked.clientEnquiryRef,
    offer: PHYSICAL_COMMERCE_DEMO_ID,
    quote,
    eventChainHead: events.at(-1)?.eventHash ?? '',
  }

  return {
    schemaVersion: '1.0.0',
    demonstrationOnly: true,
    commercialAvailability: 'unavailable',
    orderId,
    clientEnquiryRef: checked.clientEnquiryRef,
    startedAt,
    completedAt: events.at(-1)?.occurredAt ?? startedAt,
    actors: [
      { id: 'did:web:mahastrategies.com', role: 'marketplace-policy-and-evidence-layer', status: 'real-platform', responsibility: 'Match the enquiry, enforce the state machine, and produce audit evidence.' },
      { id: 'did:example:buyer-agent', role: 'buyer', status: 'fictional-counterparty', responsibility: 'Approve the order, supply lawful importer details, and confirm receipt.' },
      { id: 'did:example:licensed-exporter-required', role: 'licensed-exporter', status: 'fictional-counterparty', responsibility: 'Own inventory, quote, export compliance, packing, and shipping.' },
      { id: 'urn:maha:demo:escrow', role: 'escrow', status: 'fictional-counterparty', responsibility: 'Hold and release funds according to verified order events.' },
      { id: 'urn:maha:demo:carrier', role: 'carrier', status: 'fictional-counterparty', responsibility: 'Provide tracking and delivery evidence.' },
    ],
    offer: {
      offeringRef: PHYSICAL_COMMERCE_DEMO_ID,
      title: 'Illustrative Sri Lankan Black Tea Retail Pack',
      originCountry: 'LK',
      netWeightGramsPerPack: 100,
      quantity: checked.quantity,
      destinationCountry: 'US',
      certificationClaims: [],
    },
    quote,
    settlement: {
      mode: 'simulated-escrow',
      realFundsMoved: false,
      buyerPaymentHeld: totalBuyerPayment,
      releasedToExporter: exporterProductProceeds,
      releasedToMaha: mahaCommission,
      freightAllocation: FREIGHT_USD,
    },
    events,
    evidence: {
      eventChainHead: events.at(-1)?.eventHash ?? '',
      quoteHash: digest(quote),
      simulatedTrackingReference: `DEMO-${digest(orderId).slice(7, 19).toUpperCase()}`,
      reportHash: digest(reportWithoutHash),
    },
    warnings: [
      'This is a technical demonstration, not an offer for sale, quotation, export filing, escrow service, or shipping commitment.',
      'No inventory, licensed exporter, importer, carrier, payment processor, escrow provider, or customs authority is connected.',
      'All prices, approvals, funds, tracking events, and delivery events are fictional and must not be used as commercial evidence.',
      'Maha makes no tea-origin, quality, organic, geographic-indication, food-safety, or certification claim in this demonstration.',
    ],
    productionRequirements: [
      'Contract with a licensed Sri Lankan tea exporter that owns the inventory and approves each quote.',
      'Verify destination-market importer, labeling, food-safety, customs, tax, and sanctions requirements.',
      'Integrate a regulated payment or escrow provider with refund, dispute, and reconciliation controls.',
      'Integrate a carrier or freight forwarder that supplies independently verifiable tracking evidence.',
      'Complete legal, insurance, accounting, privacy, and consumer-protection review before accepting a real order.',
    ],
  }
}

export const physicalCommerceDemoContract = Object.freeze({
  schemaVersion: '1.0.0',
  name: 'Maha CARP Physical Commerce Demonstration',
  description: 'A non-commercial, zero-funds simulation of a CABEZON Seller enquiry, quote, human approvals, simulated escrow, physical fulfillment, delivery evidence, and release.',
  demonstrationOnly: true,
  commercialAvailability: 'unavailable',
  price: null,
  paymentInstructions: null,
  endpoint: 'https://www.mahastrategies.com/api/agentic-commerce/physical-goods-demo',
  method: 'POST',
  page: PHYSICAL_COMMERCE_DEMO_URL,
  carpSellerProfile: 'https://www.mahastrategies.com/.well-known/carp/seller.json',
  inputSchema: {
    type: 'object',
    additionalProperties: false,
    required: ['clientEnquiryRef', 'quantity', 'destinationCountry'],
    properties: {
      clientEnquiryRef: { type: 'string', minLength: 8, maxLength: 120, pattern: '^[A-Za-z0-9._:-]+$', description: 'Caller-supplied idempotency reference for the demonstration.' },
      quantity: { type: 'integer', minimum: MIN_QUANTITY, maximum: MAX_QUANTITY, description: 'Fictional count of 100 g retail packs.' },
      destinationCountry: { const: 'US', description: 'The only bounded fictional destination in version 1.' },
    },
  },
  exampleInput: { clientEnquiryRef: 'demo-buyer-enquiry-001', quantity: 20, destinationCountry: 'US' },
  output: {
    mediaType: 'application/json',
    appendOnlyEventChain: true,
    humanApprovalStates: ['QUOTE_APPROVED', 'BUYER_ACCEPTED', 'EXPORTER_ACCEPTED', 'EXPORT_CLEARED'],
    terminalState: 'RELEASED',
    settlement: 'simulated-escrow; realFundsMoved is always false',
  },
  limitations: [
    'No real product, inventory, exporter, importer, payment, escrow, customs, carrier, shipment, or delivery.',
    'No claim that a future commercial transaction will use the illustrative prices or allocation.',
    'The endpoint creates an ephemeral report and does not persist an order or personal data.',
  ],
})

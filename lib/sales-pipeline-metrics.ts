export type ProspectMetricRow = { publicId: string; offerId: string; sourceKind: string; contactBasis: string; fitScore: number; status: string }
export type RevenueMetricRow = { publicId: string; offerId: string; status: string }
export type ReconciliationMetricRow = { opportunityId: string; grossAmountCents: number; refundedAmountCents: number; currency: string }
export type AttributionMetricRow = { prospectId: string; opportunityId: string }

export type PipelineCounts = { prospects: number; reviewing: number; qualified: number; draftsReady: number; approved: number; sent: number; replied: number; won: number; lost: number }
export type PipelineOffer = PipelineCounts & { offerId: string }

function blank(): PipelineCounts { return { prospects: 0, reviewing: 0, qualified: 0, draftsReady: 0, approved: 0, sent: 0, replied: 0, won: 0, lost: 0 } }
function add(target: PipelineCounts, row: ProspectMetricRow) {
  target.prospects += 1
  if (row.status === 'reviewing') target.reviewing += 1
  if (['qualified','draft_ready','approved','sent','replied','won','lost'].includes(row.status)) target.qualified += 1
  if (row.status === 'draft_ready') target.draftsReady += 1
  if (['approved','sent','replied','won','lost'].includes(row.status)) target.approved += 1
  if (['sent','replied','won','lost'].includes(row.status)) target.sent += 1
  if (['replied','won','lost'].includes(row.status)) target.replied += 1
  if (row.status === 'won') target.won += 1
  if (row.status === 'lost') target.lost += 1
}

export function aggregateSalesPipeline(input: { prospects: ProspectMetricRow[]; attributions: AttributionMetricRow[]; opportunities: RevenueMetricRow[]; reconciliations: ReconciliationMetricRow[] }) {
  const overall = blank(); const byOffer = new Map<string, PipelineCounts>()
  for (const prospect of input.prospects) { add(overall, prospect); const row = byOffer.get(prospect.offerId) ?? blank(); add(row, prospect); byOffer.set(prospect.offerId, row) }
  const opportunityById = new Map(input.opportunities.map((row) => [row.publicId, row]))
  const linkedOpportunityIds = new Set(input.attributions.map((row) => row.opportunityId))
  const revenue = new Map<string, { currency: string; grossCents: number; refundedCents: number; netCents: number; paidCount: number }>()
  for (const item of input.reconciliations) {
    if (!linkedOpportunityIds.has(item.opportunityId)) continue
    const offer = opportunityById.get(item.opportunityId)?.offerId ?? 'unattributed'
    const key = `${offer}\u0000${item.currency}`
    const row = revenue.get(key) ?? { currency: item.currency, grossCents: 0, refundedCents: 0, netCents: 0, paidCount: 0 }
    row.grossCents += item.grossAmountCents; row.refundedCents += item.refundedAmountCents; row.netCents += item.grossAmountCents - item.refundedAmountCents; row.paidCount += 1; revenue.set(key, row)
  }
  return {
    funnel: overall,
    byOffer: [...byOffer.entries()].map(([offerId, counts]) => ({ offerId, ...counts })).sort((a,b) => a.offerId.localeCompare(b.offerId)),
    attribution: { linkedProspects: input.attributions.length, unlinkedProspects: Math.max(0, input.prospects.length - input.attributions.length), linkedRevenue: [...revenue.entries()].map(([key,row]) => ({ offerId: key.split('\u0000')[0], ...row })).sort((a,b) => a.offerId.localeCompare(b.offerId)) },
  }
}

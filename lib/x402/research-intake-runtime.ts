import Anthropic from '@anthropic-ai/sdk'

import { createAgentInquiryLedger } from '../agent-inquiry-ledger.ts'
import {
  ResearchIntakeSectionFailure,
  assembleResearchIntakeEvidencePack,
  auditResearchIntakeSections,
  type ResearchIntakeInput,
  type ResearchIntakeSectionCheckpoint,
} from '../research-intake-evidence-pack.ts'
import {
  RESEARCH_INTAKE_MODEL,
  researchIntakeJobResponse,
  type StoredResearchIntakeJob,
  type StoredResearchIntakeSection,
} from './research-intake-job.ts'

export const RESEARCH_INTAKE_JOB_COLUMNS = 'public_id,client_request_id,input_hash,status,result,failure_code,created_at,payment_transaction,payer'
export const RESEARCH_INTAKE_SECTION_COLUMNS = 'pack_public_id,section_order,source_id,section_id,source_section_hash,status,audit_result,failure_code,attempt_count,updated_at,completed_at'
export type ResearchIntakeLedger = NonNullable<ReturnType<typeof createAgentInquiryLedger>>

function json(body: unknown, status: number) {
  return Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } })
}

export async function researchIntakeSectionsFor(ledger: ResearchIntakeLedger, packId: string) {
  const result = await ledger.from('x402_research_intake_section_audits').select(RESEARCH_INTAKE_SECTION_COLUMNS)
    .eq('pack_public_id', packId).order('section_order', { ascending: true })
  return { data: (result.data ?? []) as StoredResearchIntakeSection[], error: result.error }
}

export async function executeResearchIntakeSections(options: {
  ledger: ResearchIntakeLedger
  job: StoredResearchIntakeJob
  input: ResearchIntakeInput
  sectionRows: StoredResearchIntakeSection[]
  retrievalToken?: string
  successStatus?: number
}) {
  const { ledger, job, input, sectionRows, retrievalToken, successStatus = 200 } = options
  const existing: ResearchIntakeSectionCheckpoint[] = sectionRows.flatMap((row) => row.status === 'completed' && row.audit_result ? [{
    sourceId: row.source_id, sectionId: row.section_id, order: row.section_order,
    inputHash: row.source_section_hash, audit: row.audit_result,
  }] : [])

  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    const audits = await auditResearchIntakeSections(input, async (prompt) => {
      const message = await client.messages.create({
        model: RESEARCH_INTAKE_MODEL,
        max_tokens: 1_500,
        messages: [{ role: 'user', content: prompt }],
      })
      return message.content.map((block) => block.type === 'text' ? block.text : '').join('\n')
    }, {
      existing,
      persist: async (checkpoint) => {
        const completedAt = new Date().toISOString()
        const saved = await ledger.from('x402_research_intake_section_audits').update({
          status: 'completed', audit_result: checkpoint.audit, failure_code: null,
          updated_at: completedAt, completed_at: completedAt,
        }).eq('pack_public_id', job.public_id).eq('section_order', checkpoint.order).eq('status', 'processing')
          .select('section_order').maybeSingle()
        if (saved.error || !saved.data) throw new Error(`section_checkpoint_write_failed:${saved.error?.code ?? 'missing_record'}`)
      },
    })
    const pack = assembleResearchIntakeEvidencePack(input, audits)
    const completedAt = new Date().toISOString()
    const completed = await ledger.from('x402_research_intake_packs').update({
      status: 'completed', result: pack, failure_code: null, completed_at: completedAt,
    }).eq('public_id', job.public_id).select(RESEARCH_INTAKE_JOB_COLUMNS).maybeSingle()
    const refreshed = await researchIntakeSectionsFor(ledger, job.public_id)
    if (completed.error || !completed.data || refreshed.error) {
      return json({
        ...researchIntakeJobResponse({ ...job, status: 'completed', result: pack, failure_code: null }, refreshed.data, { retrievalToken }),
        resultPersisted: false,
      }, successStatus)
    }
    return json(researchIntakeJobResponse(completed.data as StoredResearchIntakeJob, refreshed.data, { retrievalToken }), successStatus)
  } catch (error) {
    const failedOrders = error instanceof ResearchIntakeSectionFailure
      ? error.failures.map((failure) => failure.order)
      : sectionRows.filter((row) => row.status !== 'completed').map((row) => row.section_order)
    const now = new Date().toISOString()
    await Promise.all(failedOrders.map((order) => ledger.from('x402_research_intake_section_audits').update({
      status: 'failed', failure_code: 'section_audit_failed', updated_at: now,
    }).eq('pack_public_id', job.public_id).eq('section_order', order).neq('status', 'completed')))
    await ledger.from('x402_research_intake_packs').update({ status: 'failed', failure_code: 'section_audit_failed' }).eq('public_id', job.public_id)
    const refreshed = await researchIntakeSectionsFor(ledger, job.public_id)
    return json({
      ...researchIntakeJobResponse({ ...job, status: 'failed', failure_code: 'section_audit_failed' }, refreshed.data, { retrievalToken }),
      paymentTransaction: job.payment_transaction,
    }, 502)
  }
}

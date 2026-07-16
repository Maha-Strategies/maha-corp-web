import Anthropic from '@anthropic-ai/sdk'

import { MpsAuditError, runMpsAudit } from '@/lib/mps-audit-engine'

export const runtime = 'nodejs'
export const maxDuration = 30

export async function POST(request: Request) {
  try {
    const body = await request.json() as { text?: unknown }
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    const audit = await runMpsAudit(body.text, async (prompt) => {
      const message = await client.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 1_500,
        messages: [{ role: 'user', content: prompt }],
      })
      return message.content
        .map((block) => block.type === 'text' ? block.text : '')
        .join('\n')
    })
    return Response.json(audit, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    if (error instanceof MpsAuditError) {
      return Response.json({ error: error.message }, { status: error.status, headers: { 'Cache-Control': 'no-store' } })
    }
    console.error('MPS audit error:', error instanceof Error ? error.name : 'unknown_error')
    return Response.json({ error: "The audit didn't complete. Please try again." }, { status: 500, headers: { 'Cache-Control': 'no-store' } })
  }
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: { Allow: 'POST, OPTIONS', 'Cache-Control': 'no-store' } })
}

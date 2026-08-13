import {
  PhysicalCommerceDemoInputError,
  physicalCommerceDemoContract,
  parsePhysicalCommerceDemoInput,
  runPhysicalCommerceDemo,
} from '@/lib/carp/physical-commerce-demo'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
}

export function GET() {
  return Response.json(physicalCommerceDemoContract, { headers: corsHeaders })
}

export async function POST(request: Request) {
  const contentType = request.headers.get('content-type')?.toLowerCase() ?? ''
  if (!contentType.startsWith('application/json')) {
    return Response.json({ error: { code: 'unsupported_media_type', message: 'Content-Type must be application/json.' } }, { status: 415, headers: corsHeaders })
  }
  const text = await request.text()
  if (new TextEncoder().encode(text).byteLength > 10_000) {
    return Response.json({ error: { code: 'payload_too_large', message: 'The demonstration request must not exceed 10,000 bytes.' } }, { status: 413, headers: corsHeaders })
  }
  try {
    const parsed: unknown = JSON.parse(text)
    const input = parsePhysicalCommerceDemoInput(parsed)
    return Response.json(runPhysicalCommerceDemo(input), { status: 201, headers: corsHeaders })
  } catch (error) {
    if (error instanceof SyntaxError || error instanceof PhysicalCommerceDemoInputError) {
      return Response.json({ error: { code: 'invalid_demo_request', message: error.message } }, { status: 400, headers: corsHeaders })
    }
    throw error
  }
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders })
}

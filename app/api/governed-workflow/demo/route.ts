import { jsonResponse } from '@/lib/agent-inquiries'
import {
  GWSG_DEMO_NOTICE,
  GWSG_DEMO_OPERATIONS,
  GwsgDemoError,
  parseDemoRequest,
  runDemoProgram,
} from '@/lib/governed-workflow/demo-api'
import { GWSG_SCENARIO_IDS, GWSG_SCENARIO_RUNNERS, type ScenarioId } from '@/lib/governed-workflow/scenarios'
import { sanitizeTimeline } from '@/lib/governed-workflow/audit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * The governed workflow demo surface.
 *
 * Unauthenticated on purpose: it holds no data, accepts no document content,
 * performs no side effect, and returns the same bytes for the same input. It
 * is a worked example, not a service. `MAX_BODY_BYTES` is small because a
 * program is a short list of operation names.
 */
const MAX_BODY_BYTES = 16_384

export async function GET(request: Request) {
  const scenario = new URL(request.url).searchParams.get('scenario')
  if (!scenario) {
    return jsonResponse({
      synthetic: true,
      notice: GWSG_DEMO_NOTICE,
      operations: GWSG_DEMO_OPERATIONS,
      scenarios: GWSG_SCENARIO_IDS,
      schemas: [
        '/schemas/governed-workflow/transition-1.0.0.json',
        '/schemas/governed-workflow/evidence-reference-1.0.0.json',
        '/schemas/governed-workflow/state-graph-1.0.0.json',
      ],
    }, 200)
  }
  if (!GWSG_SCENARIO_IDS.includes(scenario as ScenarioId)) {
    return jsonResponse({ error: { code: 'unknown_scenario', message: `scenario must be one of: ${GWSG_SCENARIO_IDS.join(', ')}.` } }, 404)
  }
  const result = GWSG_SCENARIO_RUNNERS[scenario as ScenarioId]()
  return jsonResponse({
    synthetic: true,
    notice: GWSG_DEMO_NOTICE,
    scenarioId: result.scenarioId,
    title: result.title,
    demonstrates: result.demonstrates,
    finalState: result.instance.currentState,
    recovery: result.recovery,
    timeline: sanitizeTimeline(result.timeline),
  }, 200)
}

export async function POST(request: Request) {
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) {
    return jsonResponse({ error: { code: 'unsupported_media_type', message: 'Content-Type must be application/json.' } }, 415)
  }
  const raw = await request.text()
  if (Buffer.byteLength(raw, 'utf8') > MAX_BODY_BYTES) {
    return jsonResponse({ error: { code: 'payload_too_large', message: 'A demo program must be under 16 KB.' } }, 413)
  }
  try {
    return jsonResponse(runDemoProgram(parseDemoRequest(JSON.parse(raw))) as unknown as Record<string, unknown>, 200)
  } catch (caught) {
    if (caught instanceof GwsgDemoError) {
      return jsonResponse({ error: { code: caught.code, message: caught.message } }, caught.status)
    }
    if (caught instanceof SyntaxError) {
      return jsonResponse({ error: { code: 'invalid_json', message: 'Request body must be valid JSON.' } }, 400)
    }
    return jsonResponse({ error: { code: 'demo_failed', message: 'The demo program could not be executed.' } }, 500)
  }
}

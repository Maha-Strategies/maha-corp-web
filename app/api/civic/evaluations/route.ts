import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { verifyEvaluationReport } from '../../../../lib/civic/evaluation.ts'
import { civicResponse } from '../../../../lib/civic/http.ts'
export const runtime = 'nodejs'
export async function GET() {
  try { return civicResponse(verifyEvaluationReport(JSON.parse(await readFile(join(process.cwd(), 'public/civic/evaluations/latest.json'), 'utf8')))) }
  catch { return civicResponse({ error: 'No valid published evaluation report is available.' }, 503) }
}

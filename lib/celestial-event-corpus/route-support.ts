import { CORPUS_EPISTEMIC_BOUNDARY } from './types.ts'

export function corpusJson(body: Record<string, unknown>, status: number): Response {
  return Response.json(
    { ...body, epistemicBoundary: CORPUS_EPISTEMIC_BOUNDARY },
    { status, headers: { 'Cache-Control': 'no-store', 'Content-Type': 'application/json; charset=utf-8' } },
  )
}

export function corpusError(code: string, message: string, status: number, issues?: string[]): Response {
  return corpusJson({ error: { code, message, ...(issues ? { issues } : {}) } }, status)
}

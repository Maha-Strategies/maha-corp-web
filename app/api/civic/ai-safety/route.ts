import { safetyIntakeStatus, submitSafetyConcern } from '../../../../lib/civic/ai-safety-service.ts'

export const runtime = 'nodejs'
export const GET = () => safetyIntakeStatus()
export const POST = (request: Request) => submitSafetyConcern(request)

import { safetyInbox } from '../../../../lib/civic/ai-safety-service.ts'

export const runtime = 'nodejs'
export const GET = (request: Request) => safetyInbox(request)
export const POST = (request: Request) => safetyInbox(request)

import { handleCitizenCase } from '../../../../../lib/civic/workspace-service.ts'
export const runtime = 'nodejs'
export const POST = (request: Request) => handleCitizenCase(request)

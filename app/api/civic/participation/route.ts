import { handlePublicParticipation } from '../../../../lib/civic/workspace-service.ts'
export const runtime = 'nodejs'
export const GET = () => handlePublicParticipation()

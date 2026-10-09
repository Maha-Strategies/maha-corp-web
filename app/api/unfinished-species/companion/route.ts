import { handleAtlasCompanion } from '@/lib/unfinished-atlas-companion'
export const runtime = 'nodejs'
export const maxDuration = 45
export function POST(request: Request) { return handleAtlasCompanion(request) }

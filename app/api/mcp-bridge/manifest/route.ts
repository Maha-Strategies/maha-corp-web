import { mcpBridgeManifest } from '@/lib/mcp-bridge'

export const dynamic = 'force-static'

export function GET() {
  return Response.json(mcpBridgeManifest, { headers: { 'Cache-Control': 'public, max-age=300, must-revalidate', 'X-Content-Type-Options': 'nosniff' } })
}

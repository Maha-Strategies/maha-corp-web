import { readFileSync } from 'node:fs'
import path from 'node:path'

import { discoveryOptions, serveDiscoveryDocument } from '../../../../lib/discovery-response.ts'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Served verbatim rather than re-serialised, so the bytes an agent reads are
// exactly the bytes in the repository.
const MCP_CONTRACT = readFileSync(path.join(process.cwd(), 'content', 'discovery', 'mcp-gateway-contract.json'), 'utf8')

// Serves the canonical /mcp-gateway-contract.json via a rewrite.
export async function GET(request: Request) {
  return serveDiscoveryDocument(request, { surface: 'mcp_contract', body: MCP_CONTRACT, contentType: 'application/json' })
}

export const OPTIONS = discoveryOptions

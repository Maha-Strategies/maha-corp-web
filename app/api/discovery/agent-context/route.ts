import { readFileSync } from 'node:fs'
import path from 'node:path'

import { discoveryOptions, serveDiscoveryDocument } from '../../../../lib/discovery-response.ts'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const AGENT_CONTEXT = readFileSync(path.join(process.cwd(), 'content', 'discovery', 'agentic-commerce.md'), 'utf8')

// Serves the canonical /llm-context/agentic-commerce.md via a rewrite.
export async function GET(request: Request) {
  return serveDiscoveryDocument(request, { surface: 'agent_context', body: AGENT_CONTEXT, contentType: 'text/markdown; charset=utf-8' })
}

export const OPTIONS = discoveryOptions

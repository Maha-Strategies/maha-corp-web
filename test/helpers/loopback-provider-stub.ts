import { createServer } from 'node:http'
import { renameSync, writeFileSync } from 'node:fs'
import type { AddressInfo } from 'node:net'

/**
 * A loopback stand-in for the three provider APIs, run as its own process.
 *
 * Out-of-process on purpose: the collector is invoked with execFileSync, which
 * blocks the caller's event loop, so a server sharing that loop would never
 * answer. It routes by path prefix rather than by port so one stub can stand in
 * for all three providers at once - which is what a test needs in order to be
 * sure no probe quietly reached the real internet.
 *
 * Responses come from MAHA_STUB_ROUTES as JSON; anything unrouted answers 500,
 * so a path this stub was not told about cannot look like a successful check.
 */

type Route = { status: number; body?: unknown }
const routes = JSON.parse(process.env.MAHA_STUB_ROUTES ?? '{}') as Record<string, Route>
const portFile = process.env.MAHA_STUB_PORT_FILE ?? ''

const route = (path: string): Route => {
  if (path.startsWith('/v1/projects')) return routes.supabase ?? { status: 500 }
  if (path.startsWith('/v9/projects')) return routes.vercel ?? { status: 500 }
  if (path.startsWith('/repos/')) return routes.github ?? { status: 500 }
  return { status: 500 }
}

const server = createServer((request, response) => {
  const result = route(request.url ?? '')
  response.writeHead(result.status, { 'content-type': 'application/json' })
  response.end(JSON.stringify(result.body ?? {}))
})

server.listen(0, '127.0.0.1', () => {
  // Written aside then renamed: a reader polling for this file must never
  // observe it existing but empty, which is a real state writeFileSync passes
  // through and which polling loops read as "no port yet, but no error either".
  writeFileSync(`${portFile}.partial`, String((server.address() as AddressInfo).port))
  renameSync(`${portFile}.partial`, portFile)
})

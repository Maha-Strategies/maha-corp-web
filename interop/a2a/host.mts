// LOCAL-ONLY A2A compatibility host. NOT a third-party validation.
// Maha's maha-a2a package ships an agent card and a task handler but no HTTP
// transport, so this exposes them over a loopback HTTP server to put a real
// serialization and wire boundary between caller and handler.
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import type { AddressInfo } from 'node:net'
import { a2aAgentCard, handleA2ATask } from '../../lib/maha-a2a/index.ts'

const server = createServer((req: IncomingMessage, res: ServerResponse) => {
  const send = (code: number, body: unknown) => { res.writeHead(code, { 'content-type': 'application/json' }); res.end(JSON.stringify(body)) }
  const port = () => (server.address() as AddressInfo).port
  if (req.method === 'GET' && req.url === '/.well-known/agent-card.json') {
    return send(200, a2aAgentCard(`http://127.0.0.1:${port()}`))
  }
  if (req.method === 'POST' && req.url === '/tasks') {
    let raw = ''
    req.on('data', (c: Buffer) => { raw += c; if (raw.length > 262_144) req.destroy() })
    return req.on('end', () => {
      let parsed: unknown
      try { parsed = JSON.parse(raw) } catch { return send(400, { error: 'invalid_json' }) }
      try { send(200, handleA2ATask(parsed)) } catch (caught) { send(500, { error: String(caught).slice(0, 200) }) }
    })
  }
  send(404, { error: 'not_found' })
})
server.listen(0, '127.0.0.1', () => process.stdout.write(`${JSON.stringify({ port: (server.address() as AddressInfo).port })}\n`))

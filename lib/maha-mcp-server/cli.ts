#!/usr/bin/env node
/**
 * `maha-mcp-server` — MCP over stdio.
 *
 * stdout is the protocol channel, so nothing may be written there but MCP
 * frames. Diagnostics go to stderr; a stray console.log here would corrupt the
 * stream and present as an unexplained client parse error.
 */
import { startMahaMcpStdioServer } from './index.ts'

const argv = process.argv.slice(2)

if (argv.includes('--help') || argv.includes('-h')) {
  process.stderr.write([
    'maha-mcp-server — Maha Context Control over MCP stdio.',
    '',
    'Takes no arguments and reads no credentials. Configuration comes from the',
    'environment; a compile operation without it fails closed rather than',
    'guessing. Nothing is sent anywhere: this speaks MCP on stdin/stdout only.',
    '',
    '  --help     this text',
    '  --version  print the server version',
    '',
  ].join('\n'))
  process.exit(0)
}

if (argv.includes('--version')) {
  const { MCP_SERVER_VERSION } = await import('../maha-mcp/index.ts')
  process.stderr.write(`${MCP_SERVER_VERSION}\n`)
  process.exit(0)
}

// A credential passed as an argument would land in shell history and process
// listings, so refuse rather than accept one by a route that leaks it.
const credentialLike = argv.find((argument) => /secret|token|credential|password|api[-_]?key|authorization/i.test(argument))
if (credentialLike) {
  process.stderr.write('Refusing to start: this server never takes credentials as arguments. Use the environment.\n')
  process.exit(2)
}

await startMahaMcpStdioServer()

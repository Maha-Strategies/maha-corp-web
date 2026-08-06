import nextEnv from '@next/env';
import assert from 'node:assert/strict';
import { MahaApiError, MahaClient } from '../lib/sdk/index.ts';
import { runRestoredEngineE2e } from './test-restored-engines-e2e.ts';

// This script runs outside the Next.js runtime, so load .env.local and the
// other standard Next environment files before reading test configuration.
// Explicit shell/CI values retain precedence over files.
nextEnv.loadEnvConfig(process.cwd());

const BASE_URL = process.env.TEST_API_URL || 'http://localhost:3000';
const TEST_API_KEY = process.env.STAGING_API_KEY;
if (!TEST_API_KEY) throw new Error('STAGING_API_KEY must be a provisioned non-production API key.');
const TEST_MCP_UPSTREAM_URL = process.env.TEST_MCP_UPSTREAM_URL;
if (!TEST_MCP_UPSTREAM_URL) throw new Error('TEST_MCP_UPSTREAM_URL must be a controlled HTTPS JSON-RPC test server.');
const TEST_MCP_UPSTREAM_TOKEN = process.env.TEST_MCP_UPSTREAM_TOKEN;
if (!TEST_MCP_UPSTREAM_TOKEN) throw new Error('TEST_MCP_UPSTREAM_TOKEN must authenticate to the controlled JSON-RPC test server.');

if (process.env.VERCEL_AUTOMATION_BYPASS_SECRET) {
  const fetchWithoutBypass = globalThis.fetch;
  globalThis.fetch = (input, init) => {
    const headers = new Headers(init?.headers);
    headers.set('x-vercel-protection-bypass', process.env.VERCEL_AUTOMATION_BYPASS_SECRET!);
    return fetchWithoutBypass(input, { ...init, headers });
  };
}

const maha = new MahaClient({
  apiKey: TEST_API_KEY,
  baseUrl: BASE_URL,
});

async function main() {
  console.log(`🚀 Starting End-to-End Integration Test`);
  console.log(` Target Server: ${BASE_URL}`);
  console.log(` Authenticated API key configured.\n`);

  // --- STEP 1: Register Upstream MCP Server ---
  console.log('[1/4] Registering Upstream Enterprise MCP Server...');
  const server = await maha.mcp.registerServer({
    name: 'Internal ERP Analytics Tool',
    baseUrl: TEST_MCP_UPSTREAM_URL,
    authType: 'bearer',
    secret: TEST_MCP_UPSTREAM_TOKEN,
    allowedMethods: ['initialize', 'notifications/initialized', 'ping', 'tools/list', 'tools/call'],
    allowedToolNames: ['calculateRiskScore', 'simulateTimeout'],
  });

  console.log(`   ✔ MCP Server registered with ID: ${server.id}`);
  if (server.discovery.status !== 'ready' || !server.discovery.tools.some((tool) => tool.name === 'calculateRiskScore')) throw new Error(`Automatic tools/list discovery failed: ${server.discovery.error ?? server.discovery.status}`);
  console.log(`   ✔ tools/list discovered ${server.discovery.tools.length} validated tool(s).`);

  const safeServers = await maha.mcp.listServers();
  const registeredServer = safeServers.find((item) => item.serverId === server.id);
  if (!registeredServer || JSON.stringify(registeredServer).includes('authSecret')) throw new Error('Credential-safe MCP server listing failed.');
  const refreshed = await maha.mcp.discoverTools(server.id);
  if (refreshed.discovery.status !== 'ready' || refreshed.discovery.tools.length !== server.discovery.tools.length) throw new Error('Manual tools/list refresh failed.');
  console.log(`   ✔ Sanitized server listing and manual tools/list refresh passed.`);
  const sla = await maha.mcp.getSettings();
  const savedSla = await maha.mcp.updateSettings(sla);
  if (JSON.stringify(savedSla) !== JSON.stringify(sla)) throw new Error('Tenant MCP SLA settings did not round-trip.');
  console.log(`   ✔ Tenant SLA controls round-tripped (${sla.requestsPerMinute}/min, ${sla.timeoutMs}ms timeout).`);

  // --- STEP 2: Dispatch Tool Call Through Gateway ---
  console.log('\n[2/4] Executing JSON-RPC tool call through MCP Gateway Proxy...');
  
  const result = await maha.mcp.call<{ authenticated?: boolean; method?: string }>(
    server.id,
    'tools/call',
    { name: 'calculateRiskScore', arguments: { portfolioId: 'pf_8819', alpha: 0.05 } }
  );
  if (result?.authenticated !== true || result.method !== 'tools/call') throw new Error('Gateway did not return the expected authenticated JSON-RPC result.');
  console.log(`   ✔ Gateway response received and JSON-RPC result asserted.`);

  const originalSla = await maha.mcp.getSettings();
  try {
    await maha.mcp.updateSettings({ ...originalSla, timeoutMs: 1_000, failureThreshold: 1, cooldownMs: 5_000 });
    await assert.rejects(
      () => maha.mcp.call(server.id, 'tools/call', { name: 'simulateTimeout', arguments: {} }),
      (error: unknown) => error instanceof MahaApiError && error.status === 504,
      'The controlled upstream timeout did not return HTTP 504.',
    );
    await assert.rejects(
      () => maha.mcp.call(server.id, 'tools/call', { name: 'calculateRiskScore', arguments: { portfolioId: 'pf_8819' } }),
      (error: unknown) => error instanceof MahaApiError && error.status === 503,
      'The circuit breaker did not block the next upstream request.',
    );
    await new Promise((resolve) => setTimeout(resolve, 5_100));
    const recovered = await maha.mcp.call<{ authenticated?: boolean }>(server.id, 'tools/call', { name: 'calculateRiskScore', arguments: { portfolioId: 'pf_8819' } });
    if (recovered.authenticated !== true) throw new Error('The circuit breaker half-open probe did not recover.');

    await maha.mcp.updateSettings({ ...originalSla, requestsPerMinute: 1 });
    const limited = await fetch(`${BASE_URL}/api/v1/mcp/gateway/${encodeURIComponent(server.id)}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${TEST_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 'rate_limit_probe', method: 'tools/call', params: { name: 'calculateRiskScore', arguments: { portfolioId: 'pf_8819' } } }),
    });
    if (limited.status !== 429) throw new Error(`Tenant MCP rate limiter returned ${limited.status}, expected 429.`);
    console.log(`   ✔ Timeout circuit opened, half-open recovery passed, and tenant rate limit returned 429.`);
  } finally {
    await maha.mcp.updateSettings(originalSla);
  }

  // --- STEP 3: Export & Validate CSV Audit Trail ---
  console.log('\n[3/4] Exporting Provenance Ledger as CSV...');
  const csvExport = await maha.audit.export({ format: 'csv' });
  
  console.log(`   ✔ CSV Generated: ${csvExport.filename}`);
  console.log(`   --- CSV Preview ---`);
  console.log((csvExport.data as string).split('\r\n').slice(0, 3).join('\n'));
  if (!(csvExport.data as string).includes('mcp-gateway')) throw new Error('CSV export did not include the gateway audit entry.');
  console.log(`   -------------------`);

  // --- STEP 4: Export & Validate PDF Evidence Document ---
  console.log('\n[4/4] Exporting Cryptographic PDF Audit Document...');
  const pdfExport = await maha.audit.export({ format: 'pdf' });
  
  const buffer = Buffer.from(pdfExport.data as ArrayBuffer);
  const pdfHeader = buffer.toString('utf8', 0, 5);
  
  if (pdfHeader === '%PDF-') {
    console.log(`   ✔ PDF Header Valid: (${pdfHeader})`);
    console.log(`   ✔ Binary File Size: ${buffer.byteLength} bytes`);

  } else {
    throw new Error(`Invalid PDF binary header received: ${pdfHeader}`);
  }

  console.log('\n SUCCESS! Audit export, MCP discovery, SLA controls, and gateway proxy verified end-to-end.');
  await runRestoredEngineE2e(maha, BASE_URL);
  console.log('\n SUCCESS! Restored Tensor-Network and Geometric Registration engines verified end-to-end.');
}

main().catch((err) => {
  console.error('\n❌ End-to-End Test Failed:', err);
  process.exit(1);
});

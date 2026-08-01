import { MahaClient } from '../lib/sdk/index.ts';

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
  console.log(` Authenticated API key: ${TEST_API_KEY.slice(0, 12)}…\n`);

  // --- STEP 1: Register Upstream MCP Server ---
  console.log('[1/4] Registering Upstream Enterprise MCP Server...');
  const server = await maha.mcp.registerServer({
    name: 'Internal ERP Analytics Tool',
    baseUrl: TEST_MCP_UPSTREAM_URL,
    authType: 'bearer',
    secret: TEST_MCP_UPSTREAM_TOKEN,
    allowedEngines: ['*'],
  });

  console.log(`   ✔ MCP Server registered with ID: ${server.id}`);

  // --- STEP 2: Dispatch Tool Call Through Gateway ---
  console.log('\n[2/4] Executing JSON-RPC tool call through MCP Gateway Proxy...');
  
  const result = await maha.mcp.call<any>(
    server.id,
    'tools/calculateRiskScore',
    { portfolioId: 'pf_8819', alpha: 0.05 }
  );
  if (result?.authenticated !== true || result.method !== 'tools/calculateRiskScore') throw new Error('Gateway did not return the expected authenticated JSON-RPC result.');
  console.log(`   ✔ Gateway response received and JSON-RPC result asserted.`);

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

  console.log('\n SUCCESS! All Phase A & Phase B endpoints verified end-to-end.');
}

main().catch((err) => {
  console.error('\n❌ End-to-End Test Failed:', err);
  process.exit(1);
});

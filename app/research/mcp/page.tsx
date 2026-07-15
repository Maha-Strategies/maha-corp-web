// app/research/mcp/page.tsx
// Server component (no 'use client') so metadata + schema work and it ranks.
// PRIMARY method: direct Claude Desktop config via mcp-remote -> /mcp (streamable-HTTP).
// This is the method confirmed working end-to-end. The old Smithery `mcp add`
// proxy flow was unreliable (tool-call 502s) and the SSE endpoint is removed.
// Token shown as a placeholder (YOUR_TOKEN) — never print the real secret here.

import React from 'react';
import Link from 'next/link';

const SITE_URL = 'https://www.mahastrategies.com';
const SERVER_ID = 'mayone/cognitive-gateway';
const MCP_URL = 'https://mcp.maha-os.com/mcp';

export const metadata = {
  metadataBase: new URL(SITE_URL),
  title: 'Connect the Maha Cognitive Gateway (MCP Server) to Claude | Maha Strategies',
  description:
    'Connect the Maha Cognitive Gateway to Claude Desktop for Maha OS telemetry, publishing workflows, and research tools. Includes token access, setup, verification, and troubleshooting.',
  alternates: { canonical: '/research/mcp' },
  openGraph: {
    type: 'article',
    url: `${SITE_URL}/research/mcp`,
    siteName: 'Maha Strategies',
    title: 'Connect the Maha Cognitive Gateway (MCP Server) to Claude',
    description:
      'Connect the Cognitive Gateway to Claude Desktop for Maha OS telemetry, publishing workflows, and research tools.',
    images: [{ url: '/og-master.png', width: 1200, height: 630, alt: 'Maha Cognitive Gateway MCP' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Connect the Maha Cognitive Gateway (MCP Server) to Claude',
    description: 'Bring Maha OS telemetry, publishing workflows, and research tools into Claude Desktop.',
    images: ['/og-master.png'],
  },
};

const howToLd = {
  '@context': 'https://schema.org',
  '@type': 'HowTo',
  name: 'Connect the Maha Cognitive Gateway MCP server to Claude Desktop',
  description:
    'Add the Maha Cognitive Gateway MCP server to Claude Desktop using mcp-remote, then verify the tools load.',
  totalTime: 'PT10M',
  tool: [
    { '@type': 'HowToTool', name: 'Node.js and npm (provides npx)' },
    { '@type': 'HowToTool', name: 'Claude Desktop' },
    { '@type': 'HowToTool', name: 'A Maha Cognitive Gateway access token' },
  ],
  step: [
    {
      '@type': 'HowToStep',
      name: 'Open the Claude Desktop config',
      text: 'Open claude_desktop_config.json from the Claude Desktop developer settings.',
    },
    {
      '@type': 'HowToStep',
      name: 'Add the server entry',
      text: 'Add an mcpServers entry that runs mcp-remote against https://mcp.maha-os.com/mcp with an Authorization Bearer header.',
    },
    {
      '@type': 'HowToStep',
      name: 'Restart Claude Desktop',
      text: 'Fully quit and reopen Claude Desktop so it loads the new MCP server.',
    },
    {
      '@type': 'HowToStep',
      name: 'Verify the tools',
      text: 'Open the tools/connector menu in a new conversation and confirm the Maha tools appear.',
    },
  ],
};

const CONFIG_SNIPPET = `{
  "mcpServers": {
    "maha-os": {
      "command": "npx",
      "args": [
        "-y",
        "mcp-remote",
        "https://mcp.maha-os.com/mcp",
        "--header",
        "Authorization: Bearer YOUR_TOKEN"
      ]
    }
  }
}`;

function Code({ children }: { children: string }) {
  return (
    <pre className="bg-black border border-gray-800 p-5 text-xs text-emerald-400 overflow-x-auto leading-relaxed my-3 whitespace-pre">
      {children}
    </pre>
  );
}

const tools = [
  { name: 'defense_get_baseline', note: 'Reads live biometric telemetry. Returns UNLINKED unless the Maha OS mobile client is bridged.' },
  { name: 'defense_trigger_circuit_breaker', note: 'Sends a cognitive-defense intervention to a linked device. Write action — requires approval.' },
  { name: 'publish_analyze_mswl', note: 'Scores a literary agent\u2019s wishlist against the manuscript and suggests a hook.' },
  { name: 'publish_generate_query', note: 'Drafts a tailored query letter from the book proposal and author dossier.' },
  { name: 'publish_log_query', note: 'Logs a query submission to the tracking file. Write action.' },
  { name: 'publish_export_shunn', note: 'Formats a chapter into Shunn manuscript standard.' },
  { name: 'publish_fetch_sovereign_data', note: 'Retrieves author dossier and proposal data by manuscript ID.' },
  { name: 'publish_synthetic_market_audit', note: 'Audits a manuscript framework against market and discourse trends.' },
];

export default function McpInstallationPage() {
  return (
    <main className="min-h-screen bg-[#0a0a0c] text-[#e0e0e0] py-16 px-6 sm:px-12 font-mono selection:bg-indigo-500 selection:text-white">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(howToLd) }} />

      <div className="max-w-3xl mx-auto">

        {/* TOP STATUS LINE */}
        <header className="text-xs text-gray-500 mb-12 border-b border-gray-800 pb-4 flex justify-between items-center">
          <span>[ PROTOCOL // COGNITIVE_GATEWAY ]</span>
          <span className="text-emerald-400">STATUS: OPERATIONAL</span>
        </header>

        <h1 className="font-sans text-2xl sm:text-4xl font-bold tracking-tight text-white uppercase mb-4">
          Connect the Maha Cognitive Gateway to Claude
        </h1>

        <p className="text-sm text-gray-400 leading-relaxed mb-8 font-sans">
          The Cognitive Gateway is our Model Context Protocol (MCP) server, published on Smithery as{' '}
          <code className="text-white bg-zinc-900 px-1.5 py-0.5 text-xs border border-zinc-800">{SERVER_ID}</code>.
          This guide connects it to Claude Desktop directly, using <code className="text-white bg-zinc-900 px-1.5 py-0.5 text-xs border border-zinc-800">mcp-remote</code>{' '}
          pointed at the server&rsquo;s HTTP endpoint &mdash; the method we&rsquo;ve found most reliable.
        </p>

        <div className="border border-emerald-900/50 bg-emerald-950/20 p-4 mb-8 text-xs text-emerald-100/80 font-sans leading-relaxed">
          <strong className="text-emerald-300">Operational.</strong> The Gateway currently maintains 100% uptime. Access requires a token.
        </div>

        <section className="mb-12 border-l-2 border-indigo-500 pl-5">
          <h2 className="text-base text-white font-sans mb-3">Bring Maha workflows into Claude Desktop.</h2>
          <p className="text-sm text-gray-400 leading-relaxed font-sans mb-5">
            Use the Gateway to read Maha OS telemetry from a paired device, run cognitive-defense actions with approval, and work with publishing and research tools without leaving Claude.
          </p>
          <Link href="/contact" className="inline-block bg-white text-black font-mono font-bold text-[10px] tracking-widest uppercase px-5 py-3 hover:bg-zinc-200 transition-colors">
            Request an access token &#8599;
          </Link>
        </section>

        {/* PREREQUISITES */}
        <section className="mb-12">
          <h2 className="text-xs text-indigo-400 uppercase tracking-widest border-b border-gray-900 pb-2 mb-4">
            00 // Prerequisites
          </h2>
          <ul className="text-sm text-gray-300 leading-relaxed font-sans list-disc pl-5 space-y-1">
            <li>Node.js and npm installed (provides <code className="text-white bg-zinc-900 px-1 py-0.5 text-xs border border-zinc-800">npx</code>).</li>
            <li>Claude Desktop.</li>
            <li>A Maha Cognitive Gateway access token (see step 1).</li>
          </ul>
        </section>

        {/* STEP 1: TOKEN */}
        <section className="mb-12">
          <h2 className="text-xs text-indigo-400 uppercase tracking-widest border-b border-gray-900 pb-2 mb-4">
            01 // Get an access token
          </h2>
          <p className="text-sm text-gray-300 leading-relaxed font-sans">
            The Gateway requires an access token. Request one via{' '}
            <Link href="/contact" className="text-indigo-400 hover:text-white underline">our contact page</Link>.
            You&rsquo;ll use it in place of <code className="text-white bg-zinc-900 px-1 py-0.5 text-xs border border-zinc-800">YOUR_TOKEN</code> below.
            Keep it private &mdash; treat it like a password.
          </p>
        </section>

        {/* STEP 2: CONFIG */}
        <section className="mb-12">
          <h2 className="text-xs text-indigo-400 uppercase tracking-widest border-b border-gray-900 pb-2 mb-4">
            02 // Add the server to Claude Desktop
          </h2>
          <p className="text-sm text-gray-300 leading-relaxed font-sans mb-2">
            In Claude Desktop, open <strong>Settings &rarr; Developer &rarr; Edit Config</strong> to open{' '}
            <code className="text-white bg-zinc-900 px-1 py-0.5 text-xs border border-zinc-800">claude_desktop_config.json</code>.
            Add the <code className="text-white bg-zinc-900 px-1 py-0.5 text-xs border border-zinc-800">maha-os</code>{' '}
            entry below (merge it into any existing <code className="text-white bg-zinc-900 px-1 py-0.5 text-xs border border-zinc-800">mcpServers</code> block),
            replacing <code className="text-white bg-zinc-900 px-1 py-0.5 text-xs border border-zinc-800">YOUR_TOKEN</code> with your token:
          </p>
          <Code>{CONFIG_SNIPPET}</Code>
          <p className="text-[11px] text-gray-500 italic mt-2">
            *On first run, npx fetches mcp-remote, which bridges Claude Desktop to the Gateway&rsquo;s HTTP endpoint at {MCP_URL}.
          </p>
        </section>

        {/* STEP 3: RESTART + VERIFY */}
        <section className="mb-12">
          <h2 className="text-xs text-indigo-400 uppercase tracking-widest border-b border-gray-900 pb-2 mb-4">
            03 // Restart &amp; verify
          </h2>
          <p className="text-sm text-gray-300 leading-relaxed font-sans">
            Fully quit Claude Desktop (Cmd+Q / quit, not just close the window) and reopen it &mdash; MCP servers load at
            startup. In a new conversation, open the tools/connector menu and confirm <strong>maha-os</strong> appears
            with its tools listed. If nothing shows, see Troubleshooting.
          </p>
        </section>

        {/* STEP 4: TOOLS */}
        <section className="mb-12">
          <h2 className="text-xs text-indigo-400 uppercase tracking-widest border-b border-gray-900 pb-2 mb-4">
            04 // Available tools
          </h2>
          <ul className="text-sm text-gray-300 leading-relaxed font-sans space-y-3 list-none pl-0">
            {tools.map((t) => (
              <li key={t.name} className="border border-gray-900 bg-black/30 p-3">
                <code className="text-emerald-400 text-xs">{t.name}</code>
                <span className="block text-xs text-gray-400 mt-1">{t.note}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* STEP 5: TEST PROMPT */}
        <section className="mb-12">
          <h2 className="text-xs text-indigo-400 uppercase tracking-widest border-b border-gray-900 pb-2 mb-4">
            05 // Test prompt
          </h2>
          <p className="text-sm text-gray-300 leading-relaxed mb-4 font-sans">
            A good first test is a tool that runs entirely server-side. Ask Claude:
          </p>
          <div className="border-l-2 border-indigo-500 bg-zinc-950/40 p-5 text-sm text-zinc-300 font-sans italic leading-relaxed my-4">
            &ldquo;Use the maha-os synthetic market audit tool on this proposal: &lsquo;A framework for biological
            sovereignty and attentional defense in the age of algorithmic capture.&rsquo;&rdquo;
          </div>
          <p className="text-sm text-gray-300 leading-relaxed font-sans">
            Claude will ask to approve the tool call, then return a structured audit. If it answers from general
            knowledge without calling the tool, the connection isn&rsquo;t active &mdash; see Troubleshooting. (Note:{' '}
            <code className="text-white bg-zinc-900 px-1 py-0.5 text-xs border border-zinc-800">defense_get_baseline</code>{' '}
            returns UNLINKED unless a Maha OS mobile device is bridged &mdash; that&rsquo;s expected, not an error.)
          </p>
        </section>

        {/* TROUBLESHOOTING */}
        <section className="mb-12">
          <h2 className="text-xs text-indigo-400 uppercase tracking-widest border-b border-gray-900 pb-2 mb-4">
            06 // Troubleshooting
          </h2>
          <ul className="text-sm text-gray-300 leading-relaxed font-sans space-y-3 list-disc pl-5">
            <li><strong className="text-white">Tools don&rsquo;t appear:</strong> fully quit and reopen Claude Desktop &mdash; servers load at startup. Check the config JSON is valid (no trailing commas).</li>
            <li><strong className="text-white">Auth errors / 401 / 403:</strong> confirm <code className="text-white bg-zinc-900 px-1 py-0.5 text-xs border border-zinc-800">YOUR_TOKEN</code> is replaced with a valid token and the header reads <code className="text-white bg-zinc-900 px-1 py-0.5 text-xs border border-zinc-800">Authorization: Bearer &lt;token&gt;</code>.</li>
            <li><strong className="text-white">Calls fail:</strong> confirm your network connection, token, and server configuration before retrying the request.</li>
            <li><strong className="text-white">Command not found:</strong> verify Node/npm are installed and the global npm bin directory is on your PATH.</li>
            <li><strong className="text-white">Logs:</strong> on macOS, see <code className="text-white bg-zinc-900 px-1 py-0.5 text-xs border border-zinc-800">~/Library/Logs/Claude/</code> for the maha-os server log.</li>
          </ul>
        </section>

        {/* FOOTER INTER-LINKING */}
        <footer className="mt-16 pt-8 border-t border-gray-900 flex flex-col sm:flex-row justify-between gap-4 text-xs">
          <Link href="/research" className="text-gray-600 hover:text-white transition-colors">
            [ &larr; Back to Research ]
          </Link>
          <div className="flex flex-col sm:flex-row gap-4">
            <a href="https://github.com/maha-strategies/maha-agentic-gateway" target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:text-white transition-colors">
              [ Source &amp; README on GitHub &#8599; ]
            </a>
            <a href="https://smithery.ai/servers/mayone/cognitive-gateway" target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:text-white transition-colors">
              [ View on Smithery &#8599; ]
            </a>
          </div>
        </footer>

      </div>
    </main>
  );
}

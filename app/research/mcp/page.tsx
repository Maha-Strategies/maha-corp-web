// app/research/mcp/page.tsx
// Server component (no 'use client') so metadata + schema work and it ranks.
// Connection steps are taken verbatim from the Smithery "Integrate > CLI" tab
// for mayone/cognitive-gateway. Do not reintroduce the old SSE/maha-strategies-mcp
// config — that name and transport were wrong/deprecated and caused failures.

import React from 'react';
import Link from 'next/link';

const SITE_URL = 'https://www.mahastrategies.com';
const SERVER_ID = 'mayone/cognitive-gateway';

export const metadata = {
  metadataBase: new URL(SITE_URL),
  title: 'Connect the Maha Cognitive Gateway (MCP Server) to Claude | Maha Strategies',
  description:
    'Step-by-step guide to connecting the Maha Strategies Cognitive Gateway MCP server (mayone/cognitive-gateway) to Claude via the Smithery CLI, including setup, verification, and troubleshooting.',
  alternates: { canonical: '/research/mcp' },
  openGraph: {
    type: 'article',
    url: `${SITE_URL}/research/mcp`,
    siteName: 'Maha Strategies',
    title: 'Connect the Maha Cognitive Gateway (MCP Server) to Claude',
    description:
      'Connect the Cognitive Gateway MCP server to Claude via the Smithery CLI: setup, verification, and troubleshooting.',
    images: [{ url: '/og-master.png', width: 1200, height: 630, alt: 'Maha Cognitive Gateway MCP' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Connect the Maha Cognitive Gateway (MCP Server) to Claude',
    description: 'Connect the Cognitive Gateway MCP server to Claude via the Smithery CLI.',
    images: ['/og-master.png'],
  },
};

const howToLd = {
  '@context': 'https://schema.org',
  '@type': 'HowTo',
  name: 'Connect the Maha Cognitive Gateway MCP server to Claude',
  description:
    'Install the Smithery CLI, create a namespace, and add the mayone/cognitive-gateway MCP server so Claude can use its tools.',
  totalTime: 'PT10M',
  tool: [
    { '@type': 'HowToTool', name: 'Node.js and npm' },
    { '@type': 'HowToTool', name: 'A Smithery account and API key' },
    { '@type': 'HowToTool', name: 'Claude Desktop or another MCP-compatible client' },
  ],
  step: [
    {
      '@type': 'HowToStep',
      name: 'Install the Smithery CLI',
      text: 'Install the Smithery command-line tool globally with npm install -g smithery.',
    },
    {
      '@type': 'HowToStep',
      name: 'Create an API key and namespace',
      text: 'Create a Smithery API key, then create a namespace with smithery namespace create.',
    },
    {
      '@type': 'HowToStep',
      name: 'Add the server',
      text: 'Add the server with smithery mcp add mayone/cognitive-gateway. Smithery handles OAuth and session management.',
    },
    {
      '@type': 'HowToStep',
      name: 'Verify the connection',
      text: 'List the available tools with smithery tool list, and confirm the tools appear in your Claude client.',
    },
  ],
};

function Code({ children }: { children: string }) {
  return (
    <pre className="bg-black border border-gray-800 p-5 text-xs text-emerald-400 overflow-x-auto leading-relaxed my-3">
      {children}
    </pre>
  );
}

export default function McpInstallationPage() {
  return (
    <main className="min-h-screen bg-[#0a0a0c] text-[#e0e0e0] py-16 px-6 sm:px-12 font-mono selection:bg-indigo-500 selection:text-white">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(howToLd) }} />

      <div className="max-w-3xl mx-auto">

        {/* TOP STATUS LINE */}
        <header className="text-xs text-gray-500 mb-12 border-b border-gray-800 pb-4 flex justify-between items-center">
          <span>[ PROTOCOL // COGNITIVE_GATEWAY ]</span>
          <span className="text-indigo-400">SERVER: {SERVER_ID}</span>
        </header>

        <h1 className="font-sans text-2xl sm:text-4xl font-bold tracking-tight text-white uppercase mb-4">
          Connect the Maha Cognitive Gateway to Claude
        </h1>

        <p className="text-sm text-gray-400 leading-relaxed mb-8 font-sans">
          The Cognitive Gateway is our Model Context Protocol (MCP) server, published on Smithery as{' '}
          <code className="text-white bg-zinc-900 px-1.5 py-0.5 text-xs border border-zinc-800">{SERVER_ID}</code>.
          Once connected, it gives Claude a set of tools for evaluating local-inference workflows and retrieving
          Zero-Payload infrastructure protocols. This guide uses the Smithery CLI, the connection method Smithery
          itself recommends for this server.
        </p>

        {/* HONEST EXPECTATION-SETTING */}
        <div className="border border-amber-900/40 bg-amber-950/10 p-4 mb-12 text-xs text-amber-200/80 font-sans leading-relaxed">
          <strong className="text-amber-300">Before you start:</strong> this is an early-stage server. Connection
          takes a few CLI steps (it is not yet a one-click install), and the server&rsquo;s current uptime is roughly
          86%, so if a call fails, retry or check the status on the Smithery page before assuming your config is wrong.
        </div>

        {/* PREREQUISITES */}
        <section className="mb-12">
          <h2 className="text-xs text-indigo-400 uppercase tracking-widest border-b border-gray-900 pb-2 mb-4">
            00 // Prerequisites
          </h2>
          <ul className="text-sm text-gray-300 leading-relaxed font-sans list-disc pl-5 space-y-1">
            <li>Node.js and npm installed (the CLI is an npm package).</li>
            <li>A Smithery account, and an API key (created from the server&rsquo;s Integrate tab).</li>
            <li>Claude Desktop, or another MCP-compatible client.</li>
          </ul>
        </section>

        {/* STEP 1 */}
        <section className="mb-12">
          <h2 className="text-xs text-indigo-400 uppercase tracking-widest border-b border-gray-900 pb-2 mb-4">
            01 // Install the Smithery CLI
          </h2>
          <p className="text-sm text-gray-300 leading-relaxed font-sans">
            Smithery brokers the connection and handles OAuth, token refresh, and session management for you. Install
            its CLI globally:
          </p>
          <Code>{`npm install -g smithery`}</Code>
        </section>

        {/* STEP 2 */}
        <section className="mb-12">
          <h2 className="text-xs text-indigo-400 uppercase tracking-widest border-b border-gray-900 pb-2 mb-4">
            02 // Create an API key &amp; namespace
          </h2>
          <p className="text-sm text-gray-300 leading-relaxed font-sans mb-2">
            Create an API key from the Cognitive Gateway&rsquo;s{' '}
            <a href="https://smithery.ai/servers/mayone/cognitive-gateway" target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:text-white underline">
              Integrate tab on Smithery
            </a>{' '}
            (the &ldquo;Create API key&rdquo; button), then create a namespace, substituting your own name:
          </p>
          <Code>{`smithery namespace create your-namespace`}</Code>
        </section>

        {/* STEP 3 */}
        <section className="mb-12">
          <h2 className="text-xs text-indigo-400 uppercase tracking-widest border-b border-gray-900 pb-2 mb-4">
            03 // Add the server
          </h2>
          <p className="text-sm text-gray-300 leading-relaxed font-sans">
            Add the Cognitive Gateway to your namespace:
          </p>
          <Code>{`smithery mcp add mayone/cognitive-gateway`}</Code>
          <p className="text-sm text-gray-300 leading-relaxed font-sans">
            Follow any authentication prompt Smithery shows. This links the server to your client through Smithery&rsquo;s
            managed connection.
          </p>
        </section>

        {/* STEP 4: VERIFY */}
        <section className="mb-12">
          <h2 className="text-xs text-indigo-400 uppercase tracking-widest border-b border-gray-900 pb-2 mb-4">
            04 // Verify it connected
          </h2>
          <p className="text-sm text-gray-300 leading-relaxed font-sans">
            Confirm the tools are reachable. List them from the CLI:
          </p>
          <Code>{`smithery tool list your-connection`}</Code>
          <p className="text-sm text-gray-300 leading-relaxed font-sans">
            In Claude Desktop, you should also see the Cognitive Gateway&rsquo;s tools appear (look for the tools/connector
            indicator in a new conversation). If they are not there, restart the client, then see Troubleshooting below.
          </p>
        </section>

        {/* STEP 5: TEST PROMPT */}
        <section className="mb-12">
          <h2 className="text-xs text-indigo-400 uppercase tracking-widest border-b border-gray-900 pb-2 mb-4">
            05 // Test prompt
          </h2>
          <p className="text-sm text-gray-300 leading-relaxed mb-4 font-sans">
            With the tools loaded, give Claude this prompt to exercise the connection:
          </p>
          <div className="border-l-2 border-indigo-500 bg-zinc-950/40 p-5 text-sm text-zinc-300 font-sans italic leading-relaxed my-4">
            &ldquo;Use the Cognitive Gateway tool to evaluate a standard centralized cloud-AI setup against the
            Zero-Payload approach. What is the main data-exposure risk, and what is the on-device alternative?&rdquo;
          </div>
          <p className="text-sm text-gray-300 leading-relaxed font-sans">
            If connected, Claude will call the tool and return a structured comparison. If it answers from general
            knowledge without invoking the tool, the connection is not active &mdash; see Troubleshooting.
          </p>
        </section>

        {/* TROUBLESHOOTING */}
        <section className="mb-12">
          <h2 className="text-xs text-indigo-400 uppercase tracking-widest border-b border-gray-900 pb-2 mb-4">
            06 // Troubleshooting
          </h2>
          <ul className="text-sm text-gray-300 leading-relaxed font-sans space-y-3 list-disc pl-5">
            <li><strong className="text-white">Tools don&rsquo;t appear in Claude:</strong> fully quit and reopen the client &mdash; MCP servers are loaded at startup.</li>
            <li><strong className="text-white">Auth errors:</strong> confirm your Smithery API key is valid and that the <code className="text-white bg-zinc-900 px-1 py-0.5 text-xs border border-zinc-800">add</code> step finished its login prompt. Re-run the add step if needed.</li>
            <li><strong className="text-white">Calls fail intermittently:</strong> the server runs at ~86% uptime; check the live status on the Smithery page and retry before changing your config.</li>
            <li><strong className="text-white">Command not found:</strong> verify Node/npm are installed and that the global npm bin directory is on your PATH.</li>
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

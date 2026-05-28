'use client';

import React from 'react';
import Link from 'next/link';

export default function McpInstallationPage() {
  const mcpConfig = JSON.stringify({
    "mcpServers": {
      "maha-cognitive-grid": {
        "command": "npx",
        "args": [
          "-y",
          "@smithery/cli@latest",
          "run",
          "maha-strategies-mcp",
          "--endpoint",
          "https://mcp.maha-os.com/mcp/sse"
        ]
      }
    }
  }, null, 2);

  return (
    <main className="min-h-screen bg-[#0a0a0c] text-[#e0e0e0] py-16 px-6 sm:px-12 font-mono selection:bg-indigo-500 selection:text-white">
      <div className="max-w-3xl mx-auto">
        
        {/* TOP STATUS LINE */}
        <header className="text-xs text-gray-500 mb-12 border-b border-gray-800 pb-4 flex justify-between items-center">
          <span>[ PROTOCOL // COGNITIVE_DEFENSE_GRID ]</span>
          <span className="text-indigo-400 animate-pulse">RELAY_LIVE // SSE_ACTIVE</span>
        </header>

        <h1 className="font-sans text-2xl sm:text-4xl font-bold tracking-tight text-white uppercase mb-4">
          Adding the Maha Strategies Cognitive Defense Grid to Claude
        </h1>
        
        <p className="text-sm text-gray-400 leading-relaxed mb-8 font-serif italic">
          Integrating local compute tools to audit infrastructure, evaluate local inference workflows, and enforce the Zero-Payload framework.
        </p>

        {/* SECTION 1: THE BASELINE */}
        <section className="mb-12">
          <h2 className="text-xs text-indigo-400 uppercase tracking-widest border-b border-gray-900 pb-2 mb-4">
            01 // The Baseline
          </h2>
          <p className="text-sm text-gray-300 leading-relaxed font-sans">
            The Maha Strategies MCP server grants your local Claude instance real-time access to our "Cognitive Defense Grid." By integrating this tool, you can instruct Claude to audit your current cloud architecture, evaluate local inference workflows, and retrieve protocols for Zero-Payload infrastructure directly from the <em>Maha Principle</em> frameworks.
          </p>
        </section>

        {/* SECTION 2: INSTALLATION */}
        <section className="mb-12">
          <h2 className="text-xs text-indigo-400 uppercase tracking-widest border-b border-gray-900 pb-2 mb-4">
            02 // Installation (Claude Desktop)
          </h2>
          <p className="text-sm text-gray-300 leading-relaxed mb-4 font-sans">
            We route our canonical Model Context Protocol (MCP) through Smithery. To wire the sovereign baseline into your local Claude Desktop app, open your <code className="text-white bg-zinc-900 px-1.5 py-0.5 text-xs border border-zinc-800">claude_desktop_config.json</code> file and append the following configuration:
          </p>

          <div className="relative group my-4">
            <pre className="bg-black border border-gray-800 p-5 text-xs text-emerald-400 overflow-x-auto rounded-none leading-relaxed">
              {mcpConfig}
            </pre>
          </div>

          <p className="text-[11px] text-gray-500 italic mt-2">
            *Note: This connects you directly to our canonical SSE relay at mcp.maha-os.com.
          </p>
        </section>

        {/* SECTION 3: THE EXECUTION */}
        <section className="mb-12">
          <h2 className="text-xs text-indigo-400 uppercase tracking-widest border-b border-gray-900 pb-2 mb-4">
            03 // The Execution (Test Prompt)
          </h2>
          <p className="text-sm text-gray-300 leading-relaxed mb-4 font-sans">
            Once installed and your Claude Desktop restarts, the server will silently initialize. To verify the connection, feed Claude this exact prompt:
          </p>

          <div className="border-l-2 border-indigo-500 bg-zinc-950/40 p-5 text-sm text-zinc-300 font-sans italic leading-relaxed my-4">
            "Query the Maha Strategies tool. Audit a standard hyper-centralized cloud AI infrastructure against the Maha Protocol. What is the primary vulnerability, and what is the Zero-Payload alternative?"
          </div>

          <p className="text-sm text-gray-300 leading-relaxed font-sans">
            Claude will securely hit the endpoint, pull the doctrine, and output a structural teardown of centralized data liability versus on-device biological sovereignty.
          </p>
        </section>

        {/* FOOTER INTER-LINKING */}
        <footer className="mt-16 pt-8 border-t border-gray-900 flex justify-between items-center text-xs">
          <Link href="/research" className="text-gray-600 hover:text-white transition-colors">
            [ ← BACK TO RESEARCH ]
          </Link>
          <a href="/MCP-installation guide.md" download className="text-indigo-400 hover:text-white transition-colors">
            [ DOWNLOAD RAW MANIFEST .MD ]
          </a>
        </footer>

      </div>
    </main>
  );
}
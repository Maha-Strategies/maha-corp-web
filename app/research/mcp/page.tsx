import Link from 'next/link'
import type { Metadata } from 'next'

const SITE_URL = 'https://www.mahastrategies.com'

export const metadata: Metadata = {
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
    images: [
      {
        url: '/og-master.png',
        width: 1200,
        height: 630,
        alt: 'Maha Cognitive Gateway MCP',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Connect the Maha Cognitive Gateway (MCP Server) to Claude',
    description:
      'Bring Maha OS telemetry, publishing workflows, and research tools into Claude Desktop.',
    images: ['/og-master.png'],
  },
}

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
      text: 'Open the tools menu in a new conversation and confirm the Maha tools appear.',
    },
  ],
}

const SERVER_ID = 'mayone/cognitive-gateway'
const MCP_URL = 'https://mcp.maha-os.com/mcp'

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
}`

const tools = [
  {
    name: 'defense_get_baseline',
    note: 'Reads live biometric telemetry. Returns UNLINKED unless the Maha OS mobile client is bridged.',
  },
  {
    name: 'defense_trigger_circuit_breaker',
    note: 'Sends a cognitive-defense intervention to a linked device. Write action — approval required.',
  },
  {
    name: 'publish_analyze_mswl',
    note: 'Scores a literary agent’s wishlist against the manuscript and suggests a hook.',
  },
  {
    name: 'publish_generate_query',
    note: 'Drafts a tailored query letter from the book proposal and author dossier.',
  },
  {
    name: 'publish_log_query',
    note: 'Logs a query submission to the tracking file. Write action.',
  },
  {
    name: 'publish_export_shunn',
    note: 'Formats a chapter into Shunn manuscript standard.',
  },
  {
    name: 'publish_fetch_sovereign_data',
    note: 'Retrieves author dossier and proposal data by manuscript ID.',
  },
  {
    name: 'publish_synthetic_market_audit',
    note: 'Audits a manuscript framework against market and discourse trends.',
  },
]

function Code({ children }: { children: string }) {
  return (
    <pre className="evidence-code p-4 text-xs leading-relaxed overflow-x-auto">{children}</pre>
  )
}

export default function McpInstallationPage() {
  return (
    <main className="evidence-page">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(howToLd) }}
      />

      <div className="evidence-container">
        <header className="border-t border-[var(--border-default)] pt-5">
          <p className="evidence-kicker">[ PROTOCOL // COGNITIVE_GATEWAY ]</p>
          <h1 className="evidence-title evidence-title--product">Connect the Maha Cognitive Gateway to Claude</h1>
          <p className="evidence-lede mt-7">
            This guide connects the hosted Cognitive Gateway to Claude Desktop over MCP.
          </p>
          <p className="evidence-copy mt-6 max-w-3xl">
            Published on Smithery as <code className="evidence-code px-2 py-1">{SERVER_ID}</code>, the gateway supports Maha OS telemetry,
            publishing workflows, and bounded governance tooling from the Claude desktop context.
          </p>
          <p className="evidence-kicker mt-7 text-[var(--status-verified)]">STATUS: OPERATIONAL</p>
          <div className="evidence-inset mt-7">
            <p className="evidence-copy">
              Access requires a token. The hosted gateway is separate from the local commercial <Link href="/mcp-bridge" className="evidence-link">Maha MCP Bridge</Link>; credentials are not interchangeable.
            </p>
          </div>
        </header>

        <div className="evidence-section">
          <p className="evidence-kicker">[ Bring telemetry and publishing into your assistant ]</p>
          <p className="evidence-copy mt-4">
            Use this path for read-first tools and policy-enforced actions from Claude. Request a token, add the config block, restart, and verify.
          </p>
          <Link href="/contact" className="evidence-action evidence-action--primary mt-5 inline-block">
            Request an access token ↗
          </Link>
        </div>

        <section className="evidence-section" aria-label="Prerequisites">
          <p className="evidence-kicker">[ 00 ] Prerequisites</p>
          <ul className="mt-5 space-y-3 evidence-copy">
            <li>Node.js and npm installed (so <code className="evidence-code px-1 py-0.5">npx</code> is available)</li>
            <li>Claude Desktop app</li>
            <li>Maha Cognitive Gateway access token</li>
          </ul>
        </section>

        <section className="evidence-section" aria-label="Token">
          <p className="evidence-kicker">[ 01 ] Get an access token</p>
          <p className="evidence-copy mt-4">
            The gateway requires a token. Request one via the <Link href="/contact" className="evidence-link">contact page</Link>.
            Replace <code className="evidence-code px-1 py-0.5">YOUR_TOKEN</code> in the config block with your live token.
          </p>
        </section>

        <section className="evidence-section" aria-label="Claude config">
          <p className="evidence-kicker">[ 02 ] Add the server in claude_desktop_config.json</p>
          <p className="evidence-copy mt-4">
            In Claude Desktop open <strong>Settings &rarr; Developer &rarr; Edit Config</strong>, add the entry below to <code className="evidence-code px-1 py-0.5">mcpServers</code>.
          </p>
          <Code>{CONFIG_SNIPPET}</Code>
          <p className="evidence-copy mt-2 text-sm text-[var(--text-muted)]">
            *On first run, <code className="evidence-code px-1 py-0.5">npx</code> pulls <code className="evidence-code px-1 py-0.5">mcp-remote</code> and bridges to {MCP_URL}.
          </p>
        </section>

        <section className="evidence-section" aria-label="Restart and verify">
          <p className="evidence-kicker">[ 03 ] Restart and verify</p>
          <p className="evidence-copy mt-4">
            Fully quit Claude Desktop (Cmd+Q), reopen it, and start a new conversation.
            Confirm <strong>maha-os</strong> appears in your tool list. If nothing appears, go directly to troubleshooting.
          </p>
        </section>

        <section className="evidence-section" aria-label="Available tools">
          <p className="evidence-kicker">[ 04 ] Available tools</p>
          <div className="grid gap-4 mt-5 sm:grid-cols-2">
            {tools.map((tool) => (
              <article key={tool.name} className="evidence-card">
                <code className="evidence-kicker text-[0.68rem]">{tool.name}</code>
                <p className="evidence-copy mt-3 leading-relaxed">{tool.note}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="evidence-section" aria-label="Test prompt">
          <p className="evidence-kicker">[ 05 ] Test prompt</p>
          <p className="evidence-copy mt-4">
            A useful first test should be server-only and deterministic. Ask Claude:
          </p>
          <blockquote className="evidence-inset mt-6 evidence-copy">
            &ldquo;Use the Maha synthetic market audit tool on this proposal: &lsquo;A framework for biological
            sovereignty and attentional defense in the age of algorithmic capture.&rsquo;&rdquo;
          </blockquote>
          <p className="evidence-copy mt-4">
            If Claude answers from general knowledge instead of making a tool call, the MCP route is not active. See troubleshooting.
          </p>
        </section>

        <section className="evidence-section" aria-label="Troubleshooting">
          <p className="evidence-kicker">[ 06 ] Troubleshooting</p>
          <ul className="mt-5 space-y-3 evidence-copy">
            <li>Tools do not appear: fully quit and reopen Claude Desktop; verify JSON is valid and no trailing commas exist.</li>
            <li>
              Auth errors: check <code className="evidence-code px-1 py-0.5">Authorization: Bearer &lt;token&gt;</code> is correctly set.
            </li>
            <li>Calls fail: verify network, token, and config before retrying.</li>
            <li>Command not found: confirm Node/npm install and PATH.</li>
          </ul>
        </section>

        <section className="evidence-section">
          <p className="evidence-kicker">[ 07 ] Sources and governance references</p>
          <div className="mt-6 flex flex-wrap gap-4">
            <a
              href="https://github.com/maha-strategies/maha-agentic-gateway"
              target="_blank"
              rel="noopener noreferrer"
              className="evidence-link"
            >
              Source and README ↗
            </a>
            <a
              href="https://smithery.ai/servers/mayone/cognitive-gateway"
              target="_blank"
              rel="noopener noreferrer"
              className="evidence-link"
            >
              Smithery listing ↗
            </a>
            <Link href="/research" className="evidence-link">
              Back to Research ↗
            </Link>
          </div>
        </section>
      </div>
    </main>
  )
}

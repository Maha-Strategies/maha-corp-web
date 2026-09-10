import type { Metadata } from 'next'
import Link from 'next/link'

const SITE_URL = 'https://www.mahastrategies.com'
const PAGE_PATH = '/recipes/bazaar-discovery-to-payment'
const SOURCE_URL = 'https://github.com/Maha-Strategies/maha-corp-web/blob/main/scripts/run-bazaar-discovery-payment-recipe.ts'
const title = 'Bazaar Discovery-to-Payment Agent Recipe | Maha Strategies'
const description = 'Run an x402 v2 buyer that discovers Maha in Coinbase Bazaar, inspects JSON Schema, enforces a $0.005 ceiling, pays $0.001, verifies settlement, and consumes the Context Pack.'

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: PAGE_PATH },
  openGraph: {
    type: 'article', url: `${SITE_URL}${PAGE_PATH}`, siteName: 'Maha Strategies', title, description,
    images: [{ url: '/og-master.png', width: 1200, height: 630, alt: 'Bazaar discovery-to-payment x402 agent recipe' }],
  },
  twitter: { card: 'summary_large_image', title, description, images: ['/og-master.png'] },
}

const flow = [
  ['1', 'Search Bazaar', 'Use semantic search filtered on Base Mainnet, the exact USDC contract address 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913, exact-payment, and maxUsdPrice=0.005. The asset filter takes a contract address: a bare symbol such as "usdc" matches nothing and returns an empty page rather than an error. If the asynchronous semantic index has not refreshed, use Bazaar merchant discovery as the exact indexed fallback.'],
  ['2', 'Inspect the contract', 'Read the discovered input example plus input and output JSON Schemas. Refuse missing or malformed discovery metadata. To decide which offer to call in the first place, read the machine-readable Maha offer selection guide at /.well-known/maha/offer-selection.json.'],
  ['3', 'Apply policy before signing', 'Require Base Mainnet, native Base USDC, the published Maha payee, exactly 1,000 base units, and a hard ceiling of 5,000 base units.'],
  ['4', 'Pay once', 'Load either a plain Viem account or a named CDP Server Wallet only after discovery and policy checks pass. Re-check the live 402 terms before producing a signature.'],
  ['5', 'Verify settlement', 'Require PAYMENT-RESPONSE success, a Base transaction hash, the expected network, and the signing wallet as payer.'],
  ['6', 'Use the Context Pack', 'Validate the paid response shape and produce a downstream prompt that preserves source-linked passage citations.'],
] as const

const corePolicy = `function assertSpendPolicy(requirement) {
  if (requirement.scheme !== 'exact') throw new Error('scheme')
  if (requirement.network !== 'eip155:8453') throw new Error('network')
  if (requirement.asset.toLowerCase() !== BASE_USDC) throw new Error('asset')
  if (requirement.payTo.toLowerCase() !== MAHA_PAYEE) throw new Error('payee')

  const amount = BigInt(requirement.amount)
  if (amount > 5_000n) throw new Error('spend ceiling')
  if (amount !== 1_000n) throw new Error('unexpected price')
}`

export default function BazaarDiscoveryToPaymentRecipePage() {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'TechArticle',
    headline: title,
    description,
    datePublished: '2026-08-08',
    dateModified: '2026-08-08',
    url: `${SITE_URL}${PAGE_PATH}`,
    author: { '@type': 'Organization', name: 'Maha Strategies LLC', url: SITE_URL },
    about: [
      { '@type': 'Thing', name: 'x402 protocol' },
      { '@type': 'SoftwareApplication', name: 'Maha Context Compiler', applicationCategory: 'DeveloperApplication', operatingSystem: 'Web API' },
    ],
  }

  return (
    <main className="evidence-page">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }} />
      <div className="evidence-container">
        <header className="border-t border-[var(--border-default)] pt-5">
          <p className="evidence-kicker flex flex-wrap justify-between gap-3">
            <span>Executable x402 v2 buyer</span><span>Base Mainnet</span>
          </p>
          <h1 className="evidence-title evidence-title--product">Discover. Constrain. Pay. Verify. Use.</h1>
          <p className="evidence-lede mt-7">One runnable agent recipe goes from Coinbase Bazaar discovery to a source-linked Maha Context Pack. It supports CDP Server Wallets and plain Viem accounts, and it will not sign if the live terms exceed <span className="font-mono">$0.005</span> or differ from the expected <span className="font-mono">$0.001</span> purchase.</p>
        </header>

        <section className="evidence-section" aria-label="Recipe gates">
          <p className="evidence-kicker">The gates</p>
          <h2 className="evidence-section-title mt-4">Five checks before anything is signed.</h2>
          <div className="mt-9 grid gap-4 md:grid-cols-2">
            {flow.map(([number, heading, body]) => (
              <article key={number} className="evidence-card">
                <p className="evidence-kicker">Gate {number}</p>
                <h3 className="evidence-card-title mt-3">{heading}</h3>
                <p className="evidence-card-copy mt-3">{body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="evidence-section" aria-labelledby="run">
          <p className="evidence-kicker">Run the machine flow</p>
          <h2 id="run" className="evidence-section-title mt-4">Discovery is free. Payment is an explicit flag.</h2>
          <div className="mt-9 grid gap-5 lg:grid-cols-3">
            <Command title="Dry discovery" command="npm run recipe:bazaar-payment" detail="Searches Bazaar, inspects schemas, and evaluates terms. It never loads a wallet." />
            <Command title="Plain Viem wallet" command={'X402_BUYER_PRIVATE_KEY=0x… npm run recipe:bazaar-payment -- --pay --wallet=viem'} detail="Uses a dedicated limited-balance EOA. The key stays in the process environment." />
            <Command title="CDP Server Wallet" command={'npm install --save-dev @coinbase/cdp-sdk\nCDP_ACCOUNT_NAME=maha-agent npm run recipe:bazaar-payment -- --pay --wallet=cdp'} detail="Also requires CDP_API_KEY_ID, CDP_API_KEY_SECRET, and CDP_WALLET_SECRET in the environment." />
          </div>
          <div className="evidence-inset mt-7" style={{ borderLeftColor: 'var(--status-boundary)' }}>
            <p className="evidence-copy">Fund only the selected Base account with the USDC needed for the test. Do not commit wallet secrets, use a personal high-balance wallet, or remove the local policy checks.</p>
          </div>
        </section>

        <section className="evidence-section" aria-labelledby="policy">
          <p className="evidence-kicker">Local policy</p>
          <h2 id="policy" className="evidence-section-title mt-4">The catalog never gets signing authority.</h2>
          <div className="mt-9 grid gap-6 lg:grid-cols-[1fr_0.9fr]">
            <div>
              <p className="evidence-copy">The recipe evaluates the catalog requirement, then independently evaluates the live <span className="font-mono">PAYMENT-REQUIRED</span> challenge immediately before signing. A changed price, asset, network, payee, or scheme fails closed.</p>
              <p className="evidence-copy mt-4">After the API responds, the recipe decodes <span className="font-mono">PAYMENT-RESPONSE</span> and binds the success receipt to the wallet, Base network, and on-chain transaction before using the body.</p>
            </div>
            <pre className="evidence-code overflow-x-auto p-5 font-mono text-[11px] leading-6"><code>{corePolicy}</code></pre>
          </div>
        </section>

        <section className="evidence-section" aria-labelledby="boundaries">
          <p className="evidence-kicker">Boundaries</p>
          <h2 id="boundaries" className="evidence-section-title mt-4">Operational boundaries</h2>
          <ul className="evidence-copy mt-7 flex list-none flex-col gap-3 p-0">
            <li><strong className="text-[var(--text-primary)]">One paid retry:</strong> the buyer answers one 402 once; it does not loop wallet prompts.</li>
            <li><strong className="text-[var(--text-primary)]">Discovery fallback:</strong> semantic results can lag settlement metadata. Bazaar merchant discovery provides the deterministic indexed fallback.</li>
            <li><strong className="text-[var(--text-primary)]">Receipt verification:</strong> the recipe verifies the signed response metadata. The transaction link is printed for independent Base explorer inspection.</li>
            <li><strong className="text-[var(--text-primary)]">Context boundary:</strong> source coverage means sources represented in selected passages, not guaranteed fact retention or downstream answer correctness.</li>
          </ul>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <a href={SOURCE_URL} target="_blank" rel="noopener noreferrer" className="evidence-action evidence-action--primary">Inspect complete source ↗</a>
            <Link href="/context-compiler/playground" className="evidence-action evidence-action--secondary">Try the compiler ↗</Link>
            <Link href="/benchmarks/context-retention" className="evidence-action evidence-action--secondary">Review MCRB-1 ↗</Link>
          </div>
        </section>
      </div>
    </main>
  )
}

function Command({ title, command, detail }: { title: string; command: string; detail: string }) {
  return (
    <article className="evidence-card">
      <h3 className="evidence-card-title">{title}</h3>
      <pre className="evidence-code mt-4 overflow-x-auto whitespace-pre-wrap p-4 font-mono text-[11px] leading-6"><code>{command}</code></pre>
      <p className="evidence-card-copy mt-4">{detail}</p>
    </article>
  )
}

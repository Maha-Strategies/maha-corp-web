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
  ['1', 'Search Bazaar', 'Use semantic search with Base, USDC, exact-payment, and maxUsdPrice=0.005 filters. If the asynchronous semantic index has not refreshed, use Bazaar merchant discovery as the exact indexed fallback.'],
  ['2', 'Inspect the contract', 'Read the discovered input example plus input and output JSON Schemas. Refuse missing or malformed discovery metadata.'],
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

  return <main className="min-h-screen bg-[#070a0d] text-zinc-300 selection:bg-emerald-300 selection:text-black">
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }} />
    <div className="mx-auto max-w-5xl px-6 py-20 sm:py-28">
      <header className="max-w-4xl border-l border-emerald-500 pl-6 sm:pl-8">
        <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-emerald-300">[ Executable x402 v2 buyer // Base Mainnet ]</p>
        <h1 className="mt-5 text-4xl font-light leading-tight text-white sm:text-6xl">Discover. Constrain. Pay. Verify. Use.</h1>
        <p className="mt-6 max-w-3xl text-lg leading-8 text-zinc-300">One runnable agent recipe goes from Coinbase Bazaar discovery to a source-linked Maha Context Pack. It supports CDP Server Wallets and plain Viem accounts, and it will not sign if the live terms exceed <span className="font-mono text-emerald-200">$0.005</span> or differ from the expected <span className="font-mono text-emerald-200">$0.001</span> purchase.</p>
      </header>

      <section className="mt-14 grid gap-4 md:grid-cols-2" aria-label="Recipe gates">
        {flow.map(([number, heading, body]) => <article key={number} className="border border-zinc-800 bg-zinc-950/50 p-6"><p className="font-mono text-[10px] uppercase tracking-widest text-emerald-300">Gate {number}</p><h2 className="mt-3 text-xl text-white">{heading}</h2><p className="mt-3 text-sm leading-7 text-zinc-400">{body}</p></article>)}
      </section>

      <section className="mt-14" aria-labelledby="run">
        <p className="font-mono text-[10px] uppercase tracking-widest text-cyan-300">[ Run the machine flow ]</p>
        <h2 id="run" className="mt-4 text-3xl font-light text-white">Discovery is free. Payment is an explicit flag.</h2>
        <div className="mt-7 grid gap-5 lg:grid-cols-3">
          <Command title="Dry discovery" command="npm run recipe:bazaar-payment" detail="Searches Bazaar, inspects schemas, and evaluates terms. It never loads a wallet." />
          <Command title="Plain Viem wallet" command={'X402_BUYER_PRIVATE_KEY=0x… npm run recipe:bazaar-payment -- --pay --wallet=viem'} detail="Uses a dedicated limited-balance EOA. The key stays in the process environment." />
          <Command title="CDP Server Wallet" command={'npm install --save-dev @coinbase/cdp-sdk\nCDP_ACCOUNT_NAME=maha-agent npm run recipe:bazaar-payment -- --pay --wallet=cdp'} detail="Also requires CDP_API_KEY_ID, CDP_API_KEY_SECRET, and CDP_WALLET_SECRET in the environment." />
        </div>
        <div className="mt-6 border border-amber-900 bg-amber-950/10 p-5 text-sm leading-7 text-amber-100/80">Fund only the selected Base account with the USDC needed for the test. Do not commit wallet secrets, use a personal high-balance wallet, or remove the local policy checks.</div>
      </section>

      <section className="mt-14 grid gap-6 lg:grid-cols-[1fr_0.9fr]" aria-labelledby="policy">
        <div><p className="font-mono text-[10px] uppercase tracking-widest text-indigo-300">[ Local policy ]</p><h2 id="policy" className="mt-4 text-3xl font-light text-white">The catalog never gets signing authority.</h2><p className="mt-5 text-sm leading-7 text-zinc-400">The recipe evaluates the catalog requirement, then independently evaluates the live <span className="font-mono text-zinc-200">PAYMENT-REQUIRED</span> challenge immediately before signing. A changed price, asset, network, payee, or scheme fails closed.</p><p className="mt-4 text-sm leading-7 text-zinc-400">After the API responds, the recipe decodes <span className="font-mono text-zinc-200">PAYMENT-RESPONSE</span> and binds the success receipt to the wallet, Base network, and on-chain transaction before using the body.</p></div>
        <pre className="overflow-x-auto border border-zinc-800 bg-black p-5 font-mono text-[11px] leading-6 text-cyan-200"><code>{corePolicy}</code></pre>
      </section>

      <section className="mt-14 border-t border-zinc-800 pt-10" aria-labelledby="boundaries">
        <h2 id="boundaries" className="text-2xl text-white">Operational boundaries</h2>
        <ul className="mt-6 space-y-3 text-sm leading-7 text-zinc-400">
          <li><strong className="text-zinc-200">One paid retry:</strong> the buyer answers one 402 once; it does not loop wallet prompts.</li>
          <li><strong className="text-zinc-200">Discovery fallback:</strong> semantic results can lag settlement metadata. Bazaar merchant discovery provides the deterministic indexed fallback.</li>
          <li><strong className="text-zinc-200">Receipt verification:</strong> the recipe verifies the signed response metadata. The transaction link is printed for independent Base explorer inspection.</li>
          <li><strong className="text-zinc-200">Context boundary:</strong> source coverage means sources represented in selected passages, not guaranteed fact retention or downstream answer correctness.</li>
        </ul>
        <div className="mt-8 flex flex-wrap gap-4 font-mono text-xs uppercase tracking-widest"><a href={SOURCE_URL} target="_blank" rel="noopener noreferrer" className="bg-white px-5 py-3 font-bold text-black hover:bg-zinc-200">Inspect complete source ↗</a><Link href="/context-compiler/playground" className="border border-emerald-800 px-5 py-3 text-emerald-100 hover:bg-emerald-950/30">Try the compiler ↗</Link><Link href="/benchmarks/context-retention" className="border border-zinc-700 px-5 py-3 text-zinc-300 hover:border-zinc-500">Review MCRB-1 ↗</Link></div>
      </section>
    </div>
  </main>
}

function Command({ title, command, detail }: { title: string; command: string; detail: string }) {
  return <article className="border border-zinc-800 p-5"><h3 className="text-lg text-white">{title}</h3><pre className="mt-4 overflow-x-auto whitespace-pre-wrap border border-zinc-800 bg-black p-4 font-mono text-[11px] leading-6 text-emerald-200"><code>{command}</code></pre><p className="mt-4 text-xs leading-6 text-zinc-500">{detail}</p></article>
}

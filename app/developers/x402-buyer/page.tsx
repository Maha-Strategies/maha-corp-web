import Link from 'next/link'

const source = 'https://github.com/Maha-Strategies/maha-corp-web/tree/codex/x402-observability-demand-20261012'
export const metadata = { title: 'x402 buyer and recovery guide | Maha Strategies', alternates: { canonical: '/developers/x402-buyer' } }
export default function Page() {
  return <main className="evidence-page"><div className="evidence-container"><section className="evidence-section evidence-copy">
    <Link href="/developers/x402-products">← x402 catalogue</Link>
    <h1 className="evidence-title mt-6">x402 buyer and recovery guide</h1>
    <p className="mt-6">The six demand tools use nested JSON POST requests and an input-bound authorization nonce. An unmodified exact-EVM buyer client generates a random nonce and is refused before work or settlement. The adapter below supports native-USDC EOA payments on Base and Arbitrum; it does not support smart-contract-wallet signatures.</p>
    <h2 className="evidence-section-title mt-8">Run the offline example first</h2>
    <p className="mt-4">Inspect the public source before running it. The example uses original synthetic CSV data, an unfunded public fixture key and mocked payment/network dependencies. It simulates a lost response and recovers with one signature and one mocked settlement. It accepts no live-payment option, reads no wallet key and sends no service payment.</p>
    <pre className="mt-4 overflow-x-auto rounded bg-black/10 p-4 text-sm"><code>{`git clone --single-branch --branch codex/x402-observability-demand-20261012 https://github.com/Maha-Strategies/maha-corp-web.git
cd maha-corp-web
npm ci --ignore-scripts
node --experimental-strip-types scripts/run-demand6-buyer-example.ts`}</code></pre>
    <p className="mt-4"><a className="evidence-link" href={`${source}/lib/x402/demand6/buyer.ts`}>Inspect the adapter ↗</a> · <a className="evidence-link" href={`${source}/scripts/run-demand6-buyer-example.ts`}>Inspect the runnable example ↗</a> · <a className="evidence-link" href={`${source}/test/x402-demand6-buyer.test.ts`}>Compatibility tests ↗</a></p>
    <h2 className="evidence-section-title mt-8">Live integration is explicitly authorized</h2>
    <p className="mt-4">Your application supplies a wallet signer, an exact spending cap and a durable encrypted private outbox. prepareDemandPurchase validates the input and live unpaid quote, builds the required hash and private recovery secret, requests one signature, and persists the resulting capsule before any paid submission. Never fund the example key.</p>
    <p className="mt-4">submitDemandPurchase sends only that saved capsule and cannot sign a new payment. If the response is lost, load the original capsule and explicitly submit it again for retained recovery within 24 hours. Never wrap recovery in a payment client that automatically generates another authorization. Keep the input and private headers unchanged.</p>
    <p className="mt-4">Each product’s free GET description gives its input/output schemas, examples, limitations and required headers. A POST without payment returns the authoritative 402 quote. Select Base (eip155:8453) or Arbitrum (eip155:42161), and check native USDC, payee, amount and authorization deadline before signing. Network fees are separate.</p>
    <h2 className="evidence-section-title mt-8">Read the outcome conservatively</h2>
    <p className="mt-4">provider_reported means a matching merchant settlement receipt, not independent chain confirmation. validated_response means a received body passes schema and digest checks, not factual correctness or provider-signed authenticity. Empty, invalid or absent output remains unresolved, even if payment is reported. Check the original transaction and contact support rather than repaying automatically.</p>
    <p className="mt-4">The optional X-Maha-Discovery-Source label measures a claimed discovery channel, not verified buyer identity. Recovery preserves the first label and does not create a new purchase record. See the <Link className="evidence-link" href="/developers/x402-privacy">data handling and retention notice</Link> before using real inputs.</p>
  </section></div></main>
}

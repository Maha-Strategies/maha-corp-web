import type { Metadata } from 'next'
import Link from 'next/link'
import { COMPATIBILITY_SAMPLES } from '@/lib/x402/compatibility-contracts'

export const metadata: Metadata = {
  title: 'Celestial and Evidence-Frame Compatibility Checks | Maha Strategies',
  description: 'Free explanations and structured examples for two proposed deterministic checks. Matching declarations are not proof of correctness or truth.',
  alternates: { canonical: '/tools/compatibility-checks' },
}
export default function CompatibilityChecksPage() {
  return <main className="evidence-page"><div className="evidence-container">
    <header className="max-w-5xl border-t border-[var(--border-default)] pt-5">
      <p className="evidence-kicker">Free explanations · versioned rules · bounded x402 checks</p>
      <h1 className="evidence-title evidence-title--product">Check the frame before judging the result.</h1>
      <p className="evidence-lede mt-7">Two bounded checks for structured declarations—not arbitrary prose. An unresolved result stays unresolved. A compatible result is not a certificate of correctness.</p>
      <nav className="mt-7 flex flex-wrap gap-4" aria-label="Compatibility products"><a className="evidence-link" href="#celestial">Check two results</a><a className="evidence-link" href="#evidence">Check this evidence relationship</a></nav>
    </header>
    <section id="celestial" className="evidence-section">
      <h2 className="evidence-section-title">Celestial Result Compatibility</h2>
      <p className="evidence-copy mt-4">Before saying another chart or astronomy system is wrong, compare what both say they calculated: body, Julian day and timescale, origin, observer, frame and epoch, zodiac, ayanamsa definition, apparent/geometric setting, and applicable node or house convention.</p>
      <p className="evidence-copy mt-4">One bounded comparison returns compatible declared conventions, incompatible declared conventions, or insufficient information. No timescale conversion, coordinate conversion, inferred defaults, ephemeris execution or predictive validation occurs.</p>
      <p className="evidence-copy mt-4">Price: 0.007 USDC per comparison through the x402 API. Explanations and example contracts are free.</p>
      <details className="mt-5"><summary className="cursor-pointer">Inspect the free synthetic example</summary><pre className="mt-4 max-w-full overflow-x-auto text-xs">{JSON.stringify(COMPATIBILITY_SAMPLES['celestial-result-compatibility'], null, 2)}</pre></details>
      <Link className="evidence-link mt-5 inline-block" href="/api/v1/micro/celestial-result-compatibility">Read the input/output contract</Link>
    </section>
    <section id="evidence" className="evidence-section">
      <h2 className="evidence-section-title">Evidence-Frame Compatibility</h2>
      <p className="evidence-copy mt-4">Compare up to ten explicit claim–evidence relationships against a finite rule set. A vendor statement can document the vendor’s position without becoming independent performance evidence. Later commentary is not automatically original wording; religious authority is not historical corroboration; a mathematical identity is not an empirical test.</p>
      <p className="evidence-copy mt-4">Each pair returns declared frames compatible, frame transfer not justified, or required information missing, with a rule and next evidence requirement. Unknown combinations do not pass. Dates mean evidence availability as of the claim date; retrospective historical evidence is assessed against separately declared event coverage.</p>
      <p className="evidence-copy mt-4">“Compatible” means potentially appropriate evidence category only. The service does not inspect sources, interpret prose, confirm quotations, authenticate evidence or determine truth.</p>
      <p className="evidence-copy mt-4">Price: 0.0105 USDC per batch of one to ten pairs through the x402 API. These are bounded Maha policy rules, not truth certification.</p>
      <details className="mt-5"><summary className="cursor-pointer">Inspect the free synthetic example</summary><pre className="mt-4 max-w-full overflow-x-auto text-xs">{JSON.stringify(COMPATIBILITY_SAMPLES['evidence-frame-compatibility'], null, 2)}</pre></details>
      <Link className="evidence-link mt-5 inline-block" href="/api/v1/micro/evidence-frame-compatibility">Read the input/output contract</Link>
    </section>
    <section className="evidence-section"><h2 className="evidence-section-title">Inspect the rules; keep the receipt.</h2>
      <p className="evidence-copy mt-4">The <Link href="/api/discovery/compatibility-rules" className="evidence-link">versioned rule sets</Link> are free to inspect. A receipt binds the submitted input, result and rule-set digest. It is not a signature, trusted timestamp or execution proof. Caller-specific execution will use x402 after release; save the response because these are stateless checks.</p>
      <p className="evidence-copy mt-4">Celestial terminology references: <a className="evidence-link" href="https://www.iausofa.org/current-software">IAU SOFA</a> and <a className="evidence-link" href="https://www.astro.com/swisseph/swephprg.htm">Swiss Ephemeris interface documentation</a>. Neither organization endorses these draft checks; no code from those libraries is included.</p>
    </section>
  </div></main>
}

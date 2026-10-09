import Link from 'next/link'
import { ORBITAL_BOUNDARY, ORBITAL_LENSES } from '@/lib/orbital-mind'
import s from '../astrology.module.css'
export const metadata = { title: 'The Orbital Mind | Maha Jyotisha', robots: { index: false, follow: false } }
export default function OrbitalSources() {
  return <main className={`${s.app} ${s.reading} ${s.orbitalSources}`}>
    <Link href="/astrology">← Return to the astrology app</Link>
    <h1>The Orbital Mind</h1>
    <p>A source guide to the app’s reflection lenses, adapted from Mayone Maha Rajan’s supplied manuscripts. These are curated paraphrases, not the full text.</p>
    <p>{ORBITAL_BOUNDARY}</p>
    {ORBITAL_LENSES.map(lens => <article id={lens.id} key={lens.id}><p className={s.eyebrow}>{lens.planets}</p><h2>{lens.functions}</h2><p>{lens.account}</p><p>Source: The Orbital Mind, {lens.locator}. PDF pages {lens.pages} in the supplied 212-page edition.</p><p>App exercise: {lens.experiment}</p><small>Exercises are Maha-authored adaptations. They are optional experiments, not prescriptions.</small></article>)}
    <article id="theory"><h2>Model, metaphor and evidence</h2><p>The Orbital Mind’s introduction distinguishes its structural account from a claim that planetary positions cause psychological events. Chapter XI warns against turning the vocabulary into a personality test and distinguishes its pattern-reading framework from clinical diagnosis.</p><p>Orbital Dynamics of the Self (July 2026), sections “The Functional Architecture,” “A Dynamical-Systems Formalization,” “A Research Program: Falsifiable Predictions” and “Limitations,” presents a proposed model, a cross-scale conjecture and ten untested predictions. The app does not estimate its equations, diagnose conditions or produce clinical warning scores.</p><p>Persistent distress or difficulty functioning deserves appropriate human support; the app’s reflection exercises do not replace clinical care.</p></article>
  </main>
}

import Link from 'next/link'
import CitizenFollowUp from '@/components/civic/CitizenFollowUp'
export const metadata = { title: 'Private civic follow-up | Maha Strategies', robots: { index: false, follow: false }, referrer: 'no-referrer' as const }
export default function FollowUpPage() {
  return <main className="evidence-page"><div className="evidence-container"><Link className="evidence-kicker" href="/civic#ai-safety">← Civic participation</Link><h1 className="evidence-title mt-10">Private case follow-up</h1><CitizenFollowUp /></div></main>
}

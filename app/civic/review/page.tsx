import Link from 'next/link'
import CivicReviewWorkbench from '@/components/civic/CivicReviewWorkbench'
export const metadata = { title: 'Civic review workspace | Maha Strategies', robots: { index: false, follow: false }, referrer: 'no-referrer' as const }
export default function ReviewPage() {
  return <main className="evidence-page"><div className="evidence-container"><Link href="/civic" className="evidence-kicker">← Civic intelligence</Link><h1 className="evidence-title mt-10">Participation review workspace</h1><CivicReviewWorkbench /></div></main>
}

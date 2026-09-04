import Link from 'next/link'

import { astrologyAnswerPath, getAstrologyAnswersForAuthority } from '@/lib/astrology-answer-graph'

export default function AuthorityAnswerLinks({ authorityId }: { authorityId: string }) {
  const answers = getAstrologyAnswersForAuthority(authorityId)
  if (answers.length === 0) return null

  return <section className="mt-12 border border-violet-900/60 bg-violet-950/10 p-6"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="font-mono text-[9px] uppercase tracking-widest text-violet-300">Used by the answer graph</p><h2 className="mt-2 text-xl font-semibold text-white">Questions that depend on this contract</h2></div><p className="font-mono text-[9px] uppercase tracking-widest text-zinc-600">{answers.length} bounded answer{answers.length === 1 ? '' : 's'}</p></div><div className="mt-5 grid gap-3 sm:grid-cols-2">{answers.map((answer) => <Link key={answer.slug} href={astrologyAnswerPath(answer)} className="border border-zinc-800 p-4 text-sm leading-6 text-zinc-300 hover:border-violet-500 hover:text-violet-200">{answer.question} →</Link>)}</div></section>
}

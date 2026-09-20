import type { ReactNode } from 'react'
import Link from 'next/link'
import { POLICY_DRAFTS } from '../../lib/policy-expansion-drafts'
import { POLICY_AREAS, POLICY_ISSUES, POLICY_METHODS, POLICY_POSITIONS } from '../../lib/policy-expansion-map'
import { policySource } from '../../lib/policy-expansion-sources'
import { POLICY_INTEREST_DISCLOSURE, POLICY_REVIEW_BASIS, POLICY_REVIEW_DATE, policyDraftPublished, policyDraftVisible, type PolicyDraft } from '../../lib/policy-expansion-types'
import PolicyQuestionSearch from './PolicyQuestionSearch'
import styles from './PolicyReader.module.css'

const questionUrl = (slug: string) => `/policy/questions/${slug}`
export function PolicyFrame({ children }: { children: ReactNode }) {
  return <main className={styles.reader} id="policy-content">
    <nav aria-label="Policy navigation"><Link href="/policy">Policy questions</Link><a href="https://policy.mahastrategies.com/">Inspect technical policy evidence ↗</a><Link href="/policy/methodology/sources-and-evidence">How these drafts are prepared</Link></nav>
    <p className={styles.notice}>An options library: these pages compare approaches without selecting one. Nothing here is an approved Maha position, a personal commitment, or a declaration of candidacy.</p>
    {children}
  </main>
}
export function PolicyExpansionEntrance() {
  // Published briefs everywhere; the four awaiting an evidence refresh appear
  // in development only, so the entrance never advertises a page that 404s.
  const visible = POLICY_DRAFTS.filter(d => policyDraftVisible(d, process.env.NODE_ENV))
  const entries = [
    ...visible.map(d => ({ title: d.question, description: d.readiness === 'options-brief' ? 'Compare mechanisms, costs, authority, objections and evidence gaps.' : 'Historical or partial baseline: current evidence must be refreshed before publication.', href: questionUrl(d.slug), area: POLICY_ISSUES.find(i => i.id === d.issue)!.area, label: `Options brief · ${d.status} · ${d.readiness === 'options-brief' ? 'for review' : 'evidence refresh required'}` })),
    ...POLICY_POSITIONS.filter(p => p.kind === 'existing-published-proposal').map(p => ({ title: p.title, description: p.summary, href: p.provenance, area: p.id === 'algorithmic-transparency-act' ? 'technology' : 'domestic', label: 'Existing published Maha proposal · not enacted law' })),
    ...POLICY_METHODS.map(m => ({ title: m.title, description: 'Review method, disclosure and limits.', href: `/policy/methodology/${m.slug}`, area: 'methodology', label: 'Methodology draft' })),
  ]
  return <PolicyFrame>
    <header><p className={styles.badge}>Public questions. Clear choices. Accountable answers.</p><h1>Policy choices that affect everyday life</h1><p className={styles.lead}>Understand the issue, compare options, and see what would justify changing course. {visible.length} briefs separate evidence from proposals and identify who could act.</p><p>No position here has been personally approved, and four further questions are withheld until their current legal and empirical baselines are refreshed. Existing Maha proposals are identified separately.</p></header>
    <nav aria-label="Policy areas" className={styles.section}>{POLICY_AREAS.map(a => <a href={`#${a.id}`} key={a.id}>{a.label}</a>)}</nav>
    <PolicyQuestionSearch entries={entries} areas={[...POLICY_AREAS]} />
    {POLICY_AREAS.map(a => <section className={styles.section} id={a.id} key={a.id} aria-labelledby={`${a.id}-title`}><h2 id={`${a.id}-title`}>{a.label}</h2><p>{a.description}</p><ul className={styles.cards}>{POLICY_ISSUES.filter(i => i.area === a.id).map(i => {
      const available = visible.filter(d => d.issue === i.id)
      return <li className={styles.card} key={i.id} id={`issue-${i.id}`}><h3>{i.title}</h3>{available.length ? <ul>{available.map(d => <li key={d.slug}><a href={questionUrl(d.slug)}>{d.question}</a><p>{policyDraftPublished(d) ? 'Options brief; not an approved position.' : 'Draft; evidence refresh required before publication.'}</p></li>)}</ul> : <p>Research planned. No new answer is available yet.</p>}{i.adjacent.filter(url => url.startsWith('https://')).map(url => <p key={url}><a href={url}>Inspect the related technical definition ↗</a></p>)}</li>
    })}</ul></section>)}
    <section className={styles.section} id="existing-philosophy"><h2>Existing proposals and philosophical background</h2><p>The five published proposals remain at their existing URLs. Their publication does not make their factual claims, cost assumptions or legal mechanisms independently reviewed.</p><ul>{POLICY_POSITIONS.filter(p => p.kind === 'existing-published-proposal').map(p => <li key={p.id}><a href={p.provenance}>{p.title}</a> — {p.gap}</li>)}</ul><details><summary>Read the philosophical context—not a legislative commitment</summary><p>Maha’s existing Saturnian and ecological-statecraft framing emphasizes limits, long horizons and ecological wellbeing. These are attributed values and metaphors, not empirical proof of policy effects.</p><p><a href="/books/the-maha-principle">The Maha Principle</a> is retained as a book reference. Its web edition currently reports publishing maintenance; no legislative position is inferred from it.</p></details></section>
    <section className={styles.section}><h2>Methods and transparency</h2><ul>{POLICY_METHODS.map(m => <li key={m.slug}><a href={`/policy/methodology/${m.slug}`}>{m.title}</a></li>)}</ul><p>{POLICY_REVIEW_BASIS}</p><p>{POLICY_INTEREST_DISCLOSURE}</p><p>Review snapshot: {POLICY_REVIEW_DATE}. Search demand and indexing status are unknown for the proposed pages.</p></section>
  </PolicyFrame>
}

const sections = [['answer', 'Short answer'], ['baseline', 'What the evidence establishes'], ['options', 'Options and mechanism'], ['authority', 'Who could act'], ['costs', 'Costs and who is affected'], ['objections', 'Strongest objection'], ['implementation', 'Implementation and tests'], ['sources', 'Sources and review']] as const
function References({ ids }: { ids: string[] }) { return <>{ids.map(id => <span key={id}> <a href={`#source-${id}`}>{policySource(id).title}</a></span>)}</> }

export function PolicyAnswerReader({ draft: d }: { draft: PolicyDraft }) {
  return <PolicyFrame><header><p className={styles.badge}>{d.status} · {policyDraftPublished(d) ? 'Options brief — not an approved position' : 'Evidence refresh required'}</p><h1>{d.question}</h1><p>Drafted {POLICY_REVIEW_DATE} · No personal position approval · Uncosted</p></header>
    <div className={styles.layout}><article>
      <section id="answer" className={styles.section}><h2>Short answer</h2><p className={styles.lead}>{d.answer}</p>{d.existingProposal && <p><a href={d.existingProposal}>Read the existing Maha proposal</a> — the new pilot option is not automatically part of it.</p>}</section>
      <section id="baseline" className={styles.section}><h2>What the evidence establishes</h2><p>Baseline: {d.baselineDate}. Access date is not the observation or effective date.</p>{d.baseline.map((claim, n) => <div key={n} className={styles.card}><p className={styles.badge}>{claim.kind.replaceAll('-', ' ')}</p><p>{claim.text}</p><p><References ids={claim.sources} /></p></div>)}</section>
      <section id="options" className={styles.section}><h2>Options and mechanism</h2><p className={styles.badge}>New options under consideration—not approved commitments</p><ul>{d.options.map(o => <li key={o}>{o}</li>)}</ul><h3>Proposed mechanism</h3><p>{d.mechanism}</p></section>
      <section id="authority" className={styles.section}><h2>Who could act</h2>{d.authority.map(a => <div key={a.actor}><h3>{a.actor}</h3><p>{a.role}</p><p><strong>{a.status === 'source-bounded' ? 'Bounded source support' : 'Requires legal review'}</strong><References ids={a.sources} /></p></div>)}</section>
      <section id="costs" className={styles.section}><h2>Costs and who is affected</h2><p><strong>Uncosted.</strong> No independent budget score or savings promise.</p><dl><dt>Cost assumptions</dt><dd>{d.costs.assumptions}</dd><dt>Funding</dt><dd>{d.costs.funding}</dd><dt>Distributional effects to assess</dt><dd>{d.costs.distribution}</dd><dt>Uncertainty</dt><dd>{d.costs.uncertainty}</dd></dl></section>
      <section id="objections" className={styles.section}><h2>Strongest objection</h2><p>{d.objection}</p><h3>A reasonable alternative</h3><p>{d.alternative}</p><p>These are reasoned objections prepared for review, not an invented consensus or an attributed opponent’s statement.</p></section>
      <section id="implementation" className={styles.section}><h2>Implementation and tests</h2><ol>{d.sequence.map(s => <li key={s}>{s}</li>)}</ol><h3>Outcomes to measure</h3><ul>{d.outcomes.map(o => <li key={o}>{o}</li>)}</ul><h3>Failure conditions and reasons to reconsider</h3><ul>{d.reconsider.map(r => <li key={r}>{r}</li>)}</ul></section>
      <section id="sources" className={styles.section}><h2>Sources and review</h2><p>{POLICY_REVIEW_BASIS}</p><h3>Unresolved before publication</h3><ul>{d.gaps.map(g => <li key={g}>{g}</li>)}</ul>{d.sources.map(id => { const s = policySource(id); return <details id={`source-${id}`} key={id}><summary>{s.title}</summary><p><a href={s.url}>Open source ↗</a></p><dl><dt>Exact locator</dt><dd>{s.locator}</dd><dt>Version and inspection</dt><dd>{s.version}; section inspected {s.inspected}.</dd><dt>Supports</dt><dd>{s.supports}</dd><dt>Does not establish</dt><dd>{s.limitation}</dd><dt>Rights boundary</dt><dd>{s.rights}</dd></dl></details> })}<details><summary>Revision history and interests</summary><p>v1 · {POLICY_REVIEW_DATE}: initial options brief and source-bound baseline; no prior decision or review inherited.</p><p>{POLICY_INTEREST_DISCLOSURE}</p></details></section>
      <section className={styles.section}><h2>Related questions</h2><ul>{d.related.map(slug => { const related = POLICY_DRAFTS.find(x => x.slug === slug)!; return <li key={slug}><a href={questionUrl(slug)}>{related.question}</a></li> })}</ul></section>
    </article><aside className={styles.contents} aria-label="On this page"><details open><summary>On this page</summary><nav>{sections.map(([id, title]) => <a key={id} href={`#${id}`}>{title}</a>)}</nav></details></aside></div>
  </PolicyFrame>
}

export function PolicyMethodReader({ slug }: { slug: string }) {
  const method = POLICY_METHODS.find(m => m.slug === slug)
  if (!method) throw new Error('unknown-policy-method')
  return <PolicyFrame><h1>{method.title}</h1>{method.paragraphs.map(p => <p key={p}>{p}</p>)}<section className={styles.section}><h2>Review and interests</h2><p>{POLICY_REVIEW_BASIS}</p><p>{POLICY_INTEREST_DISCLOSURE}</p><p>v1 · {POLICY_REVIEW_DATE}. All four methodology drafts require editorial approval.</p></section></PolicyFrame>
}

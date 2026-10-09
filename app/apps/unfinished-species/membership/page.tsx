import type { Metadata } from 'next'
import Link from 'next/link'
import { ATLAS_PATH } from '@/lib/unfinished-atlas'
import s from '../atlas.module.css'
export const metadata: Metadata = { title:'Membership', alternates:{canonical:ATLAS_PATH + '/membership'} }
const plans = [
  { name:'Explorer', price:'Free', unit:'in v1.0.0', description:'A place to begin, and room to go deeper.', features:['All ten Atlas briefs and original source links','The complete open-edition book','Source guide and browser-local saved collection'], state:'Available now' },
  { name:'Member', price:'$15', unit:'/ month · proposed', description:'Follow the science as it moves forward.', features:['Planned: new evidence briefs and topic updates','Planned: structured learning paths','Planned: expanded AI companion allowance'], state:'Planned membership' },
  { name:'Research team', price:'$250', unit:'/ month · proposed', description:'Turn reading into a shared research workflow.', features:['Planned: shared collections and annotations','Planned: research comparisons and exports','Planned: monitored topics and team access'], state:'Planned team plan' },
]
export default function MembershipPage() {
  return <><p className={s.eyebrow}>SUPPORT A MORE INFORMED FUTURE</p><h1 className={s.pageTitle}>Curiosity is the beginning.</h1><p className={s.lede}>Version 1.0.0 is free to explore. The proposed memberships below show how the product could sustain ongoing editorial work and research preparation.</p><div className={s.sectionHeader}><h2>A model we can build together</h2><p>No paid checkout in this release</p></div><div className={s.grid}>{plans.map((plan, i) => <section key={plan.name} className={`${s.panel} ${i === 1 ? s.featured : ''}`}><p className={s.eyebrow}>{plan.state}</p><h2>{plan.name}</h2><div className={s.price}>{plan.price}<br /><small>{plan.unit}</small></div><p>{plan.description}</p><ul>{plan.features.map(feature => <li key={feature}>{feature}</li>)}</ul><div className={s.actions}>{i === 0 ? <Link className={s.primary} href={ATLAS_PATH}>Start exploring →</Link> : <a className={s.secondary} href={'mailto:mayone@mahastrategies.com?subject=' + encodeURIComponent('Unfinished Species ' + plan.name + ' interest')}>Discuss this plan →</a>}</div></section>)}</div><p className={s.bottomNote}>Prices are hypotheses for customer conversations, not active offers. Membership would purchase product access; it would not confer equity, ownership of research, or a financial return. No fixed share of revenue is currently committed to research.</p></>
}

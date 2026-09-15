import type { Metadata } from 'next'
import Link from 'next/link'
import { ROBOTICS_PATH, roboticsCandidateMap } from '@/lib/robotics-knowledge'

const TITLE = 'Robotics evidence and evaluation'
const DESCRIPTION = 'Forty guides and examples for robot task evaluation, provenance, human assistance and governance.'
const CANONICAL = `https://www.mahastrategies.com${ROBOTICS_PATH}`
export const metadata: Metadata = { title: `${TITLE} | Maha Strategies`, description: DESCRIPTION, alternates: { canonical: CANONICAL }, openGraph: { type: 'website', title: TITLE, description: DESCRIPTION, url: CANONICAL, siteName: 'Maha Strategies' } }
export default function RoboticsHub() {
  return <main className="mx-auto max-w-4xl space-y-8 px-6 py-12">
    <nav aria-label="Breadcrumb"><Link href="/knowledge" prefetch={false}>Knowledge</Link> / Robotics</nav>
    <header><p>Evidence-engineering guides · automated editorial preparation, not expert review</p><h1 className="text-3xl font-semibold">Robotics evidence and evaluation</h1></header>
    <p>What did a robot accomplish, under which conditions, with how much assistance—and what can another team actually verify? These guides develop evidence infrastructure for answering those questions. Humanoid shape alone is not proof of useful capability.</p>
    <p>Forty topic pages cover foundations, evaluation, provenance, assistance, governance and worked examples. This is an evidence-engineering collection, not a safety assessment, certification service or hardware benchmark. The ROS and LeRobot walkthroughs are specifications, not operational adapters.</p>
    <section><h2 className="text-2xl font-semibold">Start with a question</h2><ul className="list-disc space-y-3 pl-6"><li><a className="underline" href={`${ROBOTICS_PATH}/assistive-task-selection`}>Would this task actually help someone?</a></li><li><a className="underline" href={`${ROBOTICS_PATH}/benchmark-selection`}>What should we evaluate before trusting a demonstration?</a></li><li><a className="underline" href={`${ROBOTICS_PATH}/pick-place-example`}>What can a reproducible evidence check establish?</a></li></ul></section>
    {Object.entries({ foundations: 'Foundations · 8 pages', evaluation: 'Evaluation · 10 pages', provenance: 'Provenance and data · 8 pages', assistance: 'Human assistance · 6 pages', governance: 'Governance · 4 pages', examples: 'Specifications and examples · 4 pages' }).map(([group, label]) => <section key={group} id={group}><h2 className="text-2xl font-semibold">{label}</h2><ul className="list-disc space-y-3 pl-6">{roboticsCandidateMap().filter(a => a.group === group).map(a => <li key={a.slug}><a className="underline" href={`${ROBOTICS_PATH}/${a.slug}`}>{a.title}</a></li>)}</ul></section>)}
    <section><h2 className="text-2xl font-semibold">Relationship to the wider knowledge system</h2><p>Use <Link className="underline" href="/knowledge/mathematics" prefetch={false}>mathematics</Link> for formal foundations and <Link className="underline" href="/governed-workflow" prefetch={false}>governed workflows</Link> for the broader evidence boundary. Robotics applies those ideas to task observations; it does not turn a consistency check into physical approval.</p><p>Sources are linked with exact section locators. Workflows are Maha proposals; examples are synthetic unless explicitly stated otherwise. Search demand has not been measured for this collection.</p></section>
  </main>
}

import type { Metadata } from 'next'
import Link from 'next/link'
import KnowledgeHub from '@/components/knowledge/KnowledgeHub'
import { ROBOTICS_PATH, ROBOTICS_ARTICLES, roboticsCandidateMap } from '@/lib/robotics-knowledge'
const TITLE = 'Robotics evidence and evaluation'
const DESCRIPTION = 'Forty guides and examples for robot task evaluation, provenance, human assistance and governance.'
const CANONICAL = `https://www.mahastrategies.com${ROBOTICS_PATH}`
export const metadata: Metadata = { title: `${TITLE} | Maha Strategies`, description: DESCRIPTION, alternates: { canonical: CANONICAL }, openGraph: { type: 'website', title: TITLE, description: DESCRIPTION, url: CANONICAL, siteName: 'Maha Strategies' } }
const clusters = [
  { id: 'foundations', title: 'Foundations', description: 'Define capability, tasks, perception and control before interpreting a demonstration.' },
  { id: 'evaluation', title: 'Evaluation', description: 'Choose benchmarks and keep failures, interventions and conditions visible.' },
  { id: 'provenance', title: 'Provenance and data', description: 'Trace data, versions and observations without overstating what a record proves.' },
  { id: 'assistance', title: 'Human assistance', description: 'Evaluate useful tasks and preserve the role of human support.' },
  { id: 'governance', title: 'Governance', description: 'Make permissions, accountability and release boundaries explicit.' },
  { id: 'examples', title: 'Specifications and examples', description: 'Inspect bounded contracts and a reproducible synthetic experiment.' },
]
export default function RoboticsHub() {
  const candidates = roboticsCandidateMap()
  const cards = candidates.map(c => ({ href: `${ROBOTICS_PATH}/${c.slug}`, title: c.title, description: ROBOTICS_ARTICLES.find(a => a.slug === c.slug)?.answer ?? (c.slug === 'pick-place-example' ? 'Inspect a deterministic grid-world experiment. Simulation is not a hardware test.' : 'Inspect the required fields, replay contract and limits of an evidence package.'), label: c.status === 'local-prototype' ? 'Synthetic prototype' : 'Editorial guide' }))
  return <KnowledgeHub title="Robotics evidence and evaluation" breadcrumb="Robotics" eyebrow="Tasks · observations · human assistance"
    introduction="What did a robot accomplish, under which conditions, with how much assistance—and what can another team actually verify?"
    boundary="Automated editorial preparation, not expert review. Simulation evidence is not physical safety validation; ROS and LeRobot walkthroughs are specifications, not operational adapters."
    groups={clusters.map(g => ({ ...g, cards: cards.filter((_, i) => candidates[i].group === g.id) }))}
    featured={['assistive-task-selection', 'benchmark-selection', 'pick-place-example'].map(slug => cards.find(c => c.href === `${ROBOTICS_PATH}/${slug}`)!)}
    related={[
      { href: '/knowledge/physical-ai', title: 'Physical AI', description: 'Explore learned models, training and control.' },
      { href: '/knowledge/nanotechnology', title: 'Nanotechnology', description: 'Inspect materials and measurement evidence.' },
      { href: '/knowledge/computational-architecture', title: 'Computational Architecture', description: 'Connect physical systems to building models and reproducible design evidence.' },
      { href: '/knowledge/mathematics', title: 'Mathematics', description: 'Explore the formal foundations behind calculations and evaluations.' },
      { href: '/governed-workflow', title: 'Governed workflows', description: 'Keep execution evidence separate from permission and substantive correctness.' },
    ]}>
      <section><h2>How the domains connect</h2><p><Link href="/knowledge/physical-ai" prefetch={false}>Physical AI</Link> covers learned models and control. Robotics retains hardware evaluation and safety boundaries. <Link href="/knowledge/nanotechnology" prefetch={false}>Nanotechnology</Link> covers the materials and measurement layer beneath sensors and actuators.</p></section>
    </KnowledgeHub>
}

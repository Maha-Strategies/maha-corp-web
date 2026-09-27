import type { Metadata } from 'next'
import KnowledgeHub, { type HubGroup } from '@/components/knowledge/KnowledgeHub'
import { ARCHITECTURE_PATH, architectureArticles } from '@/lib/computational-architecture'
export const metadata: Metadata = { title: 'Computational Architecture & Building Performance | Maha Strategies', description: 'Understand building models, simulation evidence and design assumptions. Explore twelve guides and a browser-local program-area checker.', alternates: { canonical: `https://www.mahastrategies.com${ARCHITECTURE_PATH}` } }
const clusters = [
  { id: 'design-foundations', title: 'Design foundations', description: 'Define the question, the geometry and the information a model must preserve.', slugs: ['what-computational-architecture-establishes', 'parametric-geometry', 'requirements-and-decisions', 'bim-and-ifc'] },
  { id: 'performance-studies', title: 'Performance studies', description: 'Inspect energy, light, airflow and material comparisons without confusing simulations with measurements.', slugs: ['energy-simulation', 'daylight-and-glare', 'ventilation-and-controls', 'material-comparison-boundaries'] },
  { id: 'checks-and-evidence', title: 'Checks and evidence', description: 'Try a calculation, challenge assumptions and preserve the boundary of each result.', slugs: ['program-area-checker', 'model-checking-and-compliance', 'sensitivity-and-tradeoffs', 'design-evidence-package'] },
]
export default function ArchitectureHub() {
  const card = (slug: string) => {
    const a = architectureArticles.find(a => a.slug === slug)!
    return { href: `${ARCHITECTURE_PATH}/${slug}`, title: a.title, description: a.answer, label: slug === 'program-area-checker' ? 'Interactive example' : a.sources.length ? 'Source-linked guide' : 'Maha-authored method' }
  }
  const groups: HubGroup[] = clusters.map(g => ({ ...g, cards: g.slugs.map(card) }))
  return <KnowledgeHub title="Computational Architecture & Building Performance" breadcrumb="Computational Architecture" eyebrow="Building models · simulation · evidence"
    introduction="Connect building questions to explicit models, inspectable assumptions and reproducible calculations."
    boundary="Buildings, not processor architecture. Tool capabilities and authored methods are distinct; no professional certification or building performance is implied."
    groups={groups} featured={['program-area-checker', 'design-evidence-package', 'model-checking-and-compliance'].map(card)}
    related={[
      { href: '/knowledge/mathematics', title: 'Mathematics', description: 'Explore the quantitative foundations behind models and calculations.' },
      { href: '/knowledge/robotics', title: 'Robotics', description: 'Connect models to task evaluation and physical-system evidence.' },
      { href: '/governed-workflow', title: 'Governed workflows', description: 'Separate evidence, authority and decisions.' },
    ]} />
}

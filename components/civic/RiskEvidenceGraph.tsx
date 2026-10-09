import type { RiskGraph } from '@/lib/civic/workspace-types'
import styles from './CivicDashboard.module.css'

export default function RiskEvidenceGraph({ graph }: { graph: RiskGraph }) {
  return <div>
    <h3>AI risk evidence graph</h3><span className={styles.badge}>{graph.classification.replaceAll('-', ' ')}</span>
    <p>{graph.classificationRationale}</p><p className={styles.muted}>Classification records an assessment, not a factual certification. Reported observed harm and a potential hazard have different evidence requirements.</p>
    <div className={styles.graphCards}>{graph.nodes.map(node => <article key={node.id} className={styles.result}>
      <p className={styles.eyebrow}>{node.kind} · {node.id}</p><p>{node.text}</p>
      {node.source && <><a href={node.source.url} target="_blank" rel="noreferrer">{node.source.citation} ↗</a><p className={styles.muted}>{node.source.verification.replaceAll('-', ' ')} · published {node.source.publishedOn ?? 'unknown'} · checked {node.source.checkedOn ?? 'not read'}</p>{node.source.contentDigest && <code className={styles.digest}>{node.source.contentDigest}</code>}</>}
    </article>)}</div>
    {graph.edges.length > 0 && <div className={styles.tableScroll}><table className={styles.economicTable}><caption>Evidence relationships</caption><thead><tr><th>From</th><th>Relationship</th><th>To</th><th>Rationale</th></tr></thead><tbody>{graph.edges.map((edge, i) => <tr key={i}><td>{edge.from}</td><td>{edge.relation}</td><td>{edge.to}</td><td>{edge.rationale}</td></tr>)}</tbody></table></div>}
    <p className={styles.muted}>Structure informed by the <a href="https://www.oecd.org/en/publications/towards-a-common-reporting-framework-for-ai-incidents_f326d4ac-en.html" target="_blank" rel="noreferrer">OECD incident-reporting framework</a>; this is not an OECD validation or a complete implementation of its reporting criteria.</p>
  </div>
}

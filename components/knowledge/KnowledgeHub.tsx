import Link from 'next/link'
import type { ReactNode } from 'react'
import styles from './KnowledgeHub.module.css'

export type HubCard = { href: string; title: string; description: string; label?: string }
export type HubGroup = { id: string; title: string; description: string; cards: HubCard[] }
type Props = { title: string; breadcrumb: string; eyebrow: string; introduction: string; boundary: string; groups: HubGroup[]; featured: HubCard[]; related: HubCard[]; children?: ReactNode }

/** Shared, server-rendered discovery surface. No hidden items or JS-only links. */
export default function KnowledgeHub({ title, breadcrumb, eyebrow, introduction, boundary, groups, featured, related, children }: Props) {
  const total = groups.reduce((n, g) => n + g.cards.length, 0)
  return <main className={styles.hub}>
    <nav className={styles.breadcrumb} aria-label="Breadcrumb"><Link href="/knowledge" prefetch={false}>Knowledge</Link><span aria-hidden="true"> / </span><span>{breadcrumb}</span></nav>
    <header className={styles.hero}>
      <div><p className={styles.eyebrow}>{eyebrow}</p><h1>{title}</h1><p className={styles.introduction}>{introduction}</p></div>
      <aside className={styles.summary} aria-label="Collection scope"><p className={styles.eyebrow}>Explore this collection</p><p className={styles.count}>{total} <span>guides and examples</span></p><p>{groups.length} connected topic groups</p><p className={styles.boundary}>{boundary}</p></aside>
    </header>
    <nav className={styles.jump} aria-label="Topic groups">{groups.map(g => <a key={g.id} href={`#${g.id}`}>{g.title}<span>{g.cards.length}</span></a>)}</nav>
    <section className={styles.section} aria-labelledby="start-here"><div className={styles.sectionHeading}><h2 id="start-here">Start with a question</h2><p>Choose a useful entry point</p></div><CardGrid cards={featured} headingLevel={3} /></section>
    {groups.map(g => <section key={g.id} id={g.id} className={styles.section} aria-labelledby={`${g.id}-title`}><div className={styles.sectionHeading}><h2 id={`${g.id}-title`}>{g.title}</h2><p>{g.cards.length} articles</p></div><p className={styles.groupDescription}>{g.description}</p><CardGrid cards={g.cards} headingLevel={3} /></section>)}
    <section className={styles.section} aria-labelledby="connected-domains"><div className={styles.sectionHeading}><h2 id="connected-domains">Connected knowledge</h2><p>Continue across domains</p></div><CardGrid cards={related} headingLevel={3} /></section>
    {children}
    <Link className={styles.back} href="/knowledge" prefetch={false}>← Explore all knowledge domains</Link>
  </main>
}

function CardGrid({ cards, headingLevel }: { cards: HubCard[]; headingLevel: 3 }) {
  const Heading = `h${headingLevel}` as const
  return <ul className={styles.grid}>{cards.map(card => <li key={card.href}><Link className={styles.card} href={card.href} prefetch={false}>{card.label && <p className={styles.eyebrow}>{card.label}</p>}<Heading>{card.title}</Heading><p className={styles.description}>{card.description}</p><span className={styles.action}>Explore <span aria-hidden="true">→</span></span></Link></li>)}</ul>
}

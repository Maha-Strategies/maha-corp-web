'use client'
import Link from 'next/link'
import { useState } from 'react'
import { ATLAS_PATH, atlasTopics, filterTopics, type Register } from '@/lib/unfinished-atlas'
import { SaveButton, useCollection } from './Collection'
import { BiologyArt, Icon } from './Visuals'
import s from './atlas.module.css'
export function Badge({ register }: { register: Register }) { return <span className={s.badge} data-register={register}>{register}</span> }
export default function AtlasExplorer({ savedOnly = false }: { savedOnly?: boolean }) {
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('All')
  const [register, setRegister] = useState('All')
  const saved = useCollection()
  const topics = filterTopics(query, category, register, savedOnly ? saved : undefined)
  return <section aria-label={savedOnly ? 'Saved topics' : 'Explore topics'}>
    <div className={s.sectionHeader}><h2>{savedOnly ? 'Your saved explorations' : 'Explore the frontier'}</h2><p aria-live="polite">{topics.length} {topics.length === 1 ? 'topic' : 'topics'} · {savedOnly ? 'Saved on this browser' : 'Follow your curiosity'}</p></div>
    <div className={s.filters}>
      <label className={s.search}><Icon name="search" size={16} /><input aria-label="Search topics" placeholder="Search proteins, epigenetics, quantum…" value={query} onChange={event => setQuery(event.target.value)} /></label>
      <div className={s.segments} aria-label="Topic category">{['All', 'Read', 'Model', 'Design'].map(value => <button key={value} type="button" aria-pressed={category === value} onClick={() => setCategory(value)}>{value}</button>)}</div>
      <select className={s.select} aria-label="Evidence register" value={register} onChange={event => setRegister(event.target.value)}>{['All', 'Established', 'Inferred', 'Speculative'].map(value => <option key={value} value={value}>{value === 'All' ? 'All evidence' : value}</option>)}</select>
    </div>
    {topics.length ? <div className={s.grid}>{topics.map(topic => <article className={s.card} key={topic.slug}>
      <div className={s.cardArt} data-category={topic.category} data-register={topic.register}><BiologyArt variant={atlasTopics.indexOf(topic)} /><span className={s.artLabel}>{topic.category.toUpperCase()} THE SUBSTRATE</span></div>
      <div className={s.cardBody}><div className={s.cardMeta}><Badge register={topic.register} /><SaveButton slug={topic.slug} /></div><h3 className={s.cardTitle}><Link href={ATLAS_PATH + '/topics/' + topic.slug}>{topic.title}</Link></h3><p className={s.cardSubtitle}>{topic.subtitle}</p><p className={s.cardText}>{topic.summary}</p><div className={s.cardFoot}><span>{topic.horizon}</span><Link href={ATLAS_PATH + '/topics/' + topic.slug} aria-label={`Explore ${topic.subtitle}`}>Explore ↗</Link></div></div>
    </article>)}</div> : <div className={s.empty}><p>{savedOnly && !saved.length ? 'Save a topic in the Atlas to start your collection.' : 'No topics match these filters.'}</p><div className={s.actions} style={{ justifyContent: 'center' }}><button className={s.secondary} onClick={() => { setQuery(''); setCategory('All'); setRegister('All') }}>Reset filters</button>{savedOnly && <Link href={ATLAS_PATH} className={s.primary}>Explore the Atlas</Link>}</div></div>}
  </section>
}

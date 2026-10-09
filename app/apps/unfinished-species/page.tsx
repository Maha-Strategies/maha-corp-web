import Link from 'next/link'
import { ATLAS_PATH, ATLAS_DATE, atlasTopics } from '@/lib/unfinished-atlas'
import AtlasExplorer from './AtlasExplorer'
import { BiologyArt, Icon } from './Visuals'
import s from './atlas.module.css'
export default function AtlasPage() {
  return <>
    <section className={s.hero}><div className={s.heroCopy}><p className={s.eyebrow}>THE UNFINISHED SPECIES / AN OPEN EXPLORATION</p><h1>Life is still being written.<br /><em>Let’s understand what’s next.</em></h1><p className={s.lede}>A field guide to the meeting of biology and artificial intelligence. Explore what we can do today, what comes next, and where the evidence ends.</p><div className={s.actions}><Link href="#explore" className={s.primary}>Explore the Atlas <Icon name="arrow" size={16} /></Link><Link href={ATLAS_PATH + '/companion'} className={s.secondary}>Ask the companion <Icon name="companion" size={16} /></Link></div></div><div className={s.heroArt} style={{ color:'#67875b' }}><BiologyArt /></div></section>
    <div className={s.stats}><span><b>{atlasTopics.length}</b> frontier topics</span><span><b>11</b> book chapters</span><span><b>3</b> evidence registers</span><span><b>1</b> shared question: what becomes possible?</span></div>
    <div className={s.legend}><strong>Curiosity, with an evidence compass.</strong><span>● Established · demonstrated</span><span>● Inferred · argued from evidence</span><span>● Speculative · a future possibility</span></div>
    <div id="explore"><AtlasExplorer /></div>
    <p className={s.bottomNote}>Editorial source check: {ATLAS_DATE}. Briefs are curated snapshots, not a live news feed. Forecasts are editorial scenarios, not promised delivery dates. Read each brief’s limits and original sources.</p>
    <div className={s.sectionHeader}><h2>From understanding to investigation</h2></div><div className={s.callout}><p className={s.eyebrow}>THE RESEARCH STUDIO · PROPOSED PROGRAM</p><h2>What if we could test the possibility?</h2><p>Our first proposed project compares AI-assisted enzyme selection with a conventional baseline. Follow the question, the planned evaluation, and the milestones needed before any result can be claimed.</p><Link href={ATLAS_PATH + '/research'} className={s.secondary}>See the research roadmap <Icon name="arrow" size={15} /></Link></div>
  </>
}

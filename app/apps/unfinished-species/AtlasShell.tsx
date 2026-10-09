'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ATLAS_PATH, ATLAS_VERSION } from '@/lib/unfinished-atlas'
import { Icon } from './Visuals'
import s from './atlas.module.css'
const nav = [['', 'The Atlas', 'atlas'], ['/book', 'The book', 'book'], ['/companion', 'Companion', 'companion'], ['/research', 'Research studio', 'research'], ['/saved', 'My collection', 'save'], ['/membership', 'Membership', 'member'], ['/company', 'The company', 'company']]
export default function AtlasShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  return <div className={s.root}><div className={s.shell}>
    <aside className={s.sidebar}>
      <Link href={ATLAS_PATH} className={s.brand}><span className={s.brandMark}><Icon name="research" size={23} /></span><span>Unfinished Species<small>BIOLOGY × INTELLIGENCE</small></span></Link>
      <div><p className={s.navLabel}>Your field guide</p><nav className={s.nav} aria-label="Unfinished Species workspace">{nav.map(([path, label, icon]) => {
        const active = path ? pathname.startsWith(ATLAS_PATH + path) : pathname === ATLAS_PATH || pathname.startsWith(ATLAS_PATH + '/topics')
        return <Link key={label} href={ATLAS_PATH + path} aria-current={active ? 'page' : undefined}><Icon name={icon} />{label}</Link>
      })}</nav></div>
      <div className={s.sideNote}><strong>The future deserves a closer look.</strong>Understand the science.<br />Question the possibilities.<br />Follow what comes next.<p style={{ marginTop: 20 }}>Maha Strategies · v{ATLAS_VERSION}</p></div>
    </aside>
    <div className={s.content}><header className={s.topbar}><span><span className={s.liveDot} />A field guide to biology &amp; AI</span><Link href={ATLAS_PATH + '/book'}>Inspired by the book <Icon name="arrow" size={14} /></Link></header><main className={s.main}>{children}</main></div>
  </div></div>
}

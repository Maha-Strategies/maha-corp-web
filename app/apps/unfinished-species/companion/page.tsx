import type { Metadata } from 'next'
import { ATLAS_PATH, findTopic } from '@/lib/unfinished-atlas'
import { atlasAiConfigured } from '@/lib/unfinished-atlas-companion'
import Companion from './Companion'
import s from '../atlas.module.css'
export const metadata: Metadata = { title:'Book companion', alternates:{canonical:ATLAS_PATH + '/companion'} }
export default async function CompanionPage({ searchParams }: { searchParams:Promise<{topic?:string}> }) {
  const topic = findTopic((await searchParams).topic || '')
  return <><p className={s.eyebrow}>A CONVERSATION WITH THE POSSIBILITIES</p><h1 className={s.pageTitle}>Begin with a better question.</h1><p className={s.lede}>Find the book passages and scientific briefs behind an idea. Follow the sources, explore the limits, and keep established science separate from what we imagine next.</p><Companion key={topic?.slug || 'general'} aiEnabled={atlasAiConfigured()} topic={topic ? {slug:topic.slug,subtitle:topic.subtitle} : undefined} /></>
}

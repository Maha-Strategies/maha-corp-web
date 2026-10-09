import type { Metadata } from 'next'
import AtlasExplorer from '../AtlasExplorer'
import s from '../atlas.module.css'
export const metadata: Metadata = { title:'My collection', alternates:{canonical:'/apps/unfinished-species/saved'} }
export default function SavedPage() { return <><p className={s.eyebrow}>YOUR FIELD NOTES</p><h1 className={s.pageTitle}>Keep your curiosity close.</h1><p className={s.lede}>A collection of the possibilities you want to explore. Saved topics stay on this browser; there is no account or cloud sync in version 1.0.0.</p><AtlasExplorer savedOnly /></> }

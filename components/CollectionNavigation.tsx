import Link from 'next/link'
import { collectionLabel, directCollectionChildren } from '@/lib/collection-hubs'
import { COLLECTION_HUB_PATHS } from '@/lib/collection-hub-paths'

export function CollectionParentLink({ path }: { path: string }) {
  const parent = COLLECTION_HUB_PATHS.filter(p => path.startsWith(p + '/')).sort((a, b) => b.length - a.length)[0]
  return parent ? <nav aria-label="Collection" className="my-5 text-sm"><Link href={parent} prefetch={false} className="underline underline-offset-4">← {collectionLabel(parent)}</Link></nav> : null
}

export function CollectionNavigation({ parent }: { parent: string }) {
  const paths = directCollectionChildren(parent)
  if (!paths.length) return null
  return <nav aria-label="Related collections" className="my-8 rounded border border-[var(--border-default)] p-5">
    <h2 className="text-lg font-semibold">Explore this collection</h2>
    <ul className="mt-4 grid gap-3 sm:grid-cols-2">{paths.map(path => <li key={path}><Link href={path} prefetch={false} className="evidence-link">{collectionLabel(path)}</Link></li>)}</ul>
  </nav>
}

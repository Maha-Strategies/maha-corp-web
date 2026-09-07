import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import FederationReleasedPage from '@/components/federation/FederationReleasedPage'
import { federationPathsMatching, getFederationPublishedPage } from '@/lib/federation-publication'

export function federationParams(pattern: RegExp, names: readonly string[]) {
  return federationPathsMatching(pattern).map((path) => {
    const match = path.match(pattern)
    if (!match) throw new Error(`federation-static-param-mismatch:${path}`)
    return Object.fromEntries(names.map((name, index) => [name, match[index + 1]]))
  })
}

export function federationMetadata(path: string): Metadata {
  const page = getFederationPublishedPage(path)
  if (!page) return {}
  return {
    title: `${page.title} | Maha`,
    description: page.directAnswer,
    alternates: { canonical: page.canonicalUrl },
    openGraph: { title: page.title, description: page.directAnswer, url: page.canonicalUrl, type: 'article' },
  }
}

export function renderFederationPage(path: string) {
  const page = getFederationPublishedPage(path)
  if (!page) notFound()
  return <FederationReleasedPage page={page} />
}

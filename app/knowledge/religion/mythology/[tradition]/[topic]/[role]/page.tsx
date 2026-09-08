import { federationMetadata, federationParams, renderFederationPage } from '@/lib/federation-route-page'
type Props = { params: Promise<{ tradition: string; topic: string; role: string }> }
const pattern = /^\/knowledge\/religion\/mythology\/([^/]+)\/([^/]+)\/([^/]+)$/
export const dynamicParams = false
export const generateStaticParams = () => federationParams(pattern, ['tradition', 'topic', 'role'])
export async function generateMetadata({ params }: Props) { const p = await params; return federationMetadata(`/knowledge/religion/mythology/${p.tradition}/${p.topic}/${p.role}`) }
export default async function Page({ params }: Props) { const p = await params; return renderFederationPage(`/knowledge/religion/mythology/${p.tradition}/${p.topic}/${p.role}`) }

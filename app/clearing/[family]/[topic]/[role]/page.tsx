import { federationMetadata, federationParams, renderFederationPage } from '@/lib/federation-route-page'
type Props = { params: Promise<{ family: string; topic: string; role: string }> }
const pattern = /^\/clearing\/([^/]+)\/([^/]+)\/([^/]+)$/
export const dynamicParams = false
export const generateStaticParams = () => federationParams(pattern, ['family', 'topic', 'role'])
export async function generateMetadata({ params }: Props) { const p = await params; return federationMetadata(`/clearing/${p.family}/${p.topic}/${p.role}`) }
export default async function Page({ params }: Props) { const p = await params; return renderFederationPage(`/clearing/${p.family}/${p.topic}/${p.role}`) }

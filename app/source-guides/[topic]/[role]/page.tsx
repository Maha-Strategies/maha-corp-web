import { federationMetadata, federationParams, renderFederationPage } from '@/lib/federation-route-page'
type Props = { params: Promise<{ topic: string; role: string }> }
const pattern = /^\/source-guides\/([^/]+)\/([^/]+)$/
export const dynamicParams = false
export const generateStaticParams = () => federationParams(pattern, ['topic', 'role'])
export async function generateMetadata({ params }: Props) { const p = await params; return federationMetadata(`/source-guides/${p.topic}/${p.role}`) }
export default async function Page({ params }: Props) { const p = await params; return renderFederationPage(`/source-guides/${p.topic}/${p.role}`) }

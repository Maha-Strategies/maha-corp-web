import { federationMetadata, federationParams, renderFederationPage } from '@/lib/federation-route-page'
type Props = { params: Promise<{ topic: string; role: string }> }
const pattern = /^\/agentic-publishing\/([^/]+)\/([^/]+)$/
export const dynamicParams = false
export const generateStaticParams = () => federationParams(pattern, ['topic', 'role'])
export async function generateMetadata({ params }: Props) { const p = await params; return federationMetadata(`/agentic-publishing/${p.topic}/${p.role}`) }
export default async function Page({ params }: Props) { const p = await params; return renderFederationPage(`/agentic-publishing/${p.topic}/${p.role}`) }

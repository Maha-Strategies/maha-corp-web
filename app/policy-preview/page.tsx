import { notFound } from 'next/navigation'
import PolicyFrontDoor, { policyFrontDoorMetadata } from '@/components/policy/PolicyFrontDoor'

export const metadata = policyFrontDoorMetadata

export default function PolicyPreviewPage() {
  if (process.env.VERCEL_ENV !== 'preview') notFound()
  return <PolicyFrontDoor />
}

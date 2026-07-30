import { ApiCreditDashboard } from './ApiCreditDashboard'

export const dynamic = 'force-dynamic'

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ status?: string | string[] }> }) {
  const params = await searchParams
  return <ApiCreditDashboard status={typeof params.status === 'string' ? params.status : params.status?.[0]} />
}

import { getApiKeyData } from '@/lib/redis'
import { TopUpButtons } from './TopUpButtons'

export const dynamic = 'force-dynamic'

type DashboardPageProps = {
  searchParams: Promise<{ apiKeyId?: string | string[]; status?: string | string[] }>
}

function firstValue(value: string | string[] | undefined) {
  return typeof value === 'string' ? value : value?.[0]
}

function formatCredits(value: unknown) {
  const credits = Number(value)
  return Number.isFinite(credits) && credits >= 0 ? new Intl.NumberFormat('en-US').format(credits) : '0'
}

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const params = await searchParams
  const apiKeyId = firstValue(params.apiKeyId) ?? 'key_default_123'
  const status = firstValue(params.status)
  let keyData: Record<string, unknown> | null = null
  let unavailable = false
  try {
    keyData = await getApiKeyData(apiKeyId)
  } catch {
    unavailable = true
  }

  return <main className="min-h-screen bg-gray-50 px-6 py-14 text-gray-950 sm:py-20">
    <div className="mx-auto max-w-3xl">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">Maha Strategies developer portal</p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">API credit dashboard</h1>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-gray-600">Review your prepaid balance and add credits to the API key currently selected for this dashboard.</p>

      {status === 'success' && <div role="status" className="mt-8 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">Payment completed. Credits will appear after Stripe confirms the payment webhook.</div>}

      <section className="mt-8 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <p className="text-sm font-medium text-gray-600">Current Balance</p>
        <p className="mt-2 text-4xl font-semibold tracking-tight">{formatCredits(keyData?.balance_credits)} <span className="text-lg font-medium text-gray-500">credits</span></p>
        <div className="mt-5 border-t border-gray-100 pt-4 text-sm text-gray-600"><p>API key ID: <code className="rounded bg-gray-100 px-2 py-1 text-xs text-gray-800">{apiKeyId}</code></p>{Boolean(keyData?.tier) && <p className="mt-2">Tier: <span className="font-medium text-gray-900">{String(keyData?.tier)}</span></p>}{!keyData && !unavailable && <p className="mt-2 text-amber-700">No active key was found for this dashboard link.</p>}{unavailable && <p className="mt-2 text-amber-700">The credit service is temporarily unavailable. Please refresh shortly.</p>}</div>
      </section>

      <div className="mt-6"><TopUpButtons apiKeyId={apiKeyId} /></div>
    </div>
  </main>
}

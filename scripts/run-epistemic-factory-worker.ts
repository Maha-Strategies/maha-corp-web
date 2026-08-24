const DEFAULT_BASE_URL = 'https://www.mahastrategies.com'

function productionBaseUrl(environment: NodeJS.ProcessEnv) {
  const baseUrl = (environment.PRODUCTION_BASE_URL || DEFAULT_BASE_URL).replace(/\/$/, '')
  if (!/(^|\.)mahastrategies\.com$/.test(new URL(baseUrl).host)) throw new Error(`Refusing non-Production host ${baseUrl}.`)
  return baseUrl
}

export async function runEpistemicFactoryWorker(environment = process.env, arguments_ = process.argv.slice(2)) {
  const token = environment.EPISTEMIC_OPERATIONS_TOKEN?.trim()
  if (!token || Buffer.byteLength(token, 'utf8') < 32) throw new Error('EPISTEMIC_OPERATIONS_TOKEN must contain at least 32 bytes.')
  const baseUrl = productionBaseUrl(environment)
  const drain = arguments_.includes('--drain')
  const limitArgument = arguments_.find((argument) => argument.startsWith('--limit='))?.slice('--limit='.length)
  const limit = limitArgument ? Number(limitArgument) : 20
  if (!Number.isInteger(limit) || limit < 1 || limit > 50) throw new Error('--limit must be an integer from 1 to 50.')
  let totalCompleted = 0
  let totalFailed = 0
  do {
    const response = await fetch(`${baseUrl}/api/admin/epistemic-factory/worker`, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ limit }),
    })
    const payload = await response.json() as { claimed?: number; completed?: unknown[]; failed?: unknown[]; error?: { message?: string } }
    if (!response.ok) throw new Error(`Factory worker returned ${response.status}: ${payload.error?.message ?? 'unknown error'}`)
    const completed = payload.completed?.length ?? 0
    const failed = payload.failed?.length ?? 0
    totalCompleted += completed
    totalFailed += failed
    console.log(`Claimed ${payload.claimed ?? 0}; completed ${completed}; failed ${failed}.`)
    if (!drain || !payload.claimed) break
  } while (true)
  console.log(`Worker result: ${totalCompleted} completed; ${totalFailed} failed.`)
}

if (import.meta.url === `file://${process.argv[1]}`) await runEpistemicFactoryWorker()


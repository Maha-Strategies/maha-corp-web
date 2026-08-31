type ErrorBody = { error?: { message?: string } }

async function responseBody(response: Response): Promise<ErrorBody & Record<string, unknown>> {
  const text = await response.text()
  if (!text) return {}
  try {
    return JSON.parse(text) as ErrorBody & Record<string, unknown>
  } catch {
    throw new Error(`The site returned an unreadable response (HTTP ${response.status}). Please retry or email mayone@mahastrategies.com.`)
  }
}

function isNetworkError(error: unknown): boolean {
  if (!(error instanceof Error)) return true
  return error instanceof TypeError || ['Failed to fetch', 'Load failed', 'NetworkError when attempting to fetch resource.'].includes(error.message)
}

export async function postPublicForm<T extends Record<string, unknown>>(url: string, body: Record<string, unknown>): Promise<T> {
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(body),
    })
    const result = await responseBody(response) as T & ErrorBody
    if (!response.ok) throw new Error(result.error?.message ?? `The request could not be completed (HTTP ${response.status}).`)
    return result
  } catch (error) {
    if (!isNetworkError(error)) throw error
    throw new Error('We could not reach Maha Strategies. Check your connection and try again, or email mayone@mahastrategies.com.')
  }
}

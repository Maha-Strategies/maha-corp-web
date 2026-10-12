import { MICRO_MAX_REQUEST_BYTES } from './micro-contracts.ts'

/** Bounded fatal-UTF8 read with a deadline; callers use a clone when needed. */
export async function readMicroBody(request: Request): Promise<unknown> {
  const reader = request.body?.getReader()
  if (!reader) throw new Error('invalid_input')
  let length = 0
  const chunks: Uint8Array[] = []
  let timer: ReturnType<typeof setTimeout> | undefined
  let timedOut = false
  const expired = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => { timedOut = true; void reader.cancel().catch(() => {}); reject(new Error('body_timeout')) }, 5000)
  })
  try {
    while (true) {
      const { value, done } = await Promise.race([reader.read(), expired])
      if (timedOut) throw new Error('body_timeout')
      if (done) break
      length += value.byteLength
      if (length > MICRO_MAX_REQUEST_BYTES) { void reader.cancel().catch(() => {}); throw new Error('payload_too_large') }
      chunks.push(value)
    }
    const bytes = new Uint8Array(length)
    let offset = 0
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length }
    return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes))
  } finally { clearTimeout(timer); reader.releaseLock() }
}

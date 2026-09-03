// Keeping the provider's answer to a call that has already been paid for.
//
// The failure this exists to prevent is narrow and expensive: the canary
// settles 0.015 USDC, the endpoint answers, and then a later check -- the
// status, the shape of the body, the balance delta, the settlement receipt --
// refuses the run. If the body was only ever a parsed value in memory, the
// artifact upload has nothing to upload, and the sole way to see what the
// money bought is to spend again.
//
// So the bytes are written first and judged afterwards. Persisting is not
// accepting: every assertion the caller makes still runs, in the same order,
// and still fails closed. It just fails with the evidence on disk.
//
// Only the response body is written, and only the bytes that actually
// arrived. Never a re-serialization of them -- a digest taken over
// `JSON.stringify` output attests to this process's formatting rather than to
// what the provider sent, and an independent verifier hashing the file would
// be checking the wrong thing. Nothing here reads a header, a signature, an
// authorization or an environment value, so nothing here can leak one.

import { createHash } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import { basename, dirname } from 'node:path'

/** Everything a later reader needs, all of it derived from bytes on disk. */
export type CapturedResponse = {
  /** Exactly what the provider sent, and exactly what was written. */
  bytes: Buffer
  /** SHA-256 over those bytes, recomputable from the file alone. */
  sha256: string
  /** Where they were written. */
  path: string
  /** The status of the response they were read from. */
  status: number
}

/**
 * Make the evidence directories before anything is spent.
 *
 * A directory created only after the assertions pass is a directory that is
 * missing on precisely the runs that need one. Calling this before the paid
 * request means a run that dies mid-payment still leaves somewhere for the
 * `if: always()` upload to look.
 */
export async function prepareEvidenceDirectories(...paths: string[]): Promise<void> {
  for (const path of paths) await mkdir(dirname(path), { recursive: true })
}

/**
 * Read the body once, write it, then digest what was written.
 *
 * A `Response` stream cannot be replayed, so it is consumed a single time
 * here and everything downstream reads `bytes` instead of reaching for the
 * spent response. The directory is created again rather than assumed: the
 * helper has to be correct on its own, not only when called in the right
 * order.
 */
export async function captureResponseBody(response: Response, path: string): Promise<CapturedResponse> {
  const bytes = Buffer.from(await response.arrayBuffer())
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, bytes, { mode: 0o600 })
  return { bytes, sha256: createHash('sha256').update(bytes).digest('hex'), path, status: response.status }
}

/**
 * Parse the captured bytes, naming where they are when they will not parse.
 *
 * A malformed body is still a failure. It is just a legible one now: the run
 * stops, and the bytes that stopped it are already preserved and named.
 */
export function parseCapturedJson(captured: CapturedResponse): Record<string, unknown> {
  let parsed: unknown
  try {
    parsed = JSON.parse(captured.bytes.toString('utf8'))
  } catch (cause) {
    throw new Error(`The paid response is not valid JSON; its ${captured.bytes.byteLength} received bytes are preserved at ${captured.path}.`, { cause })
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error(`The paid response is not a JSON object; its ${captured.bytes.byteLength} received bytes are preserved at ${captured.path}.`)
  }
  return parsed as Record<string, unknown>
}

/**
 * A sanitized note of what arrived, written beside the bytes.
 *
 * The payment evidence file is only written once every check has passed, so
 * on a failing run this is the only machine-readable record that a response
 * existed at all -- what status it carried, how long it was, and the digest
 * of the file next to it. It is built from a fixed set of fields rather than
 * from anything observed, which is what keeps a header, a signature, a nonce
 * or a credential from ever reaching it.
 */
export async function writeCaptureRecord(captured: CapturedResponse, path: string, endpoint: string): Promise<void> {
  const record = {
    schemaVersion: 'maha-nsgoods-preflight-response-capture/1.0',
    capturedAt: new Date().toISOString(),
    endpoint,
    httpStatus: captured.status,
    byteLength: captured.bytes.byteLength,
    responseSha256: captured.sha256,
    responseFile: basename(captured.path),
  }
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, `${JSON.stringify(record, null, 2)}\n`, { mode: 0o600 })
}

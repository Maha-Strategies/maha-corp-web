export const DECLARATION_DIGEST_EXTENSION = 'declaration-integrity'
export const DECLARATION_DIGEST_ALGORITHM = 'sha256'

type JsonRecord = Record<string, unknown>

export type DeclarationDigestExtension = {
  declarationDigest: `sha256:${string}`
  metadataVersion: string
  canonicalResource: string
}

export type DiscoveryDeclaration = {
  x402Version: number
  resource: JsonRecord
  accepts: unknown[]
  extensions?: JsonRecord
}

function record(value: unknown): JsonRecord | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as JsonRecord
    : null
}

function canonicalJson(value: unknown): string {
  if (value === null || typeof value === 'boolean' || typeof value === 'string') return JSON.stringify(value)
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error('A declaration digest cannot contain a non-finite number.')
    return JSON.stringify(value)
  }
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`
  if (typeof value !== 'object') throw new Error(`A declaration digest cannot contain ${typeof value}.`)
  return `{${Object.keys(value as JsonRecord)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalJson((value as JsonRecord)[key])}`)
    .join(',')}}`
}

export function canonicalResourceUrl(value: string): string {
  const url = new URL(value)
  if (url.protocol !== 'https:') throw new Error('canonicalResource must use HTTPS.')
  url.hash = ''
  return url.toString()
}

/**
 * Produces the non-recursive declaration covered by the proposed digest.
 *
 * Extension arrays retain their order because ordering can affect client
 * selection. Object keys are canonicalized later. Only this extension is
 * removed; silently dropping other advertised metadata would let a catalog
 * claim equality while indexing a materially different declaration.
 */
export function digestableDeclaration(value: DiscoveryDeclaration): DiscoveryDeclaration {
  const extensions = { ...(record(value.extensions) ?? {}) }
  delete extensions[DECLARATION_DIGEST_EXTENSION]
  return {
    x402Version: value.x402Version,
    resource: value.resource,
    accepts: value.accepts,
    extensions,
  }
}

export async function declarationDigest(value: DiscoveryDeclaration): Promise<`sha256:${string}`> {
  const encoded = new TextEncoder().encode(canonicalJson(digestableDeclaration(value)))
  const digest = await crypto.subtle.digest('SHA-256', encoded)
  const hex = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
  return `sha256:${hex}`
}

export async function createDeclarationDigestExtension(
  declaration: DiscoveryDeclaration,
  metadataVersion: string,
): Promise<DeclarationDigestExtension> {
  if (!/^\d{4}-\d{2}-\d{2}(?:[.+-][A-Za-z0-9._-]+)?$/.test(metadataVersion)) {
    throw new Error('metadataVersion must start with YYYY-MM-DD and may include a deployment suffix.')
  }
  const resourceUrl = typeof declaration.resource.url === 'string' ? declaration.resource.url : ''
  return {
    declarationDigest: await declarationDigest(declaration),
    metadataVersion,
    canonicalResource: canonicalResourceUrl(resourceUrl),
  }
}

export function readDeclarationDigestExtension(value: unknown): DeclarationDigestExtension | null {
  const extension = record(value)
  if (!extension
    || typeof extension.declarationDigest !== 'string'
    || !/^sha256:[a-f0-9]{64}$/.test(extension.declarationDigest)
    || typeof extension.metadataVersion !== 'string'
    || typeof extension.canonicalResource !== 'string') return null
  try {
    return {
      declarationDigest: extension.declarationDigest as `sha256:${string}`,
      metadataVersion: extension.metadataVersion,
      canonicalResource: canonicalResourceUrl(extension.canonicalResource),
    }
  } catch {
    return null
  }
}

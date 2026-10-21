import { createHash } from 'node:crypto'

import { normalizeContextSource, sha256, type ContextPackRequest } from './context-compiler.ts'

export const CONTEXT_PROOF_CANONICALIZATION_ADDENDUM = 'maha-context-proof-canonicalization-v3.1.0' as const

/**
 * Exact production preimage for Context Compiler inputHash.
 *
 * This is deliberately not labelled RFC 8785/JCS. The production contract is
 * an explicitly constructed ECMAScript object serialized by JSON.stringify.
 * Its property and array order are therefore part of the commitment.
 */
export function contextCompilerInputHashPreimage(request: Pick<ContextPackRequest, 'task' | 'tokenBudget' | 'documents'>): string {
  return JSON.stringify({
    task: request.task,
    tokenBudget: request.tokenBudget,
    documents: request.documents.map((document) => ({
      id: document.id,
      title: document.title,
      hash: sha256(normalizeContextSource(document.text)),
    })),
  })
}

export function recomputeContextCompilerInputHash(request: Pick<ContextPackRequest, 'task' | 'tokenBudget' | 'documents'>): string {
  return sha256(contextCompilerInputHashPreimage(request))
}

/** The production outputHash preimage is the exact rendered Context Pack. */
export function contextCompilerOutputHashPreimage(compiledContext: string): string {
  return compiledContext
}

export function recomputeContextCompilerOutputHash(compiledContext: string): string {
  return sha256(contextCompilerOutputHashPreimage(compiledContext))
}

/** SHA-256 for immutable fixture bytes, without the production `sha256:` prefix. */
export function fixtureFileDigest(bytes: string | Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex')
}

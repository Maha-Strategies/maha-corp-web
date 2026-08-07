/**
 * Reproducible Context Compiler agent recipe.
 *
 * Safe measurement (no network and no payment):
 *   npm run recipe:context-compiler
 *
 * Production x402 call (settles exactly 0.001 USDC on Base Mainnet):
 *   X402_BUYER_PRIVATE_KEY=0x... npm run recipe:context-compiler:live
 *
 * The workload is four real, published Maha Strategies book chapters. The
 * economics compare sending all four chapters to a model once with sending
 * the returned Context Pack once. Output-token cost is excluded because both
 * alternatives ask the model for the same answer.
 */

import { randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'

import { encode } from 'gpt-tokenizer'

import { compileContextPack, parseContextPackRequest, type ContextPackRequest } from '../lib/context-compiler.ts'
import { createPaidFetch, type TypedDataRequest } from '../lib/x402/client.ts'

const ENDPOINT = process.env.MAHA_CONTEXT_COMPILER_URL?.trim() || 'https://www.mahastrategies.com/api/v1/compress'
const LIVE = process.argv.includes('--live')
const REFERENCE_INPUT_PRICE_USD_PER_MILLION = Number(process.env.REFERENCE_INPUT_PRICE_USD_PER_MILLION ?? '3')
const LOCAL_X402_FEE_USD = 0.001

if (!Number.isFinite(REFERENCE_INPUT_PRICE_USD_PER_MILLION) || REFERENCE_INPUT_PRICE_USD_PER_MILLION <= 0) {
  throw new Error('REFERENCE_INPUT_PRICE_USD_PER_MILLION must be a positive number.')
}

const sources = [
  { id: 'borrowed-light-ch1', title: 'The Borrowed Light — Chapter 1', path: '../content/books/the-borrowed-light/chapter-1.md' },
  { id: 'unfinished-species-ch1', title: 'The Unfinished Species — Chapter 1', path: '../content/books/the-unfinished-species/chapter-1.md' },
  { id: 'orbital-mind-ch1', title: 'The Orbital Mind — Chapter 1', path: '../content/books/the-orbital-mind/chapter-1.md' },
  { id: 'imagined-life-ch1', title: 'The Imagined Life — Chapter 1', path: '../content/books/the-imagined-life/chapter-1.md' },
] as const

const documents = await Promise.all(sources.map(async (source) => ({
  id: source.id,
  title: source.title,
  text: await readFile(new URL(source.path, import.meta.url), 'utf8'),
})))

const request = parseContextPackRequest({
  clientRequestId: `recipe_${randomUUID()}`,
  task: 'Compare how these works describe cognition, adaptation, imagination, agency, and the construction of a self.',
  tokenBudget: 8_000,
  documents,
  provenance: 'compact',
  scoring: 'bm25',
  budgetMode: 'guaranteed',
})

type ContextPack = ReturnType<typeof compileContextPack> & {
  sourceTextStored?: false
  compiledContextStored?: false
}

type SettlementReceipt = { success: boolean; transaction?: string; network?: string; payer?: string } | null

async function callProduction(input: ContextPackRequest): Promise<{ pack: ContextPack; feeUsd: number; receipt: SettlementReceipt }> {
  const privateKey = process.env.X402_BUYER_PRIVATE_KEY?.trim() as `0x${string}` | undefined
  if (!privateKey) throw new Error('X402_BUYER_PRIVATE_KEY is required with --live. Local mode never reads or spends a key.')

  const [{ privateKeyToAccount }, { base }] = await Promise.all([
    import('viem/accounts'),
    import('viem/chains'),
  ])
  const account = privateKeyToAccount(privateKey)
  let receipt: SettlementReceipt = null

  const paidFetch = createPaidFetch({
    address: account.address,
    chainId: base.id,
    signTypedData: async (typed: TypedDataRequest) => account.signTypedData({
      domain: { ...typed.domain, verifyingContract: typed.domain.verifyingContract as `0x${string}` },
      types: typed.types,
      primaryType: typed.primaryType,
      message: {
        ...typed.message,
        from: typed.message.from as `0x${string}`,
        to: typed.message.to as `0x${string}`,
        nonce: typed.message.nonce as `0x${string}`,
      },
    }),
    onSettled: (settled) => { receipt = settled },
  })

  const response = await paidFetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  if (!response.ok) throw new Error(`Context Compiler returned HTTP ${response.status}.`)

  const feeBaseUnits = response.x402?.requirement.amount
  return {
    pack: await response.json() as ContextPack,
    feeUsd: feeBaseUnits ? Number(feeBaseUnits) / 1_000_000 : LOCAL_X402_FEE_USD,
    receipt,
  }
}

const execution = LIVE
  ? await callProduction(request)
  : { pack: compileContextPack(request), feeUsd: LOCAL_X402_FEE_USD, receipt: null }

const inputText = request.documents.map((document) => document.text).join('\n\n')
const inputTokens = encode(inputText).length
const compiledTokens = encode(execution.pack.context).length
const savedTokens = Math.max(0, inputTokens - compiledTokens)
const reductionPercent = inputTokens === 0 ? 0 : (savedTokens / inputTokens) * 100
const grossInputCostAvoidedUsd = (savedTokens / 1_000_000) * REFERENCE_INPUT_PRICE_USD_PER_MILLION
const netInputCostAvoidedUsd = grossInputCostAvoidedUsd - execution.feeUsd
const includedSourceIds = execution.pack.sources
  .filter((source) => source.includedPassageIds.length > 0)
  .map((source) => source.sourceId)

const round = (value: number, places = 6) => Number(value.toFixed(places))

console.log(JSON.stringify({
  recipe: 'maha-context-compiler-large-document-v1',
  execution: LIVE ? 'production_x402' : 'local_same_compiler',
  workload: {
    description: 'Four complete, published book chapters compiled for one comparative-analysis task.',
    sourceCount: request.documents.length,
    inputBytes: Buffer.byteLength(inputText, 'utf8'),
    requestBytes: Buffer.byteLength(JSON.stringify(request), 'utf8'),
    inputTokensBpe: inputTokens,
    tokenBudget: request.tokenBudget,
  },
  result: {
    compiledTokensBpe: compiledTokens,
    savedTokensBpe: savedTokens,
    reductionPercent: round(reductionPercent, 2),
    sourceCoveragePercent: execution.pack.metrics.sourceCoveragePercent,
    includedSourceCount: includedSourceIds.length,
    includedSourceIds,
    inputHash: execution.pack.inputHash,
    outputHash: execution.pack.outputHash,
  },
  economics: {
    referenceInputPriceUsdPerMillion: REFERENCE_INPUT_PRICE_USD_PER_MILLION,
    grossInputCostAvoidedUsd: round(grossInputCostAvoidedUsd),
    x402FeeUsd: execution.feeUsd,
    netInputCostAvoidedUsd: round(netInputCostAvoidedUsd),
    grossSavingsToFeeMultiple: round(grossInputCostAvoidedUsd / execution.feeUsd, 2),
    scope: 'Input-token cost only. Model output cost is excluded from both alternatives.',
  },
  settlement: execution.receipt,
  reproducibility: {
    command: LIVE ? 'npm run recipe:context-compiler:live' : 'npm run recipe:context-compiler',
    pricingOverride: 'REFERENCE_INPUT_PRICE_USD_PER_MILLION',
    paidModeWarning: '--live signs and settles one production x402 payment.',
  },
}, null, 2))

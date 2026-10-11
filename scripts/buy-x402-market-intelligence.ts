import { createHash, randomBytes } from 'node:crypto'
import { setDefaultResultOrder } from 'node:dns'
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { createPublicClient, http, parseAbi, recoverTypedDataAddress } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { base } from 'viem/chains'
import { confirmSettlement } from '../lib/x402/chain.ts'
import { MARKET_ASSET, MARKET_BATCH_CAP, MARKET_BUYER, MARKET_CONFIRMATION, MARKET_PAYEE,
  MARKET_PURCHASES, marketTypedData, validateMarketChallenge, validateMarketDelivery } from './lib/market-intelligence-purchase.ts'

setDefaultResultOrder('ipv4first')
const output = process.env.MARKET_PURCHASE_OUTPUT_DIR
if (!output) throw new Error('A dedicated evidence output directory is required.')
await mkdir(output, { recursive: true, mode: 0o700 })
const paying = process.argv.includes('--pay')
if (paying && process.env.MARKET_PURCHASE_CONFIRMATION !== MARKET_CONFIRMATION) throw new Error('Explicit purchase confirmation is required.')

const journal = { schemaVersion: 'maha-external-market-purchase/1.0', checkedAt: new Date().toISOString(),
  batchCapBaseUnits: MARKET_BATCH_CAP.toString(), userCapBaseUnits: '1000000',
  runId: process.env.GITHUB_RUN_ID ?? null, automaticRepayments: false,
  purchases: [] as Array<Record<string, unknown>> }
const journalPath = join(output, paying ? 'purchase-evidence.json' : 'unpaid-probe.json')
// Refuse a second execution against the same journal, even after an uncertain outcome.
await writeFile(journalPath, JSON.stringify(journal, null, 2), { flag: 'wx', mode: 0o600 })
const save = () => writeFile(journalPath, JSON.stringify(journal, null, 2) + '\n', { mode: 0o600 })

try {
  // Verify both quotes before signing either one. Redirects never receive a signature.
  for (const purchase of MARKET_PURCHASES) {
    const response = await fetch(purchase.url, { redirect: 'error', headers: { accept: 'application/json' }, signal: AbortSignal.timeout(30000) })
    if (response.status !== 402) throw new Error('Expected an unpaid 402 quote.')
    const challenge = await response.json()
    validateMarketChallenge(challenge, purchase)
    journal.purchases.push({ product: purchase.id, resource: purchase.url, amountBaseUnits: purchase.amount, state: 'quote_validated' })
  }
  await save()
  if (!paying) {
    console.log('Both unpaid quotes match the 0.05125 USDC approval. No payment was signed.')
  } else {
    const key = process.env.X402_BUYER_PRIVATE_KEY?.trim()
    if (!key || !/^0x[0-9a-fA-F]{64}$/.test(key)) throw new Error('Protected buyer configuration is missing.')
    const account = privateKeyToAccount(key as `0x${string}`)
    if (account.address.toLowerCase() !== MARKET_BUYER.toLowerCase()) throw new Error('Unexpected buyer wallet.')
    const rpcUrl = process.env.BASE_RPC_URL?.trim() || 'https://mainnet.base.org'
    const chain = createPublicClient({ chain: base, transport: http(rpcUrl, { retryCount: 0, timeout: 15000 }) })
    if (await chain.getChainId() !== 8453) throw new Error('Buyer RPC is not Base mainnet.')
    const balance = await chain.readContract({ address: MARKET_ASSET as `0x${string}`,
      abi: parseAbi(['function balanceOf(address) view returns (uint256)']), functionName: 'balanceOf', args: [account.address] })
    if (balance < MARKET_BATCH_CAP) throw new Error('Insufficient buyer USDC.')
    let authorized = 0n
    for (const [index, purchase] of MARKET_PURCHASES.entries()) {
      const entry = journal.purchases[index]
      authorized += BigInt(purchase.amount)
      if (authorized > MARKET_BATCH_CAP) throw new Error('Batch spending cap exceeded.')
      // Mark uncertainty before signing/sending. Never automatically retry this request.
      entry.state = 'authorization_started_do_not_repay'
      await save()
      const typed = marketTypedData(purchase, `0x${randomBytes(32).toString('hex')}`, Math.floor(Date.now() / 1000))
      const signature = await account.signTypedData(typed)
      const recovered = await recoverTypedDataAddress({ ...typed, signature })
      if (recovered.toLowerCase() !== MARKET_BUYER.toLowerCase()) throw new Error('Authorization signature did not recover the approved buyer.')
      const m = typed.message
      const payment = { x402Version: 1, scheme: 'exact', network: 'base', payload: { signature,
        authorization: { from: m.from, to: m.to, value: m.value.toString(), validAfter: m.validAfter.toString(), validBefore: m.validBefore.toString(), nonce: m.nonce } } }
      const response = await fetch(purchase.url, { redirect: 'error', method: 'GET', signal: AbortSignal.timeout(90000),
        headers: { accept: 'application/json', 'X-PAYMENT': Buffer.from(JSON.stringify(payment)).toString('base64') } })
      // Persist the purchased bytes before making assertions that might throw.
      const bytes = Buffer.from(await response.arrayBuffer())
      const filename = `${purchase.id}.json`
      await writeFile(join(output, filename), bytes, { mode: 0o600 })
      entry.httpStatus = response.status
      entry.responseFile = filename
      entry.responseSha256 = createHash('sha256').update(bytes).digest('hex')
      entry.responseBytes = bytes.length
      entry.state = 'response_captured_do_not_repay'
      const receiptHeader = response.headers.get('x-payment-response') ?? response.headers.get('payment-response')
      let receipt: Record<string, unknown> | null = null
      if (receiptHeader) {
        try { receipt = JSON.parse(Buffer.from(receiptHeader, 'base64').toString('utf8')) } catch { /* captured response remains available */ }
      }
      entry.transaction = typeof receipt?.transaction === 'string' ? receipt.transaction : null
      await save()
      if (response.status !== 200) throw new Error('Paid delivery did not return HTTP 200; do not repay.')
      if (bytes.length > 30 * 1024 * 1024) throw new Error('Market response exceeds the bounded artifact size.')
      validateMarketDelivery(purchase.id, JSON.parse(bytes.toString('utf8')))
      const transaction = entry.transaction
      if (receipt?.success !== true || typeof transaction !== 'string' || !/^0x[0-9a-fA-F]{64}$/.test(transaction)) {
        throw new Error('Paid delivery has no usable settlement receipt; reconcile without repaying.')
      }
      const confirmation = await confirmSettlement({ rpcUrl, caip2Network: 'eip155:8453', transaction,
        asset: MARKET_ASSET, payer: MARKET_BUYER, payTo: MARKET_PAYEE, minAmount: purchase.amount,
        attempts: 30, retryDelayMs: 2000, requestTimeoutMs: 10000 })
      entry.chainConfirmation = confirmation
      await save()
      if (confirmation.status !== 'confirmed' || confirmation.amount !== purchase.amount) throw new Error('Settlement not confirmed for the exact price; do not repay.')
      entry.state = 'delivered_and_chain_confirmed'
      await save()
      console.log(`${purchase.id}: paid ${Number(purchase.amount) / 1e6} USDC; delivery saved; transaction ${transaction}.`)
    }
    console.log('Both purchases completed. Total 0.05125 USDC. No automatic repeat purchases.')
  }
} catch {
  // Third-party errors and provider URLs can contain sensitive inputs; never print them.
  await save()
  console.error('Market purchase stopped. Inspect sanitized evidence; do not retry payment automatically.')
  process.exitCode = 1
}

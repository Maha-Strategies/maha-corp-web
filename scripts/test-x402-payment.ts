import { createPaidFetch, type TypedDataRequest } from '../lib/x402/client.ts'
import { privateKeyToAccount } from 'viem/accounts'
import { base } from 'viem/chains' // CHANGED: Switched from baseSepolia to base
import { randomUUID } from 'node:crypto'

const privateKey = process.env.TEST_BUYER_PRIVATE_KEY as `0x${string}`
if (!privateKey) throw new Error('TEST_BUYER_PRIVATE_KEY environment variable is missing.')

const account = privateKeyToAccount(privateKey)

const signTypedData = async (req: TypedDataRequest) => {
  return account.signTypedData({
    domain: req.domain as any,
    types: req.types as any,
    primaryType: req.primaryType,
    message: req.message,
  })
}

const paidFetch = createPaidFetch({
  signTypedData,
  address: account.address,
  chainId: base.id, // CHANGED: Now using chain ID 8453 (Base Mainnet)
  onPaymentRequired: (req) => console.log('Payment challenge received:', req.description),
  onSettled: (receipt) => console.log('Payment settled on Base Mainnet:', receipt),
})

async function runTest() {
  console.log(`Sending paid request from buyer address: ${account.address}`)

  const response = await paidFetch('https://www.mahastrategies.com/api/v1/compress', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ 
      clientRequestId: `req_${randomUUID()}`,
      task: 'Summarize key findings from these source documents.',
      documents: [
        {
          id: 'doc-1',
          title: 'First Document',
          text: 'First source document text for context compression.'
        }
      ],
      tokenBudget: 1024
    }),
  })

  console.log('HTTP Status Code:', response.status)
  const body = await response.json()
  console.log('Response Body:', body)
}

runTest().catch(console.error)
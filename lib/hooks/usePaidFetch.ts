'use client'

import { useCallback, useMemo, useState } from 'react'

import {
  X402PaymentError,
  createPaidFetch,
  type PaidResponse,
  type PaymentRequirement,
  type TypedDataSigner,
} from '../x402/client.ts'

// React binding for the x402 handshake.
//
// The wallet arrives as three values -- an address, a chain id, and a function
// that signs typed data -- because that is all the protocol needs, and because
// taking wagmi as a dependency of this module would pull a connector tree into
// the production bundle for the sake of three fields. Wiring it to wagmi is
// therefore a pass-through, and swapping wagmi for anything else touches only
// the component that calls this:
//
//   const { address, chainId } = useAccount()
//   const { signTypedDataAsync } = useSignTypedData()
//   const { paidFetch } = usePaidFetch({ address, chainId, signTypedData: signTypedDataAsync })
//
// `signTypedDataAsync` already takes { domain, types, primaryType, message }
// and returns a hex string, so no adapter is needed.

export type PaymentPhase =
  | { status: 'idle' }
  | { status: 'requesting' }
  /** Terms are known; the wallet has not been prompted yet. */
  | { status: 'payment_required'; requirement: PaymentRequirement }
  /** The wallet is open and waiting on a human. */
  | { status: 'signing'; requirement: PaymentRequirement }
  | { status: 'settling'; requirement: PaymentRequirement }
  | { status: 'settled'; requirement: PaymentRequirement; transaction?: string }
  | { status: 'failed'; error: X402PaymentError }

export type UsePaidFetchOptions = {
  address: string | undefined
  chainId: number | undefined
  signTypedData: TypedDataSigner
}

export type UsePaidFetch = {
  paidFetch: (input: RequestInfo | URL, init?: RequestInit) => Promise<PaidResponse>
  phase: PaymentPhase
  /** Convenience for disabling a submit button. */
  isPaying: boolean
  reset: () => void
}

export function usePaidFetch(options: UsePaidFetchOptions): UsePaidFetch {
  const [phase, setPhase] = useState<PaymentPhase>({ status: 'idle' })

  // Destructured so the callback below can depend on each value directly. A
  // ref written during render would be the wrong fix twice over: React forbids
  // it, and a stale wallet identity signs for a previously connected address,
  // which the facilitator attributes to the wrong payer.
  const { address, chainId, signTypedData } = options

  const paidFetch = useCallback(async (input: RequestInfo | URL, init: RequestInit = {}): Promise<PaidResponse> => {
    setPhase({ status: 'requesting' })
    let current: PaymentRequirement | undefined

    const run = createPaidFetch({
      address,
      chainId,
      signTypedData: async (request) => {
        setPhase({ status: 'signing', requirement: current! })
        const signature = await signTypedData(request)
        setPhase({ status: 'settling', requirement: current! })
        return signature
      },
      onPaymentRequired: (requirement) => {
        current = requirement
        setPhase({ status: 'payment_required', requirement })
      },
    })

    try {
      const response = await run(input, init)
      // A request served without payment leaves the hook idle: there is no
      // payment to report, and showing a settled state for a free response
      // would be a lie.
      setPhase(current
        ? { status: 'settled', requirement: current, transaction: response.x402?.receipt?.transaction }
        : { status: 'idle' })
      return response
    } catch (error) {
      const failure = error instanceof X402PaymentError
        ? error
        : new X402PaymentError('payment_rejected', error instanceof Error ? error.message : 'The request failed.', { requirement: current, cause: error })
      setPhase({ status: 'failed', error: failure })
      throw failure
    }
  }, [address, chainId, signTypedData])

  const reset = useCallback(() => setPhase({ status: 'idle' }), [])

  const isPaying = phase.status === 'payment_required' || phase.status === 'signing' || phase.status === 'settling'

  return useMemo(() => ({ paidFetch, phase, isPaying, reset }), [paidFetch, phase, isPaying, reset])
}

/**
 * What to put in front of a person for a given phase.
 *
 * Kept beside the state machine rather than in a component so that every
 * surface using this says the same thing about money -- particularly the
 * distinction between a payment that settled and one that did not.
 */
export function describePhase(phase: PaymentPhase): string {
  switch (phase.status) {
    case 'idle': return ''
    case 'requesting': return 'Contacting the service…'
    case 'payment_required': return `Payment required: ${formatAmount(phase.requirement)} for this request.`
    case 'signing': return 'Confirm the payment in your wallet.'
    case 'settling': return 'Settling payment…'
    case 'settled': return 'Paid.'
    case 'failed': return phase.error.message
  }
}

/** USDC has six decimals; showing raw base units to a person is unreadable. */
export function formatAmount(requirement: PaymentRequirement, decimals = 6): string {
  const raw = BigInt(requirement.amount)
  const unit = BigInt(10) ** BigInt(decimals)
  const whole = raw / unit
  const fraction = (raw % unit).toString().padStart(decimals, '0').replace(/0+$/, '')
  const symbol = requirement.extra?.name ?? 'USDC'
  return `${whole}${fraction ? `.${fraction}` : ''} ${symbol}`
}

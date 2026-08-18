'use client'

import { useEffect, useRef } from 'react'
import type { ComponentProps, MouseEventHandler, ReactNode } from 'react'

import type { X402TrustDemoEventType, X402TrustDemoScenario } from '@/lib/x402/trust-demo-telemetry'

function record(eventType: X402TrustDemoEventType, scenarioId: X402TrustDemoScenario | null = null) {
  if (typeof crypto.randomUUID !== 'function') return
  // Cookie-free, best-effort aggregate telemetry. No report content, evidence,
  // credential, wallet, address, referrer, or persistent visitor ID is sent.
  void fetch('/api/x402-trust/telemetry', {
    method: 'POST',
    credentials: 'omit',
    keepalive: true,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ eventId: `x402trust_${crypto.randomUUID()}`, eventType, scenarioId }),
  }).catch(() => undefined)
}

export function X402TrustDemoStart() {
  const recorded = useRef(false)
  useEffect(() => {
    if (recorded.current) return
    recorded.current = true
    record('demo_started')
  }, [])
  return null
}

export function X402TrustScenarioDetails({ scenarioId, children, ...props }: ComponentProps<'details'> & { scenarioId: X402TrustDemoScenario; children: ReactNode }) {
  const completed = useRef(false)
  return <details {...props} onToggle={(event) => {
    props.onToggle?.(event)
    if (!event.currentTarget.open || completed.current) return
    completed.current = true
    record('scenario_completed', scenarioId)
  }}>{children}</details>
}

export function X402TrustEvidenceLink({ scenarioId, onClick, ...props }: ComponentProps<'a'> & { scenarioId: X402TrustDemoScenario }) {
  const handleClick: MouseEventHandler<HTMLAnchorElement> = (event) => {
    record('evidence_downloaded', scenarioId)
    onClick?.(event)
  }
  return <a {...props} onClick={handleClick} />
}

export function X402TrustIntegrationLink({ onClick, ...props }: ComponentProps<'a'>) {
  const handleClick: MouseEventHandler<HTMLAnchorElement> = (event) => {
    record('integration_requested')
    onClick?.(event)
  }
  return <a {...props} onClick={handleClick} />
}

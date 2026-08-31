'use client'

import Script from 'next/script'
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef } from 'react'

type TurnstileApi = {
  render: (container: HTMLElement, options: Record<string, unknown>) => string
  reset: (widgetId: string) => void
  remove: (widgetId: string) => void
}

declare global {
  interface Window {
    turnstile?: TurnstileApi
  }
}

export type TurnstileFieldHandle = {
  reset: () => void
}

type TurnstileFieldProps = {
  action: string
  onTokenChange: (token: string) => void
  siteKey: string
}

const TurnstileField = forwardRef<TurnstileFieldHandle, TurnstileFieldProps>(function TurnstileField(
  { action, onTokenChange, siteKey },
  ref,
) {
  const containerRef = useRef<HTMLDivElement>(null)
  const widgetIdRef = useRef<string | null>(null)

  const renderWidget = useCallback(() => {
    if (!containerRef.current || !window.turnstile || widgetIdRef.current) return

    widgetIdRef.current = window.turnstile.render(containerRef.current, {
      sitekey: siteKey,
      action,
      callback: (token: string) => onTokenChange(token),
      'error-callback': () => onTokenChange(''),
      'expired-callback': () => onTokenChange(''),
      'timeout-callback': () => onTokenChange(''),
    })
  }, [action, onTokenChange, siteKey])

  useImperativeHandle(ref, () => ({
    reset() {
      onTokenChange('')
      if (widgetIdRef.current && window.turnstile) window.turnstile.reset(widgetIdRef.current)
    },
  }), [onTokenChange])

  useEffect(() => {
    renderWidget()
    return () => {
      if (widgetIdRef.current && window.turnstile) window.turnstile.remove(widgetIdRef.current)
      widgetIdRef.current = null
    }
  }, [renderWidget])

  return <>
    <Script
      src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
      strategy="afterInteractive"
      onReady={renderWidget}
    />
    <div ref={containerRef} />
  </>
})

export default TurnstileField

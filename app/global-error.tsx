'use client'

import * as Sentry from '@sentry/nextjs'
import { useEffect } from 'react'

export default function GlobalError({ error, unstable_retry }: { error: Error & { digest?: string }; unstable_retry: () => void }) {
  useEffect(() => { Sentry.captureException(error) }, [error])
  return <html lang="en"><body className="bg-black text-white"><main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center px-6"><p className="font-mono text-xs uppercase tracking-widest text-red-300">Unexpected application error</p><h1 className="mt-4 text-3xl font-light">This request could not be completed.</h1><p className="mt-4 text-sm leading-6 text-zinc-400">The failure has been recorded without your request payload or credentials. You can retry safely.</p><button type="button" onClick={() => unstable_retry()} className="mt-7 w-fit border border-zinc-600 px-4 py-3 text-sm hover:border-white">Try again</button></main></body></html>
}

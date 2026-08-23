'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'

import { createPaidFetch, type TypedDataRequest } from '@/lib/x402/client'

type SourceDocument = { id: string; title: string; text: string }
type IncludedPassage = { sourceId: string; passageId: string; passageHash: string; text: string }
type SourceManifest = {
  sourceId: string
  title: string
  sourceHash: string
  originalEstimatedTokens: number
  passageCount: number
  includedPassageIds: string[]
  includedEstimatedTokens: number
}
type ContextResult = {
  packId: string
  context: string
  inputHash: string
  outputHash: string
  metrics: {
    originalBytes: number
    compiledBytes: number
    originalEstimatedTokens: number
    compiledEstimatedTokens: number
    estimatedReductionPercent: number
    sourceCount: number
    sourceCoveragePercent: number
    duplicatePassagesRemoved: number
  }
  includedPassages: IncludedPassage[]
  sources: SourceManifest[]
  warnings: string[]
}
type PlaygroundResponse = {
  workload: { name: string; description: string; documents: SourceDocument[] }
  request: {
    clientRequestId: string
    task: string
    tokenBudget: number
    documents: SourceDocument[]
    provenance: 'compact'
    scoring: 'bm25'
    budgetMode: 'guaranteed'
  }
  result: ContextResult
}
type EthereumProvider = {
  request(args: { method: string; params?: unknown[] }): Promise<unknown>
}
type RunState = 'loading' | 'ready' | 'running' | 'error'
type PaymentState = 'idle' | 'connecting' | 'signing' | 'settling' | 'settled' | 'error'

const BASE_CHAIN_ID = 8453
const BASE_CHAIN_HEX = '0x2105'
const MODEL_PRICE_DEFAULT = 3
const X402_FEE_USD = 0.001

function injectedProvider(): EthereumProvider | null {
  return (window as Window & { ethereum?: EthereumProvider }).ethereum ?? null
}

function serializeTypedData(typed: TypedDataRequest) {
  return JSON.stringify({
    domain: typed.domain,
    types: {
      EIP712Domain: [
        { name: 'name', type: 'string' },
        { name: 'version', type: 'string' },
        { name: 'chainId', type: 'uint256' },
        { name: 'verifyingContract', type: 'address' },
      ],
      ...typed.types,
    },
    primaryType: typed.primaryType,
    message: typed.message,
  }, (_key, value) => typeof value === 'bigint' ? value.toString() : value)
}

async function connectBaseWallet(provider: EthereumProvider): Promise<string> {
  const accounts = await provider.request({ method: 'eth_requestAccounts' }) as string[]
  const address = accounts[0]
  if (!address) throw new Error('The wallet did not return an account.')
  const chain = await provider.request({ method: 'eth_chainId' }) as string
  if (Number.parseInt(chain, 16) !== BASE_CHAIN_ID) {
    try {
      await provider.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: BASE_CHAIN_HEX }] })
    } catch (error) {
      const code = (error as { code?: number }).code
      if (code !== 4902) throw error
      await provider.request({
        method: 'wallet_addEthereumChain',
        params: [{
          chainId: BASE_CHAIN_HEX,
          chainName: 'Base',
          nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
          rpcUrls: ['https://mainnet.base.org'],
          blockExplorerUrls: ['https://basescan.org'],
        }],
      })
    }
  }
  return address
}

export default function ContextCompilerPlayground() {
  const [data, setData] = useState<PlaygroundResponse | null>(null)
  const [task, setTask] = useState('Compare how these works describe cognition, adaptation, imagination, agency, and the construction of a self.')
  const [tokenBudget, setTokenBudget] = useState(8_000)
  const [modelPrice, setModelPrice] = useState(MODEL_PRICE_DEFAULT)
  const [runState, setRunState] = useState<RunState>('loading')
  const [error, setError] = useState('')
  const [selectedSource, setSelectedSource] = useState('')
  const [codeTab, setCodeTab] = useState<'typescript' | 'python' | 'crewai' | 'langchain'>('typescript')
  const [copied, setCopied] = useState(false)
  const [paymentState, setPaymentState] = useState<PaymentState>('idle')
  const [paymentMessage, setPaymentMessage] = useState('')
  const [transaction, setTransaction] = useState('')

  const runSample = useCallback(async (initial = false) => {
    setRunState(initial ? 'loading' : 'running')
    setError('')
    try {
      const response = await fetch('/api/context-compiler/playground', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ task, tokenBudget }),
      })
      const payload = await response.json() as PlaygroundResponse & { error?: { message?: string } }
      if (!response.ok) throw new Error(payload.error?.message ?? `The sample returned HTTP ${response.status}.`)
      setData(payload)
      setSelectedSource((current) => current || payload.workload.documents[0]?.id || '')
      setRunState('ready')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The sample could not be compiled.')
      setRunState('error')
    }
  }, [task, tokenBudget])

  useEffect(() => {
    // Defer the initial request until after hydration. The free sample is an
    // external synchronization, while subsequent runs remain user-initiated.
    const timeout = window.setTimeout(() => { void runSample(true) }, 0)
    return () => window.clearTimeout(timeout)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const economics = useMemo(() => {
    const saved = Math.max(0, (data?.result.metrics.originalEstimatedTokens ?? 0) - (data?.result.metrics.compiledEstimatedTokens ?? 0))
    const gross = saved / 1_000_000 * modelPrice
    return { saved, gross, net: gross - X402_FEE_USD, multiple: gross / X402_FEE_USD }
  }, [data, modelPrice])

  const snippets = useMemo(() => data ? integrationSnippets(data.request) : null, [data])
  const activeSource = data?.workload.documents.find((document) => document.id === selectedSource)
  const retainedForSource = data?.result.includedPassages.filter((passage) => passage.sourceId === selectedSource) ?? []

  async function copyCode() {
    if (!snippets) return
    await navigator.clipboard.writeText(snippets[codeTab])
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1_500)
  }

  async function payAndCompile() {
    if (!data) return
    setPaymentState('connecting')
    setPaymentMessage('Connecting a wallet on Base Mainnet…')
    setTransaction('')
    try {
      const provider = injectedProvider()
      if (!provider) throw new Error('No injected wallet was found. Open this page in a browser with Coinbase Wallet or MetaMask.')
      const address = await connectBaseWallet(provider)
      const paidFetch = createPaidFetch({
        address,
        chainId: BASE_CHAIN_ID,
        onPaymentRequired: () => {
          setPaymentState('signing')
          setPaymentMessage('Confirm the 0.001 USDC authorization in your wallet. No approval transaction is required.')
        },
        signTypedData: async (typed) => {
          const signature = await provider.request({
            method: 'eth_signTypedData_v4',
            params: [address, serializeTypedData(typed)],
          })
          setPaymentState('settling')
          setPaymentMessage('Signature accepted. Waiting for Base settlement…')
          return String(signature)
        },
      })
      const response = await paidFetch('/api/v1/compress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data.request, clientRequestId: `playground_paid_${crypto.randomUUID()}` }),
      })
      const paidResult = await response.json() as ContextResult
      setData((current) => current ? { ...current, result: paidResult } : current)
      setTransaction(response.x402?.receipt?.transaction ?? '')
      setPaymentState('settled')
      setPaymentMessage('Paid call settled and the production Context Pack was returned.')
    } catch (caught) {
      setPaymentState('error')
      setPaymentMessage(caught instanceof Error ? caught.message : 'The payment did not complete. No successful settlement was recorded.')
    }
  }

  return (
    <main className="evidence-page">
      <div className="evidence-container">
        <header className="max-w-4xl">
          <p className="font-mono text-[10px] uppercase tracking-[0.26em] text-[var(--text-muted)]">[ zero-install context lab ]</p>
          <h1 className="mt-5 text-4xl font-light leading-tight text-[var(--text-primary)] sm:text-6xl">See what survives before you integrate.</h1>
          <p className="mt-6 max-w-3xl text-lg leading-8 text-[var(--text-secondary)]">Run the production compiler logic against four complete published chapters. Inspect every retained passage, its source handle, and the economics. No account, key, upload, or installation is required.</p>
          <div className="mt-6 flex flex-wrap gap-3 font-mono text-[10px] uppercase tracking-widest text-[var(--text-secondary)]">
            <span className="border border-[var(--border-default)] px-3 py-2">106 KB bundled workload</span>
            <span className="border border-[var(--border-default)] px-3 py-2">Source text not stored</span>
            <span className="border border-[var(--border-default)] px-3 py-2">Payment optional</span>
          </div>
        </header>

        <section className="mt-12 border border-[var(--border-default)] bg-[var(--surface-raised)]/60 p-5 sm:p-7" aria-labelledby="workload-heading">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="flex-1">
              <h2 id="workload-heading" className="text-2xl text-[var(--text-primary)]">Bundled workload</h2>
              <label htmlFor="task" className="mt-5 block font-mono text-[10px] uppercase tracking-widest text-[var(--text-muted)]">Analysis task</label>
              <textarea id="task" value={task} onChange={(event) => setTask(event.target.value)} rows={3} className="evidence-input mt-2" />
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:w-[26rem]">
              <label className="block font-mono text-[10px] uppercase tracking-widest text-[var(--text-muted)]">Token budget
                <input type="number" min={64} max={16000} step={256} value={tokenBudget} onChange={(event) => setTokenBudget(Number(event.target.value))} className="evidence-input mt-2 block" />
              </label>
              <button type="button" onClick={() => void runSample()} disabled={runState === 'loading' || runState === 'running'} className="evidence-action evidence-action--secondary self-end">
                {runState === 'loading' || runState === 'running' ? 'Compiling…' : 'Run free sample'}
              </button>
            </div>
          </div>
          {error && <p role="alert" className="mt-5 border border-[var(--status-unverified)] bg-[var(--surface-raised)] px-4 py-3 text-sm text-[var(--text-secondary)]">{error}</p>}
        </section>

        {data && <>
          <section className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Compilation measurements">
            <Metric label="Estimated reduction" value={`${data.result.metrics.estimatedReductionPercent}%`} detail={`${number(data.result.metrics.originalEstimatedTokens)} → ${number(data.result.metrics.compiledEstimatedTokens)} model-neutral tokens`} />
            <Metric label="Source coverage" value={`${data.result.metrics.sourceCoveragePercent}%`} detail={`${data.result.sources.filter((source) => source.includedPassageIds.length > 0).length} of ${data.result.metrics.sourceCount} sources contributed evidence`} />
            <Metric label="Tokens avoided" value={number(economics.saved)} detail="Estimated input tokens omitted from the downstream prompt" />
            <Metric label="Gross savings / fee" value={`${economics.multiple.toFixed(1)}×`} detail={`At $${modelPrice.toFixed(2)}/1M input tokens versus the $0.001 x402 fee`} />
          </section>

          <section className="mt-6 grid grid-cols-[minmax(0,1fr)] gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]" aria-labelledby="comparison-heading">
            <h2 id="comparison-heading" className="sr-only">Original and compiled context comparison</h2>
            <article className="min-w-0 border border-[var(--border-default)] bg-[var(--surface-raised)]/40">
              <div className="border-b border-[var(--border-default)] p-5">
                <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--text-muted)]">Original sources</p>
                <p className="mt-2 text-sm text-[var(--text-secondary)]">{number(data.result.metrics.originalBytes)} bytes across {data.workload.documents.length} complete chapters</p>
                <label htmlFor="source" className="sr-only">Choose source document</label>
                <select id="source" value={selectedSource} onChange={(event) => setSelectedSource(event.target.value)} className="evidence-input mt-4">
                  {data.workload.documents.map((document) => <option key={document.id} value={document.id}>{document.title}</option>)}
                </select>
              </div>
              <div className="max-h-[34rem] overflow-y-auto p-5">
                <pre className="whitespace-pre-wrap font-sans text-sm leading-7 text-[var(--text-secondary)]">{activeSource?.text}</pre>
              </div>
            </article>
            <article className="min-w-0 border border-[var(--status-sourced)] bg-[var(--surface-raised)]">
              <div className="border-b border-[var(--status-sourced)] p-5">
                <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--text-muted)]">Compiled Context Pack</p>
                <p className="mt-2 text-sm text-[var(--text-secondary)]">{number(data.result.metrics.compiledBytes)} bytes · extractive BM25 selection · guaranteed budget mode</p>
              </div>
              <div className="max-h-[34rem] overflow-y-auto p-5">
                <pre className="whitespace-pre-wrap font-mono text-xs leading-6 text-[var(--text-secondary)]">{data.result.context}</pre>
              </div>
            </article>
          </section>

          <section className="mt-6 border border-[var(--border-default)] p-5 sm:p-7" aria-labelledby="provenance-heading">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div><p className="font-mono text-[10px] uppercase tracking-widest text-[var(--text-muted)]">Evidence path</p><h2 id="provenance-heading" className="mt-2 text-2xl text-[var(--text-primary)]">Retained passages from {activeSource?.title}</h2></div>
              <p className="font-mono text-xs text-[var(--text-muted)]">{retainedForSource.length} retained</p>
            </div>
            <div className="mt-6 grid grid-cols-[minmax(0,1fr)] gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
              {retainedForSource.map((passage) => <article key={passage.passageId} className="border-l-2 border-[var(--status-sourced)] bg-[var(--surface-raised)] p-4"><p className="font-mono text-[10px] uppercase tracking-widest text-[var(--text-muted)]">{passage.passageId}</p><p className="mt-3 text-sm leading-6 text-[var(--text-secondary)]">{passage.text}</p><p className="mt-3 break-all font-mono text-[9px] text-[var(--text-muted)]">{passage.passageHash}</p></article>)}
            </div>
          </section>

          <section className="mt-6 grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
            <article className="border border-[var(--border-default)] p-5 sm:p-7">
              <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--status-verified)]">Projected economics</p>
              <h2 className="mt-2 text-2xl text-[var(--text-primary)]">Would the paid call clear its fee?</h2>
              <label className="mt-6 block max-w-xs font-mono text-[10px] uppercase tracking-widest text-[var(--text-muted)]">Model input price ($ / 1M tokens)
                <input type="number" min={0} step={0.1} value={modelPrice} onChange={(event) => setModelPrice(Math.max(0, Number(event.target.value)))} className="evidence-input mt-2 block" />
              </label>
              <dl className="mt-6 grid gap-4 sm:grid-cols-3">
                <Economic label="Gross input cost avoided" value={`$${economics.gross.toFixed(4)}`} />
                <Economic label="x402 fee" value="$0.0010" />
                <Economic label="Net projected saving" value={`${economics.net < 0 ? '-' : ''}$${Math.abs(economics.net).toFixed(4)}`} />
              </dl>
              <p className="mt-5 text-xs leading-5 text-[var(--text-muted)]">Projection covers one downstream model call and input tokens only. Provider tokenization, cache pricing, output costs, and answer quality are not included.</p>
            </article>
            <article className="border border-[var(--status-boundary)] bg-[var(--surface-raised)] p-5 sm:p-7">
              <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--status-boundary)]">Optional live settlement</p>
              <h2 className="mt-2 text-2xl text-[var(--text-primary)]">Pay once on Base</h2>
              <p className="mt-4 text-sm leading-6 text-[var(--text-secondary)]">This repeats the visible workload against the production x402 endpoint. It will request exactly 0.001 USDC after showing the terms in your wallet.</p>
              <button type="button" onClick={() => void payAndCompile()} disabled={['connecting', 'signing', 'settling'].includes(paymentState)} className="evidence-action evidence-action--secondary mt-6 w-full">Pay $0.001 and compile</button>
              {paymentMessage && <p role="status" className={`mt-4 text-sm leading-6 ${paymentState === 'error' ? 'text-[var(--status-unverified)]' : paymentState === 'settled' ? 'text-[var(--status-verified)]' : 'text-[var(--text-secondary)]'}`}>{paymentMessage}</p>}
              {transaction && <a className="mt-3 block break-all font-mono text-[10px] text-[var(--text-muted)] underline" href={`https://basescan.org/tx/${transaction}`} target="_blank" rel="noopener noreferrer">View transaction {transaction} ↗</a>}
            </article>
          </section>

          <section className="mt-6 border border-[var(--border-default)] bg-[var(--surface-raised)]/50 p-5 sm:p-7" aria-labelledby="integration-heading">
            <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--text-muted)]">Take it with you</p>
            <div className="mt-2 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><h2 id="integration-heading" className="text-2xl text-[var(--text-primary)]">Copy a working integration</h2><p className="mt-2 text-sm text-[var(--text-secondary)]">Use an API key in application code. The browser payment above is deliberately human-authorized.</p></div><button type="button" onClick={() => void copyCode()} className="evidence-action evidence-action--secondary">{copied ? 'Copied' : 'Copy code'}</button></div>
            <div className="mt-6 flex flex-wrap gap-2" role="tablist" aria-label="Integration language">
              {(['typescript', 'python', 'crewai', 'langchain'] as const).map((tab) => <button key={tab} type="button" role="tab" aria-selected={codeTab === tab} onClick={() => setCodeTab(tab)} className={`border px-4 py-2 font-mono text-[10px] uppercase tracking-widest ${codeTab === tab ? 'border-[var(--status-sourced)] bg-[var(--surface-raised)] text-[var(--text-muted)]' : 'border-[var(--border-default)] text-[var(--text-muted)] hover:text-[var(--text-secondary)]'}`}>{tab}</button>)}
            </div>
            <pre className="mt-4 max-h-[32rem] overflow-auto border border-[var(--border-default)] bg-[var(--surface-raised)] p-4 font-mono text-xs leading-6 text-[var(--text-muted)]"><code>{snippets?.[codeTab]}</code></pre>
          </section>

          <section className="mt-6 border border-[var(--border-default)] p-5 text-xs leading-6 text-[var(--text-muted)]">
            <p><strong className="text-[var(--text-secondary)]">Honest boundary:</strong> selection is extractive and best-effort. It does not verify claims, guarantee completeness, or prevent hallucination. Source coverage means each source contributed at least one passage—not that every fact survived.</p>
            <p className="mt-3 break-all font-mono text-[9px] text-[var(--text-muted)]">input {data.result.inputHash}<br />output {data.result.outputHash}</p>
          </section>
        </>}
      </div>
    </main>
  )
}

function number(value: number) { return new Intl.NumberFormat('en-US').format(value) }

function Metric({ label, value, detail }: { label: string; value: string; detail: string }) {
  return <article className="border border-[var(--border-default)] bg-[var(--surface-raised)]/50 p-5"><p className="font-mono text-[10px] uppercase tracking-widest text-[var(--text-muted)]">{label}</p><p className="mt-3 font-mono text-2xl text-[var(--text-primary)]">{value}</p><p className="mt-3 text-xs leading-5 text-[var(--text-muted)]">{detail}</p></article>
}

function Economic({ label, value }: { label: string; value: string }) {
  return <div><dt className="font-mono text-[10px] uppercase tracking-widest text-[var(--text-muted)]">{label}</dt><dd className="mt-2 font-mono text-xl text-[var(--status-verified)]">{value}</dd></div>
}

function integrationSnippets(request: PlaygroundResponse['request']) {
  const task = JSON.stringify(request.task)
  const budget = request.tokenBudget
  return {
    typescript: `import { readFile } from 'node:fs/promises'
import { MahaClient } from '@mahastrategies/sdk'

const maha = new MahaClient({ apiKey: process.env.MAHA_API_KEY! })
const documents = await Promise.all([
  ['source-1', 'First document', './documents/first.md'],
  ['source-2', 'Second document', './documents/second.md'],
].map(async ([id, title, path]) => ({
  id, title, text: await readFile(path, 'utf8'),
})))

const pack = await maha.compress({
  clientRequestId: crypto.randomUUID(),
  task: ${task},
  tokenBudget: ${budget},
  documents,
  scoring: 'bm25',
  provenance: 'compact',
  budgetMode: 'guaranteed',
})

console.log(pack.context)`,
    python: `import os
from pathlib import Path
from maha_sdk import MahaClient

maha = MahaClient(api_key=os.environ["MAHA_API_KEY"])
documents = [
    {"id": "source-1", "title": "First document", "text": Path("documents/first.md").read_text()},
    {"id": "source-2", "title": "Second document", "text": Path("documents/second.md").read_text()},
]
pack = maha.compress(
    task=${task},
    token_budget=${budget},
    documents=documents,
)
print(pack.context)`,
    crewai: `import os
from crewai import Agent, Task, Crew
from maha_sdk import MahaClient
from maha_sdk.crewai import maha_tools

client = MahaClient(api_key=os.environ["MAHA_API_KEY"])
researcher = Agent(
    role="Evidence researcher",
    goal="Answer from a token-bounded, source-linked context pack",
    tools=maha_tools(client),
)
task = Task(
    description=${task},
    expected_output="A concise analysis with source handles",
    agent=researcher,
)
print(Crew(agents=[researcher], tasks=[task]).kickoff())`,
    langchain: `import os
from langgraph.prebuilt import create_react_agent
from maha_sdk import MahaClient
from maha_sdk.langchain import MahaToolkit

client = MahaClient(api_key=os.environ["MAHA_API_KEY"])
tools = MahaToolkit(client).get_tools()
agent = create_react_agent(llm, tools)
result = agent.invoke({"messages": [{
    "role": "user",
    "content": ${task}
}]})
print(result)`,
  }
}

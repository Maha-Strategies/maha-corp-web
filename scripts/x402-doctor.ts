import { readFile, writeFile } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'

import { privateKeyToAccount } from 'viem/accounts'

import {
  diagnoseX402Endpoint,
  doctorReportToSarif,
  type DoctorReport,
  type DoctorRequest,
  type PaidProbe,
} from '../lib/x402/doctor.ts'
import { createPaidFetch, type PaymentRequirement } from '../lib/x402/client.ts'

type OutputFormat = 'human' | 'json' | 'sarif'

export type DoctorCliOptions = {
  endpoint: string
  request: DoctorRequest
  bazaarUrl?: string
  timeoutMs: number
  format: OutputFormat
  output?: string
  failOnWarning: boolean
  pay: boolean
  maxAmount: bigint
  privateKeyEnvironment: string
}

function valueAfter(argv: string[], index: number, flag: string): string {
  const value = argv[index + 1]
  if (!value || value.startsWith('--')) throw new Error(`${flag} requires a value.`)
  return value
}

export async function parseDoctorArgs(argv: string[]): Promise<DoctorCliOptions> {
  const request: DoctorRequest = { method: 'GET', headers: {} }
  let endpoint = ''
  let bazaarUrl: string | undefined
  let timeoutMs = 15_000
  let format: OutputFormat = 'human'
  let output: string | undefined
  let failOnWarning = false
  let pay = false
  let maxAmount = BigInt(0)
  let privateKeyEnvironment = 'X402_BUYER_PRIVATE_KEY'

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]
    if (!argument.startsWith('--')) {
      if (endpoint) throw new Error('Provide exactly one endpoint URL.')
      endpoint = argument
      continue
    }
    if (argument === '--pay') { pay = true; continue }
    if (argument === '--fail-on-warning') { failOnWarning = true; continue }
    if (argument === '--method') { request.method = valueAfter(argv, index++, argument).toUpperCase(); continue }
    if (argument === '--body') {
      const value = valueAfter(argv, index++, argument)
      request.body = value.startsWith('@') ? await readFile(value.slice(1), 'utf8') : value
      continue
    }
    if (argument === '--header') {
      const value = valueAfter(argv, index++, argument)
      const separator = value.indexOf(':')
      if (separator <= 0) throw new Error('--header must use Name:Value syntax.')
      request.headers![value.slice(0, separator).trim()] = value.slice(separator + 1).trim()
      continue
    }
    if (argument === '--bazaar-url') { bazaarUrl = valueAfter(argv, index++, argument); continue }
    if (argument === '--timeout-ms') {
      timeoutMs = Number(valueAfter(argv, index++, argument))
      if (!Number.isInteger(timeoutMs) || timeoutMs < 1_000 || timeoutMs > 60_000) throw new Error('--timeout-ms must be between 1000 and 60000.')
      continue
    }
    if (argument === '--format') {
      const value = valueAfter(argv, index++, argument)
      if (!['human', 'json', 'sarif'].includes(value)) throw new Error('--format must be human, json, or sarif.')
      format = value as OutputFormat
      continue
    }
    if (argument === '--output') { output = valueAfter(argv, index++, argument); continue }
    if (argument === '--max-amount') {
      const value = valueAfter(argv, index++, argument)
      if (!/^[1-9][0-9]*$/.test(value)) throw new Error('--max-amount must be a positive integer in asset base units.')
      maxAmount = BigInt(value)
      continue
    }
    if (argument === '--private-key-env') { privateKeyEnvironment = valueAfter(argv, index++, argument); continue }
    throw new Error(`Unknown option: ${argument}`)
  }

  if (!endpoint) throw new Error('Usage: x402-doctor <https-endpoint> [options]')
  if (request.body !== undefined && !Object.keys(request.headers!).some((key) => key.toLowerCase() === 'content-type')) {
    request.headers!['content-type'] = 'application/json'
  }
  if (pay && maxAmount === BigInt(0)) throw new Error('--pay requires an explicit --max-amount in asset base units.')
  return { endpoint, request, bazaarUrl, timeoutMs, format, output, failOnWarning, pay, maxAmount, privateKeyEnvironment }
}

function sameRequirement(left: PaymentRequirement, right: PaymentRequirement): boolean {
  return left.scheme === right.scheme
    && left.network === right.network
    && left.amount === right.amount
    && left.asset.toLowerCase() === right.asset.toLowerCase()
    && left.payTo.toLowerCase() === right.payTo.toLowerCase()
}

function paidProbe(options: DoctorCliOptions): PaidProbe {
  const privateKey = process.env[options.privateKeyEnvironment]?.trim()
  if (!privateKey || !/^0x[a-fA-F0-9]{64}$/.test(privateKey)) {
    throw new Error(`${options.privateKeyEnvironment} must contain a dedicated EVM private key.`)
  }
  const account = privateKeyToAccount(privateKey as `0x${string}`)
  return async ({ url, request, challenge }) => {
    const expected = challenge.accepts.find((requirement) => requirement.network.startsWith('eip155:'))
    if (!expected) throw new Error('The paid probe currently supports EVM requirements only.')
    const chainId = Number(expected.network.slice('eip155:'.length))
    const amount = BigInt(expected.amount)
    if (amount <= BigInt(0) || amount > options.maxAmount) {
      throw new Error(`Refusing ${amount} base units; --max-amount is ${options.maxAmount}.`)
    }
    const paidFetch = createPaidFetch({
      address: account.address,
      chainId,
      signTypedData: (typedData) => account.signTypedData(typedData as Parameters<typeof account.signTypedData>[0]),
      onPaymentRequired(requirement) {
        if (!sameRequirement(requirement, expected)) throw new Error('The payment terms changed between diagnosis and signing.')
        const liveAmount = BigInt(requirement.amount)
        if (liveAmount <= BigInt(0) || liveAmount > options.maxAmount) throw new Error('The live payment exceeds the explicit ceiling.')
      },
    })
    return paidFetch(url, {
      method: request.method,
      headers: request.headers,
      body: request.body,
    })
  }
}

function human(report: DoctorReport): string {
  const icon = report.ok ? 'PASS' : 'FAIL'
  const lines = [
    `x402-doctor ${icon}: ${report.endpoint}`,
    `HTTP ${report.live?.status ?? 'unavailable'} · crawler ${report.live?.crawlerStatus ?? 'not run'} · ${report.summary.errors} errors · ${report.summary.warnings} warnings`,
  ]
  if (report.live?.declarationDigest) lines.push(`Live declaration: ${report.live.declarationDigest}`)
  if (report.bazaar?.found) lines.push(`Bazaar declaration: ${report.bazaar.declarationDigest} (${report.bazaar.matchesLive ? 'current' : 'stale'})`)
  else if (report.bazaar) lines.push('Bazaar declaration: not found')
  for (const finding of report.findings) {
    lines.push(`[${finding.level.toUpperCase()}] ${finding.ruleId}: ${finding.message}${finding.detail ? `\n  ${finding.detail}` : ''}`)
  }
  if (report.live?.transaction) lines.push(`Settlement: ${report.live.transaction}`)
  return `${lines.join('\n')}\n`
}

async function run(): Promise<void> {
  const options = await parseDoctorArgs(process.argv.slice(2))
  const report = await diagnoseX402Endpoint({
    endpoint: options.endpoint,
    request: options.request,
    bazaarUrl: options.bazaarUrl,
    timeoutMs: options.timeoutMs,
    ...(options.pay ? { paidProbe: paidProbe(options) } : {}),
  })
  const output = options.format === 'human'
    ? human(report)
    : `${JSON.stringify(options.format === 'sarif' ? doctorReportToSarif(report) : report, null, 2)}\n`
  if (options.output) await writeFile(options.output, output, 'utf8')
  else process.stdout.write(output)
  if (!report.ok || (options.failOnWarning && report.summary.warnings > 0)) process.exitCode = 1
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  run().catch((error) => {
    console.error(`x402-doctor failed: ${error instanceof Error ? error.message : String(error)}`)
    process.exitCode = 2
  })
}

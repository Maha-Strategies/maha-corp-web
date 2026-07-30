#!/usr/bin/env node
/** Dependency-free CLI source for the published @mahastrategies/cli wrapper. */
import { readFile } from 'node:fs/promises'
import { extname, resolve } from 'node:path'
import { createInterface } from 'node:readline/promises'
import { stdin as input, stdout as output } from 'node:process'

type AuditResult = { file: string; bytes: number; estimated_tokens: number; simulated_compressed_tokens: number; simulated_savings_percent: number }
const COLOR = { cyan: '\u001b[36m', green: '\u001b[32m', yellow: '\u001b[33m', red: '\u001b[31m', reset: '\u001b[0m' }
const baseUrl = (process.env.MAHA_BASE_URL ?? 'https://www.mahastrategies.com').replace(/\/$/, '')

function jsonEnabled(args: string[]) { return args.includes('--json') }
function printJson(value: unknown) { output.write(`${JSON.stringify(value, null, 2)}\n`) }
function estimateTokens(text: string) { return Math.max(1, Math.ceil(text.trim().length / 4)) }
function table(rows: Array<[string, string]>) { const width = Math.max(...rows.map(([label]) => label.length)); for (const [label, value] of rows) output.write(`  ${COLOR.cyan}${label.padEnd(width)}${COLOR.reset}  ${value}\n`) }

async function audit(filePath: string, asJson: boolean) {
  const extension = extname(filePath).toLowerCase()
  if (!['.md', '.markdown', '.txt'].includes(extension)) throw new Error('audit accepts Markdown (.md, .markdown) and plain-text (.txt) files only.')
  const absolutePath = resolve(filePath)
  const content = await readFile(absolutePath, 'utf8')
  const tokens = estimateTokens(content)
  const result: AuditResult = { file: absolutePath, bytes: Buffer.byteLength(content, 'utf8'), estimated_tokens: tokens, simulated_compressed_tokens: Math.ceil(tokens * 0.45), simulated_savings_percent: 55 }
  if (asJson) return printJson(result)
  output.write(`\n${COLOR.green}Maha Context Audit${COLOR.reset}\n\n`)
  table([['File', result.file], ['Raw bytes', result.bytes.toLocaleString()], ['Estimated prompt tokens', result.estimated_tokens.toLocaleString()], ['Simulated compressed tokens', result.simulated_compressed_tokens.toLocaleString()], ['Simulated savings', `${COLOR.green}${result.simulated_savings_percent}%${COLOR.reset}`]])
  output.write(`\n${COLOR.yellow}Simulation only:${COLOR.reset} provider tokenization and production compression can vary.\n`)
}

async function key(asJson: boolean) {
  const terminal = createInterface({ input, output })
  const email = (await terminal.question('Email for your free Maha API key: ')).trim()
  terminal.close()
  if (!/^\S+@\S+\.\S+$/.test(email)) throw new Error('Enter a valid email address.')
  const response = await fetch(`${baseUrl}/api/v1/keys/generate`, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify({ email }) })
  const data = await response.json().catch(() => ({})) as { apiKey?: string; apiKeyId?: string; balanceCredits?: number; error?: { message?: string } }
  if (!response.ok || !data.apiKey) throw new Error(data.error?.message ?? `Key generation failed (${response.status}).`)
  if (asJson) return printJson({ api_key: data.apiKey, api_key_id: data.apiKeyId, balance_credits: data.balanceCredits })
  output.write(`\n${COLOR.green}Your Maha API key (shown once):${COLOR.reset}\n${data.apiKey}\n\nFree balance: ${(data.balanceCredits ?? 0).toLocaleString()} credits. Store this key in a secret manager.\n`)
}

function usage() { output.write('Usage:\n  maha audit <filepath> [--json]\n  maha key [--json]\n') }

async function main() {
  const args = process.argv.slice(2)
  const command = args.find((arg) => !arg.startsWith('-'))
  const asJson = jsonEnabled(args)
  if (args.includes('--help') || args.includes('-h')) { usage(); return }
  if (command === 'audit') { const path = args.slice(args.indexOf(command) + 1).find((arg) => !arg.startsWith('-')); if (!path) throw new Error('Specify a file path: maha audit <filepath>.'); await audit(path, asJson); return }
  if (command === 'key') { await key(asJson); return }
  usage(); process.exitCode = 1
}

main().catch((error: unknown) => { const message = error instanceof Error ? error.message : 'Unexpected CLI error.'; if (jsonEnabled(process.argv.slice(2))) printJson({ error: message }); else output.write(`${COLOR.red}Error:${COLOR.reset} ${message}\n`); process.exitCode = 1 })

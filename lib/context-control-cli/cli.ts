#!/usr/bin/env node
/**
 * maha-context entry point.
 *
 * Exit codes are the contract for CI: 0 usable, 1 not. `doctor` returning
 * non-zero on incomplete configuration is the whole point of having it.
 */
import { readFileSync } from 'node:fs'

import { GATEWAY_NAMES, compile, doctor, gatewayValidate, verify, type GatewayName } from './index.ts'

const USAGE = `maha-context — context-control evaluation CLI

  maha-context doctor
      Validate environment and configuration. Prints no secret.
      Exits non-zero when configuration is incomplete or unsafe.

  maha-context compile --input <sanitized.json> --output <evidence.json>
      Compile one sanitized fixture against MAHA_COMPILER_URL and write a
      sanitized evidence record. Never writes source text or credentials.

  maha-context verify --input <evidence.json>
      Check evidence structure, hash formatting, policy version and budget
      fields. Labels what is checkable locally versus trusted pass-through.

  maha-context gateway validate <wso2|kong|apigee|cloudflare>
      Statically validate an adapter artifact. Deploys nothing.

Shell completion (optional, not required for any command):
  bash   maha-context completion bash  >> ~/.bashrc
  zsh    maha-context completion zsh   >> ~/.zshrc
`

const COMPLETION: Record<string, string> = {
  bash: `complete -W "doctor compile verify gateway completion" maha-context`,
  zsh: `compdef '_arguments "1:command:(doctor compile verify gateway completion)"' maha-context`,
}

function flag(argv: string[], name: string): string | undefined {
  const index = argv.indexOf(`--${name}`)
  return index >= 0 ? argv[index + 1] : undefined
}

const print = (value: unknown): void => { process.stdout.write(`${JSON.stringify(value, null, 2)}\n`) }

async function main(argv: string[]): Promise<number> {
  const [command, ...rest] = argv

  if (!command || command === 'help' || command === '--help' || command === '-h') {
    process.stdout.write(USAGE)
    return command ? 0 : 1
  }

  if (command === 'completion') {
    const shell = rest[0] ?? ''
    if (!COMPLETION[shell]) { process.stderr.write('Supported shells: bash, zsh\n'); return 1 }
    process.stdout.write(`${COMPLETION[shell]}\n`)
    return 0
  }

  if (command === 'doctor') {
    const report = doctor()
    print(report)
    return report.status === 'ok' ? 0 : 1
  }

  if (command === 'compile') {
    const input = flag(rest, 'input')
    const output = flag(rest, 'output')
    if (!input || !output) { process.stderr.write('compile requires --input and --output\n'); return 1 }
    try {
      print(await compile({ inputPath: input, outputPath: output }))
      return 0
    } catch (error) {
      // The message is ours, never the endpoint's echo of caller input.
      process.stderr.write(`${error instanceof Error ? error.message : 'compile failed'}\n`)
      return 1
    }
  }

  if (command === 'verify') {
    const input = flag(rest, 'input')
    if (!input) { process.stderr.write('verify requires --input\n'); return 1 }
    let parsed: unknown
    try { parsed = JSON.parse(readFileSync(input, 'utf8')) } catch { process.stderr.write('The evidence file is not valid JSON.\n'); return 1 }
    const report = verify(parsed)
    print(report)
    return report.status === 'ok' ? 0 : 1
  }

  if (command === 'gateway') {
    const [subcommand, gateway] = rest
    if (subcommand !== 'validate' || !gateway) { process.stderr.write('usage: maha-context gateway validate <wso2|kong|apigee|cloudflare>\n'); return 1 }
    if (!GATEWAY_NAMES.includes(gateway as GatewayName)) {
      process.stderr.write(`unknown gateway: ${gateway}. Expected one of ${GATEWAY_NAMES.join(', ')}\n`)
      return 1
    }
    const report = gatewayValidate(gateway as GatewayName)
    print(report)
    return report.status === 'ok' ? 0 : 1
  }

  process.stderr.write(`unknown command: ${command}\n${USAGE}`)
  return 1
}

process.exitCode = await main(process.argv.slice(2))

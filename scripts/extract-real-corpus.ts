/**
 * Builds a measurement corpus from real agent traces on this machine.
 *
 *   node --experimental-strip-types scripts/extract-real-corpus.ts <out-dir>
 *   npm run measure:compression -- --corpus <out-dir>
 *
 * Why this exists: /api/v1/compress retains nothing. It answers with
 * `sourceTextStored: false, compiledContextStored: false`, which is a
 * deliberate product property, so no customer payload has ever been kept and
 * none ever will be. There is therefore no production corpus to benchmark
 * against and no amount of traffic will create one.
 *
 * The nearest real thing is a Claude Code session transcript: a genuine
 * multi-turn agent trace with tool calls and verbose tool results, which is
 * precisely the payload shape the product targets. It is real in structure and
 * real in vocabulary, which is what the synthetic corpus cannot be.
 *
 * PRIVACY. Transcripts contain whatever was in the session, which for this
 * project includes operational detail. This script reads them locally, writes
 * locally, and sends nothing anywhere. Write the output somewhere outside the
 * repository and do not commit it.
 *
 * RETENTION IS NOT MEASURABLE HERE. Retention needs ground truth -- which
 * passages a correct answer depends on -- and a raw transcript carries no
 * labels. The corpora written here have an empty `needles` array, so the
 * harness reports reduction, density and latency on real data and reports
 * retention as unavailable rather than inventing it. Labelling a sample by
 * hand is the only way to get a real retention number, and it is worth doing.
 */

import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'

const outputDirectory = process.argv[2]
if (!outputDirectory) {
  console.error('Usage: extract-real-corpus.ts <out-dir>   (choose a path outside the repo)')
  process.exit(1)
}

const SESSION_ROOT = process.env.CLAUDE_SESSION_DIR?.trim()
  || join(homedir(), '.claude', 'projects', '-Users-mayonerajan-Projects-maha-corp-web')

type Block = { type?: string; text?: string; name?: string; input?: unknown; content?: unknown }
type Record_ = { type?: string; message?: { role?: string; content?: unknown } }

const asBlocks = (content: unknown): Block[] =>
  Array.isArray(content) ? content as Block[] : typeof content === 'string' ? [{ type: 'text', text: content }] : []

function renderToolResult(content: unknown): string {
  if (typeof content === 'string') return content
  if (Array.isArray(content)) {
    return content.map((item) => typeof item === 'string' ? item : (item as Block)?.text ?? '').filter(Boolean).join('\n')
  }
  return ''
}

/**
 * One passage per turn element, blank-line separated -- the same structure the
 * compiler splits on, so the trace is presented the way a caller would send it
 * rather than pre-chunked into a shape that flatters the result.
 */
async function traceFrom(file: string): Promise<{ text: string; firstUserMessage: string; turns: number } | null> {
  const lines = (await readFile(file, 'utf8')).split('\n').filter(Boolean)
  const blocks: string[] = []
  let firstUserMessage = ''
  let turns = 0

  for (const line of lines) {
    let record: Record_
    try { record = JSON.parse(line) as Record_ } catch { continue }
    if (record.type !== 'assistant' && record.type !== 'user') continue

    for (const block of asBlocks(record.message?.content)) {
      if (block.type === 'text' && block.text?.trim()) {
        if (record.type === 'user' && !firstUserMessage) firstUserMessage = block.text.trim().slice(0, 400)
        blocks.push(`[${record.type}] ${block.text.trim()}`)
      } else if (block.type === 'tool_use') {
        turns += 1
        blocks.push(`[tool_call] ${block.name}(${JSON.stringify(block.input).slice(0, 2_000)})`)
      } else if (block.type === 'tool_result') {
        const rendered = renderToolResult(block.content).trim()
        if (rendered) blocks.push(`[observation] ${rendered.slice(0, 6_000)}`)
      }
    }
  }

  if (blocks.length < 20) return null
  return { text: blocks.join('\n\n'), firstUserMessage, turns }
}

const files = (await readdir(SESSION_ROOT).catch(() => [] as string[])).filter((name) => name.endsWith('.jsonl'))
if (files.length === 0) {
  console.error(`No transcripts under ${SESSION_ROOT}. Set CLAUDE_SESSION_DIR to a directory containing .jsonl session files.`)
  process.exit(1)
}

await mkdir(outputDirectory, { recursive: true })
let written = 0

for (const file of files) {
  const trace = await traceFrom(join(SESSION_ROOT, file))
  if (!trace) continue

  const corpus = {
    name: `real-agent-trace-${file.slice(0, 8)}`,
    // The task the session actually opened with, so scoring is exercised
    // against a real question rather than one written to suit the corpus.
    task: trace.firstUserMessage || 'Summarise what was done in this session and why.',
    description: `Real Claude Code session transcript, ${trace.turns} tool calls. Unlabelled: retention cannot be measured without ground truth.`,
    documents: [{ id: 'session', title: 'Agent session transcript', text: trace.text }],
    needles: [] as string[],
  }

  await writeFile(join(outputDirectory, `${corpus.name}.json`), JSON.stringify(corpus, null, 2))
  written += 1
  console.log(`${corpus.name}: ${trace.turns} tool calls, ${Buffer.byteLength(trace.text, 'utf8').toLocaleString()} bytes`)
}

console.log(`\n${written} corpus file(s) written to ${outputDirectory}`)
console.log('These contain real session content. Keep them out of version control.')
console.log(`\nRun:  npm run measure:compression -- --corpus ${outputDirectory}`)

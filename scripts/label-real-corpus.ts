/**
 * Adds hand-written ground truth to the real-trace corpora.
 *
 *   node --experimental-strip-types scripts/extract-real-corpus.ts <dir>
 *   node --experimental-strip-types scripts/label-real-corpus.ts <dir>
 *   npm run measure:compression -- --corpus <dir>
 *
 * Retention cannot be measured without knowing which passages carry the
 * answer, and a raw transcript carries no labels. These were written by
 * reading the traces: each is a question someone could plausibly ask of that
 * session, paired with verbatim fragments of the passages that answer it.
 *
 * Every needle is verified to appear in the corpus before anything is written,
 * and its occurrence count is reported. That count is the difficulty: an
 * answer repeated across ten passages is nearly impossible to lose, and one
 * that appears once is the real test. A label set of only easy questions would
 * produce a retention figure that means nothing.
 *
 * These labels are the analyst's judgement, not fact. Someone else reading the
 * same traces would choose different questions and might disagree about which
 * passages answer them. That is a limitation of hand-labelling and not one
 * this script can remove.
 */

import { readdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

type Corpus = { name: string; task: string; description: string; documents: Array<{ id: string; title?: string; text: string }>; needles: string[] }

type Label = { match: string; task: string; needles: string[]; note: string }

// Keyed by a fragment of the session id so labels survive re-extraction.
const LABELS: Label[] = [
  {
    match: 'c0026fcf',
    task: 'What are the decimals and EIP-712 domain version of the Base Sepolia USDC contract we verified on chain?',
    needles: ['decimals: 6', 'version: 2'],
    note: 'Single contract read. The hardest label in the set: the answer exists in one short passage.',
  },
  {
    match: 'c0026fcf',
    task: 'Why did the x402 facilitator reject the signed payment authorization?',
    needles: ['invalid_exact_evm_missing_eip712_domain'],
    note: 'Repeated across the debugging sequence, so an easier retrieval.',
  },
  {
    match: 'c0026fcf',
    task: 'How many tokens of framing overhead does each provenance header add to a compressed pack?',
    needles: ['per-passage overhead'],
    note: 'Appears in the probe output and nowhere else.',
  },
  {
    match: 'c0026fcf',
    task: 'Are any x402 environment variables configured in the production environment?',
    needles: ['no X402 variables in Production'],
    note: 'Checked repeatedly across the session.',
  },
  {
    match: '741e2117',
    task: 'What did the MPS operations control plane return when the lookup endpoint was called?',
    needles: ['The MPS operations control plane is not configured.'],
    note: 'A specific error string from one probe.',
  },
  {
    match: '741e2117',
    task: 'Did the dependency audit find any vulnerabilities?',
    needles: ['found 0 vulnerabilities'],
    note: 'Repeated many times; near-certain retrieval, included as a control.',
  },
  {
    match: '741e2117',
    task: 'What lint error was reported in the audit access checkout component?',
    needles: ['Calling setState synchronously within an effect'],
    note: 'One lint run, one passage.',
  },
]

const directory = process.argv[2]
if (!directory) {
  console.error('Usage: label-real-corpus.ts <corpus-dir>')
  process.exit(1)
}

const files = (await readdir(directory)).filter((name) => name.endsWith('.json') && !name.includes('.labelled.'))
let written = 0
let skipped = 0

for (const file of files) {
  const corpus = JSON.parse(await readFile(join(directory, file), 'utf8')) as Corpus
  const text = corpus.documents.map((document) => document.text).join('\n\n')
  const passages = text.split(/\n{2,}/).filter((passage) => passage.trim())

  for (const [index, label] of LABELS.filter((entry) => corpus.name.includes(entry.match)).entries()) {
    // Verified before writing. A needle that is not present would silently
    // score as an unretained answer and make the compiler look worse than it
    // is -- the failure mode this whole exercise exists to avoid.
    const counts = label.needles.map((needle) => passages.filter((passage) => passage.includes(needle)).length)
    if (counts.some((count) => count === 0)) {
      const missing = label.needles.filter((_, position) => counts[position] === 0)
      console.error(`  SKIP  ${corpus.name} #${index + 1}: needle not present verbatim — ${JSON.stringify(missing)}`)
      skipped += 1
      continue
    }

    const labelled: Corpus = {
      ...corpus,
      name: `${corpus.name}-q${index + 1}`,
      task: label.task,
      description: `${corpus.description} Hand-labelled: ${label.note}`,
      needles: label.needles,
    }
    await writeFile(join(directory, `${labelled.name}.labelled.json`), JSON.stringify(labelled, null, 2))
    written += 1
    console.log(`  ok    ${labelled.name}  needles in ${counts.join('/')} passage(s) of ${passages.length}`)
    console.log(`        "${label.task}"`)
  }
}

console.log(`\n${written} labelled corpus file(s) written, ${skipped} skipped.`)
console.log('Move the unlabelled originals aside before measuring, or the run will include both.')

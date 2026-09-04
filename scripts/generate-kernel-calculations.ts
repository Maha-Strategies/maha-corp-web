/**
 * Kernel-verified calculations for knowledge pages.
 *
 * The corpus has carried exactly one calculation, and it was a JavaScript
 * fixture: a reader had to take the numbers on trust. These receipts are
 * produced by executing the WebAssembly kernel and are verified here by
 * re-executing it and comparing the result, so a reader who rebuilds the kernel
 * from source can obtain the same digest and the same output.
 *
 * Run at build time, never in a request. The kernel is not imported by any
 * public route and no WebAssembly reaches the browser: what ships is the
 * receipt, which is data.
 *
 * What a receipt establishes is narrow and worth stating. It shows that this
 * kernel, at this digest, produced this output from these inputs. It does not
 * show that the kernel is correct, that the operation models anything, or that
 * the page's claims are true. It exhibits a stated invariant on specific
 * values; exhibiting is not proving.
 */
import { writeFileSync } from 'node:fs'

import {
  createExecutedCalculationReceipt,
  verifyExecutedCalculationReceipt,
  type KernelArtifact,
} from '../packages/wasm-kernel/dist/execution.js'
import { kernelArtifact } from '../test/helpers/wasm-kernel.ts'

const artifact = kernelArtifact() as unknown as KernelArtifact
const MICRO = 1_000_000

const angle = (degrees: number) => String(Math.round(degrees * MICRO))
const degrees = (micro: string) => Number(micro) / MICRO

async function normalize(input: number) {
  const receipt = await createExecutedCalculationReceipt({
    schemaVersion: 'maha-wasm-execution-request/1.0',
    operation: 'normalize-angle-microdegrees',
    inputs: { angleMicrodegrees: angle(input) },
    units: { angleMicrodegrees: 'microdegree', normalizedAngleMicrodegrees: 'microdegree' },
  } as never, artifact)

  // Verified here rather than trusted: the same check an offline reader runs.
  const findings = await verifyExecutedCalculationReceipt(receipt, artifact)
  if (findings.length) throw new Error(`Receipt failed verification: ${findings.join(', ')}`)

  return { receipt, output: degrees(receipt.output.normalizedAngleMicrodegrees as string) }
}

/** Each case exhibits one invariant the page already states. */
const turnEquivalence = [await normalize(400), await normalize(760), await normalize(-320)]
const idempotence = await normalize((await normalize(400)).output)
const inInterval = [await normalize(359.999999), await normalize(360)]

// Each step shows the derivation rather than only its conclusion, so a reader
// can see the transformation and not just be told the outcome.
const steps = [
  `Turn equivalence: 400° → ${turnEquivalence[0].output}°, 760° → ${turnEquivalence[1].output}°, −320° → ${turnEquivalence[2].output}°. Three angles differing by whole turns give one result, which is the page's statement that θ and θ + 360°k are the same direction.`,
  `Idempotence: 400° → ${turnEquivalence[0].output}° → ${idempotence.output}°. Applying normalisation to its own output changes nothing.`,
  `The half-open interval: 359.999999° → ${inInterval[0].output}° stays inside, while 360° → ${inInterval[1].output}° rather than 360. That is what makes the upper end open rather than closed.`,
]

const receipts = [...turnEquivalence, idempotence, ...inInterval]
const payload = {
  schemaVersion: 'maha-kernel-calculations-public/1.0',
  generatedBy: 'scripts/generate-kernel-calculations.ts, at build time',
  kernelVersion: receipts[0].receipt.kernelVersion,
  kernelSha256: receipts[0].receipt.kernelSha256,
  compiler: receipts[0].receipt.compiler,
  arithmetic: receipts[0].receipt.arithmetic,
  establishes: 'That the kernel at this digest produced these outputs from these inputs, checked by re-executing it.',
  doesNotEstablish: [
    'That the kernel is correct. A receipt records what it computed, not whether the computation is right.',
    'That the operation models anything outside itself.',
    'That the page’s claims are true. These cases exhibit stated invariants on specific values, and exhibiting is not proving.',
  ],
  howToVerify: 'Rebuild the kernel with npm run build:wasm-kernel, which is deterministic, confirm its digest matches kernelSha256, then re-execute each operation on the recorded inputs.',
  calculations: [
    {
      route: '/knowledge/mathematics/angle-normalization',
      title: 'Angle normalisation, executed',
      method: 'normalize-angle-microdegrees, evaluated in fixed-point microdegrees on signed 64-bit integers',
      units: 'microdegree, shown here in degrees',
      assumptions: [
        'Angles are exact in microdegrees; a value that is not a whole number of microdegrees is outside this representation.',
        'The kernel avoids floating point entirely, so these results carry no rounding from binary fractions.',
      ],
      uncertainty: 'None from arithmetic: the operation is exact on integers and aborts on overflow rather than wrapping. Any uncertainty belongs to the input measurement, not to this step.',
      steps,
      cases: receipts.map((r) => ({
        input: `${degrees(r.receipt.inputs.angleMicrodegrees as string)}°`,
        output: `${r.output}°`,
        receiptSha256: r.receipt.receiptSha256,
      })),
    },
  ],
}

writeFileSync('content/legacy-uplift/kernel-calculations.json', `${JSON.stringify(payload, null, 2)}\n`)
console.log(`kernel ${payload.kernelSha256.slice(0, 22)}…`)
console.log(`${receipts.length} receipts, all verified by re-execution`)
for (const c of payload.calculations) console.log(`  ${c.route}: ${c.cases.length} cases`)

/**
 * WASM feasibility probe for the local selector.
 *
 * There is no fake `.wasm` in this repository, because a placeholder artifact
 * would imply a port that has not happened. This measures the two things that
 * actually decide whether a port is possible -- host toolchain, and language
 * features the selector depends on -- and prints a boundary a reader can act
 * on.
 *
 * Runs offline. Builds nothing.
 */
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = join(import.meta.dirname, '..')
const SELECTOR_SOURCES = [
  'lib/context-compiler.ts',
  'lib/local-selector/index.ts',
  'lib/local-selector/contract.ts',
]

const present = (tool: string, args: string[] = ['--version']): boolean => {
  try { execFileSync(tool, args, { stdio: 'ignore' }); return true } catch { return false }
}

const toolchains = {
  rust: present('rustc'),
  cargo: present('cargo'),
  wasmPack: present('wasm-pack'),
  emscripten: present('emcc'),
  tinygo: present('tinygo'),
  assemblyScript: present('npx', ['--no-install', 'asc', '--version']),
  javy: present('javy'),
}
const anyToolchain = Object.values(toolchains).some(Boolean)

// Features that need an ICU-class host. A WASM target without them changes
// which passages are selected for non-Latin text, which would be a silent
// behaviour change rather than a build failure.
const source = SELECTOR_SOURCES.map((path) => readFileSync(join(ROOT, path), 'utf8')).join('\n')
const features = {
  unicodePropertyEscapes: (source.match(/\\p\{Script=/g) ?? []).length,
  regexLookbehind: (source.match(/\(\?<[=!]/g) ?? []).length,
  nodeCryptoCallSites: (source.match(/createHash\(|randomUUID\(/g) ?? []).length,
  bufferCallSites: (source.match(/Buffer\.(from|byteLength)/g) ?? []).length,
}

// WebAssembly itself is available; that is necessary and nowhere near
// sufficient, and saying so is the point of this probe.
const webAssemblyAvailable = typeof WebAssembly === 'object' && typeof WebAssembly.instantiate === 'function'

const blockers: string[] = []
if (!anyToolchain) blockers.push('No WASM toolchain is installed (rust/cargo/wasm-pack, emscripten, tinygo, assemblyscript, javy). A production build cannot be produced or smoke-tested here.')
if (features.unicodePropertyEscapes > 0) blockers.push(`Selection uses ${features.unicodePropertyEscapes} Unicode property escapes. A WASM target must supply ICU-class regex or non-Latin scripts will tokenize differently and change which passages are selected.`)
if (features.regexLookbehind > 0) blockers.push(`Selection uses ${features.regexLookbehind} regex lookbehind assertion(s), which not every embedded regex engine supports.`)

const report = {
  status: blockers.length === 0 ? 'buildable' : 'not-buildable-here',
  probedAt: new Date().toISOString().slice(0, 10),
  webAssemblyAvailable,
  toolchains,
  languageFeatures: features,
  // Already addressed: these are behind injectable seams in the runtime, so a
  // port supplies its own and the selector is unchanged.
  hostSeams: {
    sha256Hex: 'injectable (LocalSelectorHost)',
    randomId: 'injectable (LocalSelectorHost)',
    utf8ByteLength: 'injectable (LocalSelectorHost)',
    verifiedByTest: 'test/local-selector.test.ts — runs the selector on a host with no node:crypto and no Buffer',
  },
  blockers,
  conclusion: blockers.length === 0
    ? 'A WASM build is worth attempting in this environment.'
    : 'A production WASM build is not practical here. The Node runtime and the host-seam interface ship instead; no .wasm artifact is published, and none is implied.',
  artifactPublished: false,
}

console.log(JSON.stringify(report, null, 2))

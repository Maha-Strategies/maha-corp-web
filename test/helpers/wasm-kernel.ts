import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { copyFileSync, existsSync, mkdtempSync, readFileSync, renameSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'

/**
 * Supplies the compiled kernel to tests without committing it.
 *
 * The kernel is a build output: .gitignore excludes it and a guard test asserts
 * no .wasm is tracked, because a committed binary cannot be shown to correspond
 * to the source it claims to come from. Tests therefore build it from the
 * tracked AssemblyScript source using the compiler pinned in package-lock.json
 * and the exact flags recorded in kernel-manifest.json.
 *
 * The build is deterministic, so this is a cache, not a source of variation:
 * repeated builds of the same source with the same compiler produce identical
 * bytes. Whether that identity holds across operating systems is asserted
 * separately by the manifest-digest test rather than assumed here.
 */

const ROOT = resolve(import.meta.dirname, '..', '..')
const WASM = resolve(ROOT, 'packages/wasm-kernel/dist/kernel.wasm')
const MANIFEST = resolve(ROOT, 'packages/wasm-kernel/conformance/kernel-manifest.json')

export interface KernelManifest {
  kernelSha256: string
  compiler: { name: string; version: string; flags: string[] }
  [key: string]: unknown
}

/**
 * Compiles to a private path and returns it.
 *
 * The test runner executes files in parallel, so several of them can want the
 * kernel at once. Each build goes to a process- and call-unique path, which
 * keeps concurrent builds from writing over each other's output.
 */
function compile(): string {
  const manifest = JSON.parse(readFileSync(MANIFEST, 'utf8')) as KernelManifest
  // The manifest records the flags as a single list; asc takes --runtime and its
  // value as separate arguments, so the recorded form is expanded here.
  const flags = manifest.compiler.flags.flatMap((flag) =>
    flag.startsWith('--runtime=') ? ['--runtime', flag.slice('--runtime='.length)] : [flag],
  )
  const scratch = mkdtempSync(join(tmpdir(), 'maha-wasm-kernel-'))
  const out = join(scratch, 'kernel.wasm')
  execFileSync(
    resolve(ROOT, 'node_modules/.bin/asc'),
    [resolve(ROOT, 'packages/wasm-kernel/assembly/index.ts'), '--outFile', out, ...flags],
    { cwd: ROOT, stdio: 'pipe' },
  )
  return out
}

/**
 * Publishes a freshly compiled kernel to the shared dist path.
 *
 * rename(2) within a filesystem is atomic, so a reader either sees the previous
 * complete file or the new complete file, never a partially written one. Two
 * builders racing here is harmless: the build is deterministic, so whichever
 * rename lands last publishes identical bytes.
 */
function build(): void {
  const staged = compile()
  try {
    renameSync(staged, WASM)
  } catch {
    // A cross-device rename cannot be atomic; copy instead, which is still
    // safe because both sources are byte-identical.
    copyFileSync(staged, WASM)
    rmSync(staged, { force: true })
  }
  rmSync(dirname(staged), { recursive: true, force: true })
}

/** Absolute path to the compiled kernel, building it first when absent. */
export function kernelPath(): string {
  if (!existsSync(WASM)) build()
  return WASM
}

/** The compiled kernel bytes paired with its committed manifest. */
export function kernelArtifact(): { bytes: Buffer; manifest: KernelManifest } {
  return {
    bytes: readFileSync(kernelPath()),
    manifest: JSON.parse(readFileSync(MANIFEST, 'utf8')) as KernelManifest,
  }
}

/**
 * Compiles a fresh copy in isolation and returns its digest.
 *
 * This deliberately does not touch the shared dist path: other test files may
 * be reading it concurrently, and a reproducibility check must not be able to
 * disturb what it is measuring.
 */
export function rebuiltKernelSha256(): string {
  const staged = compile()
  const digest = createHash('sha256').update(readFileSync(staged)).digest('hex')
  rmSync(dirname(staged), { recursive: true, force: true })
  return `sha256:${digest}`
}

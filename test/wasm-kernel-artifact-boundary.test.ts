import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import test from 'node:test'

import { kernelArtifact, kernelPath, rebuiltKernelSha256 } from './helpers/wasm-kernel.ts'

const ROOT = resolve(import.meta.dirname, '..')

/**
 * Regression cover for the defect that made PR #274 red: the compiled kernel was
 * committed, which .gitignore already excluded and a guard test already refused.
 *
 * A committed binary cannot be shown to correspond to the source it claims to
 * come from, so the kernel is built on demand instead. These tests hold that
 * boundary from both sides: nothing binary enters history, and what gets built
 * is the artifact the manifest describes.
 */

test('no compiled kernel is tracked in git', () => {
  const tracked = execFileSync('git', ['ls-files', '*.wasm', '*.wat'], { cwd: ROOT, encoding: 'utf8' }).trim()
  assert.equal(tracked, '', `compiled kernel artifacts must stay build outputs, found: ${tracked}`)
})

test('the compiled kernel is ignored rather than merely absent', () => {
  // `git check-ignore` proves the exclusion is declared policy, so a future
  // `git add` of the build output is refused rather than silently accepted.
  for (const path of ['packages/wasm-kernel/dist/kernel.wasm', 'packages/wasm-kernel/dist/kernel.wat']) {
    const status = execFileSync('git', ['check-ignore', '-q', path], { cwd: ROOT, encoding: 'utf8', stdio: 'pipe' })
    assert.equal(status, '', `${path} must be git-ignored`)
  }
})

test('a clean checkout can produce the kernel before anything reads it', () => {
  const path = kernelPath()
  const bytes = readFileSync(path)
  assert.ok(bytes.byteLength > 100, 'the built kernel must be a real module')
  // WebAssembly magic number: \0asm
  assert.deepEqual([...bytes.subarray(0, 4)], [0x00, 0x61, 0x73, 0x6d])
})

test('the built kernel matches the digest recorded in kernel-manifest.json', () => {
  // This is the cross-platform check. The manifest digest is committed, so if a
  // different operating system or compiler build produces different bytes, this
  // fails loudly here instead of silently invalidating every receipt that cites
  // the manifest.
  const { bytes, manifest } = kernelArtifact()
  const actual = `sha256:${createHash('sha256').update(bytes).digest('hex')}`
  assert.equal(actual, manifest.kernelSha256)
})

test('rebuilding the kernel reproduces the same bytes', () => {
  const first = rebuiltKernelSha256()
  const second = rebuiltKernelSha256()
  assert.equal(first, second, 'the kernel build must be deterministic')
  assert.equal(first, kernelArtifact().manifest.kernelSha256)
})

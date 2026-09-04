#!/usr/bin/env node
/**
 * Decide whether a Vercel deployment needs to build this commit.
 *
 * Vercel inverts the exit codes: exit 0 means SKIP the build, exit 1 means
 * BUILD it. That is the opposite of every other exit convention, so it is
 * written out here rather than left to be remembered.
 *
 * The rule is conservative. A build is skipped only when every changed file is
 * one the served application cannot read: tests, docs, workflows and the
 * generator scripts. Anything else builds, and anything undecidable builds,
 * because a missed build shows a stale site to real readers while a needless
 * build only costs money.
 *
 * Production is never skipped, whatever changed.
 */

// CommonJS is required because Vercel executes this file directly via ignoreCommand.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { execSync } = require('node:child_process')

const BUILD = 1
const SKIP = 0

/** Paths the running application cannot read. */
const INERT = [
  /^test\//,
  /^docs\//,
  /^\.github\//,
  /^scripts\//,
  /^[^/]+\.md$/,
  /^\.gitignore$/,
]

function decide() {
  const env = process.env.VERCEL_ENV
  if (env !== 'preview') {
    console.log(`VERCEL_ENV is ${env ?? 'unset'}; only preview builds are ever skipped.`)
    return BUILD
  }

  const before = process.env.VERCEL_GIT_PREVIOUS_SHA
  const current = process.env.VERCEL_GIT_COMMIT_SHA
  if (!before || !current) {
    console.log('No commit range available; building rather than guessing.')
    return BUILD
  }

  let changed
  try {
    changed = execSync(`git diff --name-only ${before} ${current}`, { encoding: 'utf8' })
      .split('\n').map((line) => line.trim()).filter(Boolean)
  } catch (error) {
    console.log(`Could not read the diff (${(error && error.message) || 'unknown'}); building.`)
    return BUILD
  }

  if (changed.length === 0) {
    console.log('Empty diff; building rather than assuming nothing changed.')
    return BUILD
  }

  const substantive = changed.filter((file) => !INERT.some((pattern) => pattern.test(file)))
  if (substantive.length > 0) {
    console.log(`Building: ${substantive.length} of ${changed.length} changed files can affect the site.`)
    for (const file of substantive.slice(0, 8)) console.log(`  ${file}`)
    return BUILD
  }

  console.log(`Skipping: all ${changed.length} changed files are tests, docs, workflows or generator scripts.`)
  return SKIP
}

process.exit(decide())

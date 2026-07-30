#!/usr/bin/env node
// Node 22+ executes the small TypeScript CLI without a bundler or dependency.
/* eslint-disable @typescript-eslint/no-require-imports -- Node's package-bin entrypoint is CommonJS. */
const { spawnSync } = require('node:child_process')
const { join } = require('node:path')

const result = spawnSync(process.execPath, ['--experimental-strip-types', join(__dirname, '..', 'scripts', 'cli.ts'), ...process.argv.slice(2)], { stdio: 'inherit', env: { ...process.env, NODE_NO_WARNINGS: '1' } })
process.exitCode = result.status ?? 1

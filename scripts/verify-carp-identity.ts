import { readFile } from 'node:fs/promises'

import { verifySignedAgentDescriptor } from '../lib/carp/identity.ts'

const source = process.argv[2]
if (!source) throw new Error('Usage: npm run verify:carp-identity -- <sad-url-or-json-file>')
const value = /^https?:\/\//.test(source)
  ? await fetch(source, { cache: 'no-store' }).then(async (response) => {
      if (!response.ok) throw new Error(`SAD returned HTTP ${response.status}.`)
      return response.json()
    })
  : JSON.parse(await readFile(source, 'utf8'))

if (!verifySignedAgentDescriptor(value)) throw new Error('CARP SAD signature verification failed.')
console.log(`PASS ${value.id}`)

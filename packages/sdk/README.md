# @mahastrategies/sdk

The zero-dependency TypeScript client for the Maha Strategies API. It runs in Node.js, Bun, Deno, browsers, and Edge runtimes.

## Install

```sh
npm install @mahastrategies/sdk
```

## Use

```ts
import { MahaClient } from '@mahastrategies/sdk'

const maha = new MahaClient({ apiKey: process.env.MAHA_API_KEY! })

const balance = await maha.getBalance()
const compressed = await maha.compress({
  clientRequestId: crypto.randomUUID().replaceAll('-', ''),
  task: 'Prepare a board brief while preserving named risks and decisions.',
  tokenBudget: 4_000,
  documents: [
    { id: 'meeting-notes', title: 'Meeting notes', text: longMeetingNotes },
    { id: 'risk-register', title: 'Risk register', text: riskRegister },
  ],
})

console.log(compressed.context)

const servers = await maha.mcp.listServers()
const refreshed = await maha.mcp.discoverTools(servers[0].serverId)

await maha.mcp.updateSettings({
  requestsPerMinute: 120,
  timeoutMs: 8_000,
  failureThreshold: 3,
  cooldownMs: 30_000,
})
```

Registration performs the first bounded `tools/list` discovery automatically. Server listings and refreshes return validated tool metadata, never upstream credential or encrypted credential material.

`compress()` sends the documented context-pack contract and returns the compiled
context, source coverage, warnings, and measured reduction. The universal SDK
does not write source text to disk. Applications that intentionally collect a
consented local benchmark corpus must implement that storage outside the SDK.

Python users who need LangChain or CrewAI tools should use the maintained
adapters in `clients/python`; those frameworks are Python-native and are not
dependencies of this zero-dependency TypeScript package.

See the complete endpoint and schema reference at https://www.mahastrategies.com/docs.

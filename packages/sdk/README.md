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

await maha.mcp.updateServerPolicy(refreshed.serverId, {
  allowedMethods: ['initialize', 'notifications/initialized', 'ping', 'tools/list', 'tools/call'],
  allowedToolNames: ['portfolio.risk'],
})

await maha.mcp.updateSettings({
  requestsPerMinute: 120,
  timeoutMs: 8_000,
  failureThreshold: 3,
  cooldownMs: 30_000,
})

const tensorResult = await maha.optimization.solveTensorNetwork({
  clientRequestId: crypto.randomUUID().replaceAll('-', ''),
  problem: {
    formulation: 'qubo',
    size: 3,
    terms: [{ i: 0, j: 0, value: -1 }, { i: 1, j: 1, value: -1 }],
  },
  solver: { bondDimension: 256, exactThreshold: 18 },
})

const registration = await maha.optimization.solveGeometricRegistration({
  clientRequestId: crypto.randomUUID().replaceAll('-', ''),
  problem: {
    sourcePoints: [[0, 0, 0], [1, 0, 0], [0, 1, 0]],
    targetPoints: [[2, 3, 4], [3, 3, 4], [2, 4, 4]],
  },
})
```

The tensor-network method uses a declared, bounded transfer-frontier bond
dimension. Above the exact threshold it is a heuristic and does not claim a
certified bound or global optimum. Geometric registration fits a weighted
least-squares rigid transform to already paired 3D points; it does not search
for correspondences or perform non-rigid fitting.

Registration performs the first bounded `tools/list` discovery automatically and starts with a read-only method policy. Server listings and refreshes return validated tool metadata, never upstream credential or encrypted credential material. Approve callable tools explicitly with `updateServerPolicy()` before dispatching `tools/call`.

`compress()` sends the documented context-pack contract and returns the compiled
context, source coverage, warnings, and measured reduction. The universal SDK
does not write source text to disk. Applications that intentionally collect a
consented local benchmark corpus must implement that storage outside the SDK.

Python users who need LangChain or CrewAI tools should use the maintained
adapters in `clients/python`; those frameworks are Python-native and are not
dependencies of this zero-dependency TypeScript package.

See the complete endpoint and schema reference at https://www.mahastrategies.com/docs.

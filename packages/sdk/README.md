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

See the complete endpoint and schema reference at https://www.mahastrategies.com/docs.

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
```

See the complete endpoint and schema reference at https://www.mahastrategies.com/docs.

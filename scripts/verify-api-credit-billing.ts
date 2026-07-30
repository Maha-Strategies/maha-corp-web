import nextEnv from '@next/env'

import { getBillingReadiness } from '../lib/billing-readiness.ts'

nextEnv.loadEnvConfig(process.cwd())
const report = await getBillingReadiness()
process.stdout.write(`${JSON.stringify(report, null, 2)}\n`)
if (report.state !== 'ready') process.exitCode = 1

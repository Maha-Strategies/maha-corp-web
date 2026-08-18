import { orchestrationDeploymentConfig } from '../lib/workflows/deployment.ts'

const config = orchestrationDeploymentConfig()
const report = {
  ready: config.ready,
  mode: config.mode,
  storageProvider: config.storageProvider,
  retentionDays: config.retentionDays,
  credentialCount: config.credentials.length,
  checks: { authentication: config.authReady, durableStorage: config.storageReady },
  errors: config.errors,
  secretsEmitted: false,
}
process.stdout.write(`${JSON.stringify(report, null, 2)}\n`)
if (!config.ready) process.exitCode = 1

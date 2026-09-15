import { readFileSync } from 'node:fs'
import { generateRoboticsPackage, roboticsSummary, verifyRoboticsPackage } from '../lib/robotics-evidence.ts'
const [command = 'summary', file] = process.argv.slice(2)
if (!['summary', 'package', 'verify'].includes(command)) throw new Error('Use summary, package, or verify <local-json-file>')
if (command === 'verify') {
  if (!file) throw new Error('Local package path required')
  const bytes = readFileSync(file)
  if (bytes.length > 250_000) throw new Error('Package exceeds 250 KB limit')
  const result = verifyRoboticsPackage(JSON.parse(bytes.toString('utf8')))
  console.log(JSON.stringify(result, null, 2))
  if (result.verdict === 'refused') process.exitCode = 1
} else console.log(JSON.stringify(command === 'package' ? generateRoboticsPackage() : roboticsSummary(), null, 2))

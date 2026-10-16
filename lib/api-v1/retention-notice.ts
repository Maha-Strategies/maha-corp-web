import { RECEIPT_RETENTION_SECONDS, recoverySeconds, type Endpoint } from './types.ts'

export function retentionDuration(seconds: number) {
  if (!Number.isSafeInteger(seconds) || seconds <= 0) throw new Error('invalid_retention_duration')
  if (seconds === 86400) return '24 hours'
  if (seconds % 86400 === 0) return `${seconds / 86400} days`
  if (seconds % 3600 === 0) return `${seconds / 3600} ${seconds === 3600 ? 'hour' : 'hours'}`
  return `${seconds} ${seconds === 1 ? 'second' : 'seconds'}`
}

/** Derive public wording from the same contracts that enforce recovery expiry. */
export function modularRetentionNotice(endpoints: readonly Endpoint[]) {
  const counts = new Map<number, number>()
  for (const endpoint of endpoints) {
    const seconds = recoverySeconds(endpoint)
    counts.set(seconds, (counts.get(seconds) ?? 0) + 1)
  }
  const groups = [...counts].sort(([a], [b]) => a - b)
    .map(([seconds, count]) => `${count} ${count === 1 ? 'service' : 'services'}: ${retentionDuration(seconds)}`)
  return `Result content (${groups.join('; ')}). Minimal purchase metadata: ${retentionDuration(RECEIPT_RETENTION_SECONDS)} from creation; recovery does not extend deadlines.`
}

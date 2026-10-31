import { readFile, writeFile } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'
const cell = value => {
  let out = ''
  for (const ch of String(value ?? 'unknown').replace(/[\r\n|`<>]/g, ' ')) {
    if (Buffer.byteLength(out + ch) > 80) break
    out += ch
  }
  return out
}
export function renderInactivityIssue(report, runUrl) {
  const rows = Array.isArray(report?.reports) ? report.reports : []
  const counts = rows.reduce((out, row) => { const level = ['urgent','unknown','warn','ok'].includes(row.level) ? row.level : 'unknown'; out[level] = (out[level] ?? 0) + 1; return out }, {})
  const priority = { urgent: 0, unknown: 1, warn: 2, ok: 3 }
  const selected = [...rows].filter(row => row.level !== 'ok').sort((a,b) =>
    (priority[a.level] ?? 1) - (priority[b.level] ?? 1) || (a.daysRemaining ?? Infinity) - (b.daysRemaining ?? Infinity)).slice(0, 20)
  const body = [ '# Bazaar inactivity observation', '',
    `Complete catalogue lookup: ${report?.catalogueComplete === true ? 'yes' : 'NO — absence is not established'}.`,
    `Checked ${rows.length} expected listings. Counts: ${JSON.stringify(counts)}.`,
    'Missing listings, inactivity and endpoint payability are separate observations.', '',
    '| Offer | Level | Reason | Last recorded call | Days remaining |', '| --- | --- | --- | --- | --- |',
    ...selected.map(row => `| ${[row.offerId,row.level,row.reason,row.lastCalledAt,row.daysRemaining].map(cell).join(' | ')} |`), '',
    'Showing at most 20 attention items; the full JSON report is in the run artifacts.',
    `Run: ${/^https:\/\/github\.com\/[A-Za-z0-9_.\/-]+$/.test(runUrl ?? '') ? runUrl : 'see Actions run'}`, '',
    '**No automatic payments or refreshes.** Any purchase requires explicit approval.',
  ].join('\n') + '\n'
  if (Buffer.byteLength(body) > 12000) throw Error('inactivity_issue_budget_exceeded')
  return body
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  let report = null
  try { report = JSON.parse(await readFile(process.argv[2], 'utf8')) } catch { /* Explicit unknown report. */ }
  await writeFile(process.argv[3], renderInactivityIssue(report, process.env.MONITOR_RUN_URL), {mode:0o600})
}

// Isolated React SSR only: no Next/Vercel build, server or deployment.
/* eslint-disable @typescript-eslint/no-require-imports -- Local CommonJS transpilation harness. */
const fs = require('node:fs')
const path = require('node:path')
const Module = require('node:module')
const assert = require('node:assert/strict')
const ts = require('typescript')
const React = require('react')
const { renderToStaticMarkup } = require('react-dom/server')
const root = path.resolve(__dirname, '..')
const file = path.join(root, 'app/knowledge/corporate/CorporateLayersView.tsx')
const mod = new Module(file, module)
mod.filename = file
mod.paths = Module._nodeModulePaths(path.dirname(file))
const originalRequire = mod.require.bind(mod)
mod.require = name => {
  if (name === './CorporateTechnicalView') {
    const childFile = path.join(root, 'app/knowledge/corporate/CorporateTechnicalView.tsx')
    const child = new Module(childFile, module); child.filename = childFile; child.paths = mod.paths
    child._compile(ts.transpileModule(fs.readFileSync(childFile, 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText, childFile)
    return child.exports
  }
  return originalRequire(name)
}
mod._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText, file)
const { buildCorporateReport } = require('../lib/corporate-report.ts')
const { CORPORATE_RULES, corporateRuleDigest, corporateEventDigest } = require('../lib/corporate-synthesis.ts')
const { digestOf } = require('../lib/celestial-hypotheses/canonical.ts')
const input = { organizationName: 'Synthetic render test', eventType: 'certificate-issued', date: '2025-12-17', time: '07:43', timeZone: 'America/Denver', timeConfidence: 'recorded-instant', uncertaintyMinutes: 0, latitudeDegrees: 41.14, longitudeDegrees: -104.8197, locationBasis: 'authority-location', jurisdictionCountryCode: 'US', registrationAuthority: 'Synthetic registry', evidenceKind: 'government-record', evidenceReference: 'Synthetic only', evidenceAttachment: { filename: 'test.txt', byteLength: 1, mediaType: 'text/plain', sha256: `sha256:${'a'.repeat(64)}` } }
const seal = body => ({ ...body, recordDigest: digestOf(body) })
const trust = { eventReviews: [seal({ reviewId: 'synthetic', eventDigest: corporateEventDigest(input), documentDigest: input.evidenceAttachment.sha256, decision: 'inspected-record', reviewedAt: '2026-09-19T00:00:00Z' })], ruleReviews: CORPORATE_RULES.map(rule => seal({ reviewId: rule.id, ruleId: rule.id, targetDigest: corporateRuleDigest(rule), layer: rule.layer, scope: rule.layer === 'traditional' ? 'source-and-rule' : 'maha-analogy-approval', decision: 'accepted', reviewedAt: '2026-09-19T00:00:00Z' })) }
for (const report of [buildCorporateReport(input), buildCorporateReport(input, trust), buildCorporateReport({ ...input, timeConfidence: 'recorded-minute', uncertaintyMinutes: 1 })]) {
  const html = renderToStaticMarkup(React.createElement(mod.exports.default, { layers: report.layers }))
  for (const heading of ['Calculated facts', 'Reviewed traditional interpretations', 'Approved Maha reflective analogies', 'Versions, boundaries and report receipt']) assert.ok(html.includes(heading))
  assert.ok(html.includes('<details') && html.includes('<summary'))
  assert.ok(html.includes(report.layers.reportDigest))
  for (const m of report.interpretation.modules) assert.ok(html.includes(m.ruleDigest))
  assert.doesNotMatch(html, /2025-001843603|Maha Strategies LLC|STRIPE_SECRET|API_KEY/)
}
console.log('PASS: three synthetic React renders (unreviewed, test-approved, uncertain); layer headings, disclosure controls, receipts and private-demo exclusion. Not browser or production-build verification.')

/* eslint-disable @typescript-eslint/no-require-imports -- Offline SSR test; no app build or credentials. */
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const Module = require('node:module')
const test = require('node:test')
const ts = require('typescript')
const React = require('react')
const { renderToStaticMarkup } = require('react-dom/server')
const root = path.resolve(__dirname, '..')
const cache = new Map()

function load(file) {
  if (cache.has(file)) return cache.get(file).exports
  const m = new Module(file, module)
  m.filename = file
  m.paths = Module._nodeModulePaths(path.dirname(file))
  cache.set(file, m)
  const normalRequire = m.require.bind(m)
  m.require = name => {
    if (name === 'next/link') return { __esModule: true, default: props => React.createElement('a', props) }
    if (name.startsWith('@/') || name.startsWith('.')) {
      const base = name.startsWith('@/') ? path.join(root, name.slice(2)) : path.resolve(path.dirname(file), name)
      const found = [base, `${base}.ts`, `${base}.tsx`].find(p => fs.existsSync(p) && fs.statSync(p).isFile())
      if (found) return load(found)
    }
    return normalRequire(name)
  }
  m._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText, file)
  return m.exports
}

const data = load(path.join(root, 'lib/company-profile.ts'))
const escape = text => renderToStaticMarkup(React.createElement('span', null, text)).slice(6, -7)

test('server-rendered portfolio visibly supports every structured claim and anchor', () => {
  const page = load(path.join(root, 'app/about/technology/page.tsx'))
  const html = renderToStaticMarkup(React.createElement(page.default))
  const scripts = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)]
  assert.equal(scripts.length, 1)
  assert.deepEqual(JSON.parse(scripts[0][1]), data.buildCompanyPortfolioJsonLd())
  const visible = html.replace(/<script[\s\S]*?<\/script>/g, '')
  for (const activity of data.COMPANY_ACTIVITIES) {
    assert.ok(visible.includes(`id="${activity.id}"`))
    for (const text of [activity.name, activity.summary, activity.boundary]) assert.ok(visible.includes(escape(text)), text)
  }
  for (const field of data.COMPANY_KNOWLEDGE_FIELDS) {
    assert.ok(visible.includes(`id="field-${field.id}"`))
    for (const text of [field.name, field.currentWork, field.possibleDirection]) assert.ok(visible.includes(escape(text)), text)
  }
  for (const boundary of data.COMPANY_BOUNDARIES) assert.ok(visible.includes(escape(boundary)))
  assert.equal(page.metadata.alternates.canonical, data.COMPANY_PORTFOLIO_PATH)
  assert.ok(visible.includes('href="/company.json"'))
})

test('about page has the canonical description and a visible discovery link', () => {
  const page = load(path.join(root, 'app/about/page.tsx'))
  const entity = load(path.join(root, 'lib/entity.ts'))
  const html = renderToStaticMarkup(React.createElement(page.default))
  const visible = html.replace(/<script[\s\S]*?<\/script>/g, '')
  assert.ok(visible.includes(escape(entity.MAHA_DESCRIPTOR)))
  assert.ok(visible.includes(`href="${data.COMPANY_PORTFOLIO_PATH}"`))
  assert.doesNotMatch(visible, /technology-architecture organization/)
})

/* eslint-disable @typescript-eslint/no-require-imports -- Isolated SSR harness, no build. */
const fs = require('node:fs')
const path = require('node:path')
const Module = require('node:module')
const ts = require('typescript')
const React = require('react')
const { renderToStaticMarkup } = require('react-dom/server')
const assert = require('node:assert/strict')
const root = path.resolve(__dirname, '..')
const cache = new Map()
function load(file) {
  if (file.endsWith('.css')) return { __esModule: true, default: new Proxy({}, { get: (_, key) => String(key) }) }
  if (cache.has(file)) return cache.get(file).exports
  const m = new Module(file, module); m.filename = file; m.paths = Module._nodeModulePaths(path.dirname(file)); cache.set(file, m)
  const normal = m.require.bind(m)
  m.require = name => {
    if (name === 'next/link') return { __esModule: true, default: props => { const clean = { ...props }; delete clean.prefetch; return React.createElement('a', clean) } }
    if (name === 'next/navigation') return { notFound: () => { throw new Error('NOT_FOUND') } }
    if (name.startsWith('@/') || name.startsWith('.')) {
      const base = name.startsWith('@/') ? path.join(root, name.slice(2)) : path.resolve(path.dirname(file), name)
      const found = [base, base + '.ts', base + '.tsx'].find(p => fs.existsSync(p) && fs.statSync(p).isFile())
      if (found) return load(found)
    }
    return normal(name)
  }
  m._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText, file)
  return m.exports
}
async function main() {
  const data = load(path.join(root, 'lib/computational-architecture.ts'))
  const hub = load(path.join(root, 'app/knowledge/computational-architecture/page.tsx'))
  const page = load(path.join(root, 'app/knowledge/computational-architecture/[slug]/page.tsx'))
  const hubHtml = renderToStaticMarkup(React.createElement(hub.default))
  assert.equal(page.generateStaticParams().length, 12)
  for (const a of data.architectureArticles) {
    assert.ok(hubHtml.includes(`${data.ARCHITECTURE_PATH}/${a.slug}`))
    const props = { params: Promise.resolve({ slug: a.slug }) }
    const html = renderToStaticMarkup(await page.default(props))
    for (const text of [a.title, a.answer, a.boundary]) assert.ok(html.includes(renderToStaticMarkup(React.createElement('span', null, text)).slice(6, -7)))
    for (const id of a.sources) assert.ok(html.includes(data.architectureSources[id].url))
    assert.match(html, /Sources and review/)
    assert.doesNotMatch(html, /551,?000|380,?640|Caldera|docs\/caldera/)
    assert.equal((await page.generateMetadata(props)).alternates.canonical, `https://www.mahastrategies.com${data.ARCHITECTURE_PATH}/${a.slug}`)
    if (a.slug === 'program-area-checker') assert.match(html, /Check program/)
  }
  await assert.rejects(page.default({ params: Promise.resolve({ slug: 'unpublished' }) }), /NOT_FOUND/)
  await assert.rejects(page.generateMetadata({ params: Promise.resolve({ slug: 'unpublished' }) }), /NOT_FOUND/)
  console.log('PASS: hub and 12 article SSR renders, source links, canonicals, checker controls, private-data exclusions and unknown-slug refusal. Not browser or production verification.')
}
module.exports = { load }
if (require.main === module) main().catch(e => { console.error(e); process.exitCode = 1 })

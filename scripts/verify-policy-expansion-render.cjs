// Isolated TS transpilation + React SSR. Not a Next production build.
/* eslint-disable @typescript-eslint/no-require-imports -- CommonJS Module._compile harness deliberately exercises transpiled server components. */
const fs = require('node:fs')
const path = require('node:path')
const Module = require('node:module')
const assert = require('node:assert/strict')
const ts = require('typescript')
const React = require('react')
const { renderToStaticMarkup } = require('react-dom/server')
const { execFileSync } = require('node:child_process')
const root = path.resolve(__dirname, '..')
const cache = new Map()
function load(file, sourceOverride) {
  const key = sourceOverride ? `${file}:baseline` : file
  if (cache.has(key)) return cache.get(key).exports
  const mod = new Module(file, module)
  mod.filename = file; mod.paths = Module._nodeModulePaths(path.dirname(file)); cache.set(key, mod)
  const original = mod.require.bind(mod)
  mod.require = name => {
    if (name.endsWith('.module.css')) return new Proxy({}, { get: (_, key) => key === '__esModule' ? false : key === 'default' ? new Proxy({}, { get: (_, k) => String(k) }) : String(key) })
    if (name === 'next/navigation') return { notFound() { throw new Error('not-found') } }
    if (name === 'next/link') return { __esModule: true, default: props => React.createElement('a', props) }
    if (name.startsWith('@/') || name.startsWith('.')) {
      const base = name.startsWith('@/') ? path.join(root, name.slice(2)) : path.resolve(path.dirname(file), name)
      const resolved = [base, base + '.ts', base + '.tsx'].find(p => fs.existsSync(p) && fs.statSync(p).isFile())
      if (resolved) return load(resolved)
    }
    return original(name)
  }
  mod._compile(ts.transpileModule(sourceOverride || fs.readFileSync(file, 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText, file)
  return mod.exports
}
async function main() {
  const previous = process.env.NODE_ENV
  try {
    process.env.NODE_ENV = 'development'
    const reader = load(path.join(root, 'components/policy/PolicyExpansionReader.tsx'))
    const hub = load(path.join(root, 'app/policy/page.tsx'))
    const answer = load(path.join(root, 'app/policy/questions/[slug]/page.tsx'))
    const methods = load(path.join(root, 'app/policy/methodology/[slug]/page.tsx'))
    const entrance = renderToStaticMarkup(React.createElement(reader.PolicyExpansionEntrance))
    assert.equal(hub.metadata.robots.index, false)
    const outputs = [entrance]
    const allowed = new Set(['/policy', '/books/the-maha-principle'])
    for (const route of ['nutrient-density-standard', 'chemical-reciprocity-act', 'algorithmic-transparency-act', 'soil-restoration-corps', 'community-sovereignty-compact']) allowed.add('/policy/' + route)
    for (const [page, prefix, count] of [[answer, '/policy/questions/', 12], [methods, '/policy/methodology/', 4]]) {
      assert.equal(page.generateStaticParams().length, count)
      for (const p of page.generateStaticParams()) {
        const url = prefix + p.slug; allowed.add(url)
        assert.ok(entrance.includes(`href="${url}"`), `not reachable: ${url}`)
        const props = { params: Promise.resolve(p) }; const metadata = await page.generateMetadata(props)
        assert.equal(metadata.robots.index, false); assert.equal(metadata.alternates.canonical, 'https://www.mahastrategies.com' + url)
        outputs.push(renderToStaticMarkup(await page.default(props)))
      }
      await assert.rejects(page.default({ params: Promise.resolve({ slug: 'toString' }) }), /not-found/)
    }
    for (const html of outputs) {
      assert.equal((html.match(/<h1\b/g) || []).length, 1)
      assert.match(html, /No personal position approval|no personal position approval|personally approved/)
      const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]); assert.equal(ids.length, new Set(ids).size, 'duplicate DOM IDs')
      for (const match of html.matchAll(/href="([^" ]+)"/g)) {
        if (match[1].startsWith('#')) assert.ok(ids.includes(match[1].slice(1)), `broken anchor ${match[1]}`)
        else if (match[1].startsWith('/')) assert.ok(allowed.has(match[1]), `unresolved internal link ${match[1]}`)
      }
      assert.doesNotMatch(html, /STRIPE_SECRET|API_KEY|inspectedPassageFingerprint|operatorEmail/)
    }
    for (const html of outputs.slice(1, 13)) for (const heading of ['Short answer', 'What the evidence establishes', 'Costs and who is affected', 'Strongest objection', 'Who could act', 'Sources and review']) assert.ok(html.includes(heading))
    process.env.NODE_ENV = 'production'
    for (const page of [answer, methods]) {
      assert.deepEqual(page.generateStaticParams(), [])
      await assert.rejects(page.default({ params: Promise.resolve({ slug: 'housing-affordability' }) }), /not-found/)
      await assert.rejects(page.generateMetadata({ params: Promise.resolve({ slug: 'sources-and-evidence' }) }), /not-found/)
    }
    const productionHub = renderToStaticMarkup(hub.default())
    assert.doesNotMatch(productionHub, /\/policy\/questions\//)
    assert.match(productionHub, /nutrient-density-standard/)
    const baseline = load(path.join(root, 'app/policy/page.tsx'), execFileSync('git', ['show', 'HEAD:app/policy/page.tsx'], { cwd: root, encoding: 'utf8' }))
    assert.equal(productionHub, renderToStaticMarkup(baseline.default()), 'Existing production hub rendering must not change')
    cache.delete(path.join(root, 'app/policy/page.tsx'))
    assert.deepEqual(load(path.join(root, 'app/policy/page.tsx')).metadata, baseline.metadata, 'Existing production metadata must not change')
    console.log('PASS: 17 local React renders; 16 drafts reachable; canonical/noindex, source anchors, headings and internal links; production refusals and unchanged production hub path.')
    console.log('Scope: isolated React rendering with Next Link/notFound adapters, not a Next production build, browser check or deployment.')
  } finally { if (previous === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = previous }
}
main().catch(error => { console.error(error); process.exitCode = 1 })

// Isolated React server rendering of the robotics pages; not a Next or Vercel build.
// CommonJS on purpose: it compiles the pages with Module#_compile, which has no ESM equivalent.
/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require('node:fs')
const path = require('node:path')
const Module = require('node:module')
const assert = require('node:assert/strict')
const ts = require('typescript')
const { renderToStaticMarkup } = require('react-dom/server')
const root = path.resolve(__dirname, '..')
const cache = new Map()
function load(file) {
  if (cache.has(file)) return cache.get(file).exports
  const mod = new Module(file, module)
  mod.filename = file; mod.paths = Module._nodeModulePaths(path.dirname(file))
  cache.set(file, mod)
  const original = mod.require.bind(mod)
  mod.require = name => name.startsWith('@/lib/robotics-') ? load(path.join(root, name.slice(2) + '.ts')) : name.startsWith('./robotics-') && name.endsWith('.ts') ? load(path.resolve(path.dirname(file), name)) : original(name)
  const output = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText
  mod._compile(output, file)
  return mod.exports
}
async function main() {
  const page = load(path.join(root, 'app/knowledge/robotics/[slug]/page.tsx'))
  const hub = load(path.join(root, 'app/knowledge/robotics/page.tsx'))
  const params = page.generateStaticParams()
  assert.equal(params.length, 40)
  const allowed = new Set(['/knowledge/robotics', ...params.map(p => '/knowledge/robotics/' + p.slug)])
  const outputs = [renderToStaticMarkup(hub.default())]
  for (const p of params) assert.ok(outputs[0].includes(`href="/knowledge/robotics/${p.slug}"`), `missing hub link: ${p.slug}`)
  assert.match(fs.readFileSync(path.join(root, 'app/knowledge/page.tsx'), 'utf8'), /href="\/knowledge\/robotics"/)
  for (const p of params) {
    const props = { params: Promise.resolve(p) }
    const meta = await page.generateMetadata(props)
    assert.equal(meta.robots, undefined, `${p.slug}: published pages inherit indexing`)
    assert.match(meta.title, / \| Maha Strategies$/)
    assert.equal(meta.alternates.canonical, `https://www.mahastrategies.com/knowledge/robotics/${p.slug}`)
    const html = renderToStaticMarkup(await page.default(props))
    assert.match(html, /<h1/); assert.match(html, /not expert review/); assert.doesNotMatch(html, /Local draft|research draft/)
    assert.equal((html.match(/<h1\b/g) || []).length, 1)
    if (!['evidence-package', 'pick-place-example'].includes(p.slug)) {
      for (const heading of ['Evidence and interpretation', 'Proposed evidence workflow', 'Worked illustration', 'Limits', 'Sources and review', 'Continue reading']) assert.ok(html.includes(heading), `${p.slug}: missing ${heading}`)
    }
    outputs.push(html)
  }
  for (const html of outputs) {
    for (const match of html.matchAll(/href="(\/knowledge\/robotics[^"#]*)"/g)) assert.ok(allowed.has(match[1]), match[1])
    assert.doesNotMatch(html, /API_KEY|SECRET_KEY|birthTime|operatorEmail/)
  }
  const sitemap = fs.readFileSync(path.join(root, 'app/sitemap.ts'), 'utf8')
  assert.match(sitemap, /\$\{baseUrl\}\$\{ROBOTICS_PATH\}`, lastModified: new Date\(ROBOTICS_RELEASE_DATE\)/, 'hub listed in sitemap')
  assert.match(sitemap, /roboticsCandidateMap\(\)\.map\(/, 'topics listed in sitemap')
  for (const route of ['knowledge', 'knowledge/mathematics', 'governed-workflow']) assert.ok(fs.existsSync(path.join(root, 'app', route, 'page.tsx')), `missing adjacent route ${route}`)
  await assert.rejects(page.default({ params: Promise.resolve({ slug: 'not-in-the-map' }) }))
  await assert.rejects(page.default({ params: Promise.resolve({ slug: 'toString' }) }))
  console.log('PASS: 41 React page renders, 40 topic parameters, complete hub reachability, valid internal links, indexable metadata with canonical URLs, sitemap listing, unknown and inherited-key routes refused.')
  console.log('Not tested: Next route integration, production bundles, CSS layout, mobile browser rendering or deployment.')
}
main().catch(error => { console.error(error); process.exitCode = 1 })

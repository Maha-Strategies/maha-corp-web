/* eslint-disable @typescript-eslint/no-require-imports -- Local rendering verification, no production build. */
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const React = require('react')
const { renderToStaticMarkup } = require('react-dom/server')
const { load } = require('./verify-architecture-render.cjs')
const root = path.resolve(__dirname, '..')
async function main() {
  const targets = ['computational-architecture', 'robotics', 'nanotechnology', 'physical-ai']
  const htmlByTarget = {}
  for (const target of targets) {
    const page = load(path.join(root, `app/knowledge/${target}/page.tsx`))
    const html = renderToStaticMarkup(React.createElement(page.default))
    htmlByTarget[target] = html
    assert.equal((html.match(/<h1/g) || []).length, 1)
    assert.ok(html.includes('Topic groups') && html.includes('Connected knowledge'))
    const inventories = {
      robotics: () => load(path.join(root, 'lib/robotics-knowledge.ts')).roboticsCandidateMap(),
      'computational-architecture': () => load(path.join(root, 'lib/computational-architecture.ts')).architectureArticles,
      nanotechnology: () => load(path.join(root, 'lib/nanotechnology-knowledge.ts')).NANO_ARTICLES,
      'physical-ai': () => load(path.join(root, 'lib/physical-ai-knowledge.ts')).PHYSICAL_AI_ARTICLES,
    }
    const expected = inventories[target]()
    for (const item of expected) assert.ok(html.includes(`/knowledge/${target}/${item.slug}`), item.slug)
    const anchors = [...html.matchAll(/href="#([^"]+)"/g)].map(m => m[1])
    for (const id of anchors) assert.ok(html.includes(`id="${id}"`))
    console.log(`PASS ${target}: ${expected.length} preserved article destinations and ${anchors.length} topic anchors`)
  }
  if (!process.env.PLAYWRIGHT_MODULE) return
  const { chromium } = require(process.env.PLAYWRIGHT_MODULE)
  const browser = await chromium.launch({ channel: 'chrome', headless: true })
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'maha-hubs-'))
  try {
    const page = await browser.newPage()
    await page.route('**/*', r => r.abort())
    const css = fs.readFileSync(path.join(root, 'app/knowledge/knowledge-cyber-light.module.css'), 'utf8').replace(/:global\(([^)]+)\)/g, '$1') + '\n' + fs.readFileSync(path.join(root, 'components/knowledge/KnowledgeHub.module.css'), 'utf8') + '\n.overflow-x-auto{overflow-x:auto}'
    for (const target of targets) for (const width of [375, 1440]) {
      await page.setViewportSize({ width, height: 1000 })
      await page.setContent(`<html lang="en"><head><title>Knowledge hub test</title><style>*{box-sizing:border-box}body{margin:0;font-family:Arial,sans-serif}h1,h2,h3,p{margin:0}a{color:inherit}${css}</style></head><body><div class="root">${htmlByTarget[target]}</div></body></html>`)
      const result = await page.evaluate(() => ({ width: innerWidth, scroll: document.documentElement.scrollWidth, columns: getComputedStyle(document.querySelector('.grid')).gridTemplateColumns.split(' ').length, cards: document.querySelectorAll('.card').length }))
      assert.ok(result.scroll <= result.width, JSON.stringify(result))
      assert.equal(result.columns, width === 375 ? 1 : 3)
      await page.keyboard.press('Tab')
      assert.equal(await page.evaluate(() => document.activeElement.tagName), 'A')
      await page.screenshot({ path: path.join(out, `${target}-${width}.png`), fullPage: true })
      console.log(`PASS ${target} ${width}px: no overflow, ${result.columns} columns, keyboard link focus`)
    }
    console.log(`Screenshots: ${out}. Static actual-component/CSS harness; not full Next served-output verification.`)
  } finally { await browser.close() }
}
main().catch(e => { console.error(e); process.exitCode = 1 })

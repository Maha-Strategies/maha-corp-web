import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'

const ROOT = join(import.meta.dirname, '..')

test('the public WSO2 offer states its commercial scope and compatibility boundaries', () => {
  const page = readFileSync(join(ROOT, 'app/integrations/wso2/page.tsx'), 'utf8')

  assert.match(page, /Fixed-scope evaluation · \$5,000/)
  assert.match(page, /Founding design-partner evaluations may be scoped at \$2,500/)
  assert.match(page, /not claiming WSO2 partnership, certification, approval, or customer validation/)
  assert.match(page, /public policy bundle is evaluation-only/)
  assert.match(page, /corpus is synthetic/)
  assert.match(page, /No fixed compression, savings, retention, or latency result is promised/)
})

test('the public WSO2 result is tied to its pinned comparator and reproduction evidence', () => {
  const page = readFileSync(join(ROOT, 'app/integrations/wso2/page.tsx'), 'utf8')

  assert.match(page, /WSO2 AI Gateway 1\.1\.0/)
  assert.match(page, /Prompt Compressor 0\.9\.0/)
  assert.match(page, /0\.55 retained ratio/)
  assert.match(page, /98\.84%/)
  assert.match(page, /98\.20%/)
  assert.match(page, /npm run reproduce:wso2-evaluation/)
  assert.match(page, /wso2-reproduction\.json/)
  assert.match(page, /wso2-sanitized-three-path-trace\.json/)
})

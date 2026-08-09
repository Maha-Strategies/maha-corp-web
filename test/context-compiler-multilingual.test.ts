import assert from 'node:assert/strict'
import test from 'node:test'

import { compileContextPack, estimateTokens, parseContextPackRequest } from '../lib/context-compiler.ts'

const cases = [
  {
    name: 'Cyrillic',
    task: 'Найдите условие отката: ошибки два процента пять минут.',
    needle: 'Откат начинается, если частота ошибок превышает два процента в течение пяти минут.',
  },
  {
    name: 'Arabic',
    task: 'حدد شرط التراجع عن الإصدار عند فشل النظام.',
    needle: 'يبدأ التراجع إذا تجاوز معدل الأخطاء اثنين بالمئة لمدة خمس دقائق.',
  },
  {
    name: 'Japanese',
    task: 'リリース後のロールバック条件を特定してください。',
    needle: 'エラー率が五分間に二パーセントを超えた場合はロールバックします。',
  },
  {
    name: 'Simplified Chinese',
    task: '找出发布后的回滚触发条件。',
    needle: '如果错误率连续五分钟超过百分之二，就触发回滚。',
  },
] as const

for (const multilingualCase of cases) {
  test(`BM25 retains the relevant ${multilingualCase.name} passage`, () => {
    const filler = Array.from({ length: 20 }, (_, index) => `背景段落 ${index + 1}。常规维护窗口与部署说明，不包含目标条件。`)
    filler.splice(14, 0, multilingualCase.needle)
    const request = parseContextPackRequest({
      clientRequestId: `multilingual_${multilingualCase.name.toLowerCase().replaceAll(' ', '_')}`,
      task: multilingualCase.task,
      tokenBudget: 96,
      documents: [{ id: 'runbook', text: filler.join('\n\n') }],
      provenance: 'compact',
      scoring: 'bm25',
      budgetMode: 'estimated',
    })

    const pack = compileContextPack(request)
    assert.match(pack.context, new RegExp(multilingualCase.needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
  })
}

test('supplementary-plane Han characters count as Unicode code points', () => {
  assert.equal(estimateTokens('𠮷'), 1)
  assert.equal(estimateTokens('𠮷野家'), 3)
})

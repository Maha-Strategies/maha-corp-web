/**
 * Per-language retention and token-estimate accuracy.
 *
 *   node --experimental-strip-types scripts/measure-language-retention.ts
 *
 * MCRB-1 is built on QASPER, which is English-only, so no existing benchmark
 * can see whether this works in any other language. It did not: the word
 * pattern was ASCII-only, so Cyrillic, Arabic and CJK text yielded almost no
 * indexable terms and ranking collapsed to positional order -- truncation
 * under another name. The token estimate counted each non-Latin character as
 * one unit, over-counting Russian and Arabic roughly threefold, which dropped
 * passages for exceeding a budget they would have fit inside.
 *
 * Retention here is the same measure used everywhere else: a needle placed
 * two-thirds of the way through a document of otherwise irrelevant filler, at
 * a budget far too small to hold everything. If ranking works the needle
 * survives; if it does not, only the opening passages do.
 *
 * The estimate column is the ratio of this module's own count to a real BPE
 * count. It is not expected to reach 1.00 -- BPE is learned and no cheap
 * function reproduces it -- but a script sitting at 3x is being actively
 * mismeasured rather than approximated.
 */

import { encode } from 'gpt-tokenizer'

import { compileContextPack, estimateTokens } from '../lib/context-compiler.ts'

type Case = {
  language: string
  script: string
  task: string
  filler: (index: number) => string
  needle: string
}

const CASES: Case[] = [
  {
    language: 'English', script: 'Latin',
    task: 'What is the rollback threshold for API errors?',
    filler: (i) => `Routine note ${i}. Staffing, dashboards, meeting cadence and maintenance calendars for the quarter.`,
    needle: 'Rollback if API errors exceed 2 percent for five minutes.',
  },
  {
    language: 'French', script: 'Latin+diacritics',
    task: 'Quel est le seuil de restauration pour les erreurs API ?',
    filler: (i) => `Note de routine ${i}. Personnel, tableaux de bord, cadence des réunions et calendriers de maintenance.`,
    needle: 'Restaurer si les erreurs API dépassent 2 pour cent pendant cinq minutes.',
  },
  {
    language: 'German', script: 'Latin+diacritics',
    task: 'Wie hoch ist der Rollback-Schwellenwert für API-Fehler?',
    filler: (i) => `Routinenotiz ${i}. Personal, Dashboards, Besprechungsrhythmus und Wartungskalender für das Quartal.`,
    needle: 'Rollback, wenn API-Fehler fünf Minuten lang 2 Prozent überschreiten.',
  },
  {
    language: 'Spanish', script: 'Latin+diacritics',
    task: '¿Cuál es el umbral de reversión para los errores de API?',
    filler: (i) => `Nota rutinaria ${i}. Personal, paneles, cadencia de reuniones y calendarios de mantenimiento.`,
    needle: 'Revertir si los errores de API superan el 2 por ciento durante cinco minutos.',
  },
  {
    language: 'Russian', script: 'Cyrillic',
    task: 'Каков порог отката при ошибках интерфейса?',
    filler: (i) => `Рутинная заметка ${i}. Персонал, панели мониторинга, частота совещаний и календари обслуживания.`,
    needle: 'Откатить, если ошибки интерфейса превышают 2 процента в течение пяти минут.',
  },
  {
    language: 'Greek', script: 'Greek',
    task: 'Ποιο είναι το όριο επαναφοράς για σφάλματα διεπαφής;',
    filler: (i) => `Σημείωση ρουτίνας ${i}. Προσωπικό, πίνακες ελέγχου, συχνότητα συσκέψεων και ημερολόγια συντήρησης.`,
    needle: 'Επαναφορά εάν τα σφάλματα διεπαφής υπερβούν το 2 τοις εκατό για πέντε λεπτά.',
  },
  {
    language: 'Arabic', script: 'Arabic',
    task: 'ما هو حد التراجع عند أخطاء الواجهة؟',
    filler: (i) => `ملاحظة روتينية ${i}. الموظفون ولوحات المعلومات ووتيرة الاجتماعات وتقويمات الصيانة.`,
    needle: 'التراجع إذا تجاوزت أخطاء الواجهة نسبة 2 بالمئة لمدة خمس دقائق.',
  },
  {
    language: 'Japanese', script: 'Han+Kana',
    task: 'インターフェース障害のロールバック閾値はいくつですか。',
    filler: (i) => `定例メモ${i}。人員配置、ダッシュボード、会議の頻度、保守カレンダーについて。`,
    needle: 'インターフェース障害が5分間で2パーセントを超えた場合はロールバックする。',
  },
  {
    language: 'Chinese', script: 'Han',
    task: '接口错误的回滚阈值是多少。',
    filler: (i) => `例行说明${i}。人员配置、仪表板、会议频率和维护日历。`,
    needle: '如果接口错误在五分钟内超过百分之二则执行回滚。',
  },
  {
    language: 'Korean', script: 'Hangul',
    task: '인터페이스 오류의 롤백 임계값은 얼마입니까.',
    filler: (i) => `정기 메모 ${i}. 인력 배치, 대시보드, 회의 빈도 및 유지보수 일정.`,
    needle: '인터페이스 오류가 5분 동안 2퍼센트를 초과하면 롤백한다.',
  },
]

const FILLER_COUNT = 20
const NEEDLE_AT = 13
const BUDGET = 96

function run(item: Case) {
  const parts: string[] = []
  for (let index = 0; index < FILLER_COUNT; index += 1) {
    parts.push(item.filler(index + 1))
    if (index === NEEDLE_AT) parts.push(item.needle)
  }
  const text = parts.join('\n\n')
  const pack = compileContextPack({
    clientRequestId: 'language-retention', task: item.task, tokenBudget: BUDGET,
    documents: [{ id: 'doc', title: 'Doc', text }],
  })
  return {
    retained: pack.context.includes(item.needle),
    estimateRatio: estimateTokens(item.needle) / encode(item.needle).length,
    packedPassages: pack.includedPassages.length,
  }
}

const rows = CASES.map((item) => ({ ...item, ...run(item) }))

const header = ['language', 'script', 'needle retained', 'passages kept', 'estimate/BPE']
const body = rows.map((row) => [
  row.language,
  row.script,
  row.retained ? 'yes' : 'NO',
  String(row.packedPassages),
  `${row.estimateRatio.toFixed(2)}x`,
])
const widths = header.map((head, column) => Math.max(head.length, ...body.map((line) => line[column].length)))
const line = (cells: string[]) => cells.map((cell, column) => cell.padEnd(widths[column])).join('  ')

console.log(`\nPer-language retention — needle at position ${NEEDLE_AT + 1} of ${FILLER_COUNT + 1}, budget ${BUDGET}\n`)
console.log(line(header))
console.log(widths.map((width) => '-'.repeat(width)).join('  '))
for (const row of body) console.log(line(row))

const retained = rows.filter((row) => row.retained).length
const worstEstimate = Math.max(...rows.map((row) => Math.max(row.estimateRatio, 1 / row.estimateRatio)))
console.log(`\n  retained ${retained}/${rows.length} languages`)
console.log(`  worst estimate drift ${worstEstimate.toFixed(2)}x`)
const failed = rows.filter((row) => !row.retained).map((row) => row.language)
if (failed.length > 0) console.log(`  ranking still blind: ${failed.join(', ')}`)
console.log('\nOne document per language, one needle each. Enough to show whether ranking')
console.log('functions at all in a script; not enough to quantify retention rates. A')
console.log('customer-facing per-language claim needs a labelled multilingual corpus.\n')

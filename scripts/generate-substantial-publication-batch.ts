import { mkdirSync, writeFileSync } from 'node:fs'

import {
  SUBSTANTIAL_PUBLICATION_PAGES,
  SUBSTANTIAL_PUBLICATION_VERSION,
} from '../lib/substantial-page-publication.ts'

mkdirSync('content/substantial-pages', { recursive: true })
mkdirSync('docs/substantial-pages', { recursive: true })

const summary = {
  schemaVersion: SUBSTANTIAL_PUBLICATION_VERSION,
  records: SUBSTANTIAL_PUBLICATION_PAGES.length,
  eligible: SUBSTANTIAL_PUBLICATION_PAGES.filter((page) => page.quality.eligible).length,
  blocked: SUBSTANTIAL_PUBLICATION_PAGES.filter((page) => !page.quality.eligible).length,
  before: {
    sections: SUBSTANTIAL_PUBLICATION_PAGES.reduce((sum, page) => sum + page.depth.before.sections, 0),
    paragraphs: SUBSTANTIAL_PUBLICATION_PAGES.reduce((sum, page) => sum + page.depth.before.paragraphs, 0),
    informationCharacters: SUBSTANTIAL_PUBLICATION_PAGES.reduce((sum, page) => sum + page.depth.before.informationCharacters, 0),
  },
  after: {
    sections: SUBSTANTIAL_PUBLICATION_PAGES.reduce((sum, page) => sum + page.depth.after.sections, 0),
    paragraphs: SUBSTANTIAL_PUBLICATION_PAGES.reduce((sum, page) => sum + page.depth.after.paragraphs, 0),
    informationCharacters: SUBSTANTIAL_PUBLICATION_PAGES.reduce((sum, page) => sum + page.depth.after.informationCharacters, 0),
    dimensions: SUBSTANTIAL_PUBLICATION_PAGES.reduce((sum, page) => sum + page.depth.after.dimensions, 0),
  },
  pages: SUBSTANTIAL_PUBLICATION_PAGES,
}

writeFileSync('content/substantial-pages/publication-batch-1.json', `${JSON.stringify(summary, null, 2)}\n`)

const lines = [
  '# Substantial-page Publication Batch 1',
  '',
  'This generated report measures source-bound information depth. Character counts are descriptive and are not publication criteria.',
  '',
  `Records: ${summary.records} · eligible: ${summary.eligible} · blocked: ${summary.blocked}`,
  '',
  '| Record | Gate | Before chars | After chars | Delta | Dimensions |',
  '| --- | --- | ---: | ---: | ---: | ---: |',
  ...SUBSTANTIAL_PUBLICATION_PAGES.map((page) => `| \`${page.contract.recordId}\` | ${page.quality.eligible ? 'pass' : 'BLOCK'} | ${page.depth.before.informationCharacters} | ${page.depth.after.informationCharacters} | ${page.depth.characterDelta} | ${page.depth.after.dimensions} |`),
  '',
  '## Gate boundary',
  '',
  '- Every explanatory paragraph is bound to a canonical claim and its declared source.',
  '- Complete claim and source coverage are required.',
  '- Definition, mechanism/context, evidence interpretation, applicability decisions, limitations, relationships, and provenance must all be represented.',
  '- Word or character count cannot make a page eligible.',
  '- Comparison and calculation are included only when the canonical record supplies the required supported sides or reproducible inputs.',
]
writeFileSync('docs/substantial-pages/publication-batch-1.md', `${lines.join('\n')}\n`)

console.log(JSON.stringify({ records: summary.records, eligible: summary.eligible, blocked: summary.blocked, before: summary.before, after: summary.after }, null, 2))

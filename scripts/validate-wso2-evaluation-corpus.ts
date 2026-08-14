import corpusJson from '../content/integrations/wso2-context-compiler-corpus.json' with { type: 'json' }
import { validateWso2EvaluationLabels } from '../lib/integrations/wso2-evaluation-corpus.ts'

const { corpus, digest, workloadCount, requiredFactCount, expectedCitationCount } = validateWso2EvaluationLabels(corpusJson)

console.log(JSON.stringify({
  schemaVersion: corpus.schemaVersion,
  corpus: corpus.name,
  sanitized: corpus.sanitization,
  labelFreeze: {
    ...corpus.labelFreeze,
    verifiedDigest: digest,
  },
  workloadCount,
  requiredFactCount,
  expectedCitationCount,
  difficultyCounts: Object.fromEntries(['easy', 'medium', 'hard'].map((difficulty) => [difficulty, corpus.workloads.filter((workload) => workload.difficulty === difficulty).length])),
  documentStructureCount: new Set(corpus.workloads.map((workload) => workload.documentStructure)).size,
}, null, 2))

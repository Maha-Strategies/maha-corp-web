import { SAMPLE_ASSESSMENT_BANNER, type SampleAssessment } from './context-control-sample.ts'

/**
 * Renders the assessment model as Markdown.
 *
 * This is the source of record for the deliverable. The PDF is rendered from
 * the same model rather than from this text, so the two cannot drift apart by
 * one being edited: both are regenerated together and checked byte-for-byte.
 */
function table(headers: string[], rows: string[][]): string {
  return [
    `| ${headers.join(' | ')} |`,
    `| ${headers.map(() => '---').join(' | ')} |`,
    ...rows.map((row) => `| ${row.join(' | ')} |`),
  ].join('\n')
}

export function renderSampleAssessmentMarkdown(model: SampleAssessment): string {
  const { corpus, configuration, findings, comparison, failure, trace, digests } = model

  const sections: string[] = []

  sections.push(`# ${model.title}

**${SAMPLE_ASSESSMENT_BANNER}**

| | |
| --- | --- |
| Prepared by | ${model.preparedBy} |
| Deliverable | ${model.subtitle} |
| Evaluation run | \`${model.runLabel}\` |
| Observed | ${model.observedDate} |
| Evidence artifact SHA-256 | \`${digests.evidenceArtifact}\` |

> This document shows the shape and rigour of the evidence package a customer
> receives after a bounded Context-Control Evidence Assessment. Every figure in
> it comes from a frozen **synthetic** corpus. It is not a customer result, not
> a case study, and not a performance guarantee. Maha Strategies is not claiming
> WSO2 partnership, certification, approval, or customer validation.`)

  sections.push(`## 1. Executive decision

### What was evaluated

Three request paths through one WSO2 AI Gateway deployment, over ${corpus.workloadCount} frozen
synthetic workloads of 20K-100K estimated tokens, ${model.corpus.callCount} calls in total:

1. **${findings[0].label}** - the request as the application sends it today.
2. **${findings[1].label}** - the gateway's own prompt-compression policy.
3. **${findings[2].label}** - Maha as a fail-closed request interceptor ahead of the model.

Each path answered the same labelled questions against the same source
documents, under a frozen configuration with no automatic retries.

### Observed result

On this synthetic corpus, the Maha path forwarded
**${comparison.inputTokenReductionPercent}% fewer provider input tokens** than the baseline
(${model.tokensAvoided} tokens avoided) at **${comparison.costReductionPercent}% lower modeled cost**
(${model.costAvoidedUsd} avoided), while a path-blinded semantic adjudication scored
**${findings[2].adjudicatedFacts} required facts answered** - the same score the uncompressed
baseline achieved, and against ${findings[1].adjudicatedFacts} for the gateway's native
compressor. All ${model.successfulCalls} calls completed; none required a retry.

### Recommended decision

**Proceed to a bounded evaluation on a customer-shaped workload. Do not
generalize this synthetic result.**

The observed result is a reason to run a real evaluation, not a substitute for
one. Nothing here establishes behaviour on customer documents, at customer
volume, or under a customer's own retention and citation requirements. The
finding that would change a deployment decision - whether the reduction and the
retention both survive real, messy source material - has not been measured and
cannot be inferred from this corpus.

The result is stated above. The recommendation is stated here. They are
deliberately separate: the first is a measurement, the second is a judgement
about what to do next, and a reader should be able to reject the second while
accepting the first.`)

  sections.push(`## 2. Scope and configuration

The configuration below was frozen before any model call and is recorded in the
committed reproduction manifest. Changing any of it invalidates comparison with
these figures.

${table(['Setting', 'Value'], [
  ['Gateway product', configuration.gatewayProduct],
  ['Gateway version', configuration.gatewayVersion],
  ['Prompt Compressor version', configuration.promptCompressorVersion],
  ['Prompt Compressor retained ratio', String(configuration.promptCompressorRetainedRatio)],
  ['Maha interceptor version', configuration.mahaInterceptorVersion],
  ['Maha interceptor fail-closed', configuration.mahaInterceptorFailClosed ? 'Yes, both request and response phases' : 'No'],
  ['Model', `\`${configuration.model}\``],
  ['Temperature', String(configuration.temperature)],
  ['Maximum output tokens', String(configuration.maxOutputTokens)],
  ['Automatic retries', `${configuration.automaticRetries} (zero-retry rule)`],
  ['Modeled input price', `$${configuration.pricingAssumptionUsdPerMillionTokens.input} per million tokens`],
  ['Modeled output price', `$${configuration.pricingAssumptionUsdPerMillionTokens.output} per million tokens`],
])}

### Corpus

${table(['Property', 'Value'], [
  ['Workloads', String(corpus.workloadCount)],
  ['Calls', `${corpus.callCount} (${corpus.workloadCount} workloads x 3 paths)`],
  ['Difficulty mix', `${corpus.difficulties.easy} easy, ${corpus.difficulties.medium} medium, ${corpus.difficulties.hard} hard`],
  ['Labelled required facts', String(corpus.requiredFactCount)],
  ['Expected citations', String(corpus.expectedCitationCount)],
  ['Nature', 'Synthetic. No customer data, personal data, or credentials.'],
  ['Label-freeze digest', `\`${corpus.labelFreezeDigest}\``],
])}

Every required fact, expected citation and prohibited assertion was labelled and
digest-frozen **before** any path was run. Changing an input or a label after
seeing model output fails validation rather than silently moving the target.`)

  sections.push(`## 3. Aggregate findings

All figures below are read from the committed evidence artifact, which carries
every one of the ${corpus.callCount} calls as an individual row and re-derives these totals
from those rows. A hand-edited total fails validation rather than printing.

${table(
  ['Path', 'Provider input tokens', 'Modeled cost', 'Latency p50', 'Latency p95'],
  findings.map((row) => [row.label, row.providerInputTokens, row.modeledCostUsd, row.latencyP50, row.latencyP95]),
)}

### Required-fact retention, by scorer

Two scorers were applied to the same answers. **They disagree, and any retention
figure is meaningless without naming which one produced it.**

${table(
  ['Path', 'Path-blinded semantic adjudication', 'Deterministic exact-span containment', 'Expected citations resolved'],
  findings.map((row) => [row.label, row.adjudicatedFacts, row.deterministicFacts, row.citations]),
)}

- **Path-blinded semantic adjudication** applies a fixed rubric to each answer
  with the path hidden from the reviewer, so a correct paraphrase counts as
  answered. This is the figure a business reader usually means by "did it keep
  the facts".
- **Deterministic exact-span containment** requires the labelled evidence span
  to appear literally. It is reproducible by anyone holding the corpus, and it
  **under-counts**: a correct paraphrase scores as a miss. That is why the
  baseline scores ${findings[0].deterministicFacts} under it while scoring
  ${findings[0].adjudicatedFacts} under adjudication.

Reporting only the first figure would overstate the result. Reporting only the
second would understate it. Both are published per workload in the artifact.

### Other measured properties

- Prohibited assertions across all ${corpus.callCount} calls: **${model.prohibitedAssertions}**.
- Calls completing without retry: **${model.successfulCalls} of ${corpus.callCount}**.
- Maha non-expansion bypass engaged on: **${model.bypassEngaged} of ${corpus.workloadCount} workloads**
  (see section 5 for what this does and does not show).`)

  sections.push(`## 4. Representative three-path trace

One workload from the corpus, reconstructed from the durable run record and
published as a sanitized trace. **This is illustrative. It is one call per path
and is not evidence for the aggregate in section 3.**

${table(['Property', 'Value'], [
  ['Trace', `\`${trace.traceId}\``],
  ['Workload', `\`${trace.workloadId}\` (${trace.difficulty})`],
  ['Source documents', String(trace.documentCount)],
  ['Total source bytes', trace.sourceBytes],
])}

${table(
  ['Path', 'Input tokens', 'Output tokens', 'Latency', 'Modeled cost'],
  trace.rows.map((row) => [row.label, row.inputTokens, row.outputTokens, row.latencyMs, row.modeledCostUsd]),
)}

The trace carries no source document text, no compiled context, no request
headers, and no credential. On the Maha path it carries the pack identifier and
the input and output hashes, so the selection that produced that answer can be
identified without republishing the material it selected from.

${trace.limitations.map((limitation) => `- ${limitation}`).join('\n')}`)

  sections.push(`## 5. Failure and boundary evidence

Reduction is only useful if the component fails safely. The behaviours below
were exercised separately from the measurement run, with no provider
credential and **${failure.liveProviderCalls} live provider calls**
(\`${failure.evaluationId}\`, ${failure.evaluatedDate}).

The deployable policy pins \`passthroughOnError: false\` on **both** the request
and response phases, with a ${failure.timeoutMillis} ms timeout. Fail-closed is
the point: an invalid or absent evidence seal must not become a successful
response.

${table(
  ['Condition', 'Layer', 'Observed', 'Forwarded upstream?'],
  failure.cases.map((entry) => [entry.id, entry.layer, entry.observedStatus, entry.upstreamForwarded]),
)}

The gateway-side behaviours were verified against the WSO2 Interceptor Service
v1 policy implementation itself, not a Maha reimplementation of it. Tests
passed: ${failure.upstreamTests.map((name) => `\`${name}\``).join(', ')}. Each
scenario was measured ${failure.repetitionsPerScenario} times.

### Non-expansion and minimum-size bypass

The interceptor does not substitute a compiled pack when the rendered
whole-document input is below the minimum-size threshold, and above it still
compares the compiled and original contexts and forwards the original whenever
compilation would be the same size or larger. The response identifies the
decision in its headers.

On this corpus the bypass **engaged on ${model.bypassEngaged} of ${corpus.workloadCount} workloads**, because every
workload was 20K-100K tokens and compilation reduced all of them. That means the
bypass path is **present and declared but not exercised here** - its behaviour on
small or non-reducing payloads is unmeasured by this run.

### Explicitly unmeasured

- Behaviour on customer documents of any kind.
- Behaviour at production concurrency or sustained volume.
- Latency as a distribution: section 3 reports p50 and p95 across ${corpus.workloadCount} single
  observations, not repeated runs of the same workload.
- The bypass path on small or non-reducing inputs.
- Any deployed-gateway network overhead beyond the measured call latency.
- Recovery behaviour after a partial or ambiguous settlement in production.`)

  sections.push(`## 6. Limitations

These are carried from the evidence artifact and the run records. None is
rhetorical; each one bounds a claim above.

${model.artifactLimitations.map((limitation) => `- ${limitation}`).join('\n')}
${failure.limitations.map((limitation) => `- ${limitation}`).join('\n')}
- The Prompt Compressor configuration used here (version ${configuration.promptCompressorVersion},
  retained ratio ${configuration.promptCompressorRetainedRatio}) has **not been confirmed by WSO2 or by a
  customer** as the intended production setup. Its result must not be
  generalized until it has been.
- Costs are **modeled**: the declared price assumption applied to observed token
  counts. They are not provider invoices and they are not a savings guarantee.
- The answer-bearing primary evidence - the durable checkpoint and the
  path-blinded adjudication - is **not committed to the repository and is not
  distributed with this package**, because both retain the model's answer text
  for every call. The public artifact is independently checkable from its rows
  to its aggregates; full source-to-row regeneration additionally requires the
  digest-identified primary files, which are held outside the repository and
  must be digest-verified before use.
- This document describes a compatibility evaluation. It is not a regulatory
  certification, an accreditation, an endorsement by WSO2, or a statement about
  production reliability.`)

  sections.push(`## 7. Recommended customer evaluation

A fixed-scope engagement designed to answer one question: does the result above
survive your material?

**1. You supply one sanitized, representative workflow.** A single document set
or RAG export that resembles what your system actually reads, with the facts and
citations that must survive named in advance. No production credentials and no
personal data.

**2. Configuration and spend are frozen before anything runs.** Gateway and
policy versions, compressor ratio, model, temperature, output ceiling, an exact
provider-spend ceiling, and the zero-retry rule are agreed and digest-recorded.
Your labels are frozen at the same time, so the scoring target cannot move after
results are seen.

**3. The same three paths run against it.** Baseline, your gateway's native
compressor, and Maha - identical inputs, identical labels, no automatic retries,
a durable checkpoint after every call.

**4. You receive a private evidence package.** The structure of this document:
per-workload rows, both retention scorers, latency, modeled cost, failure-path
behaviour, and every limitation that applies to your run.

**5. Maha states a recommendation: proceed, revise, or stop.** Including stop.
An evaluation that concludes the component does not help your workload is a
successful evaluation, and it is delivered as plainly as the alternative.

Commercial terms for this engagement are quoted separately and are not part of
this sample document.`)

  sections.push(`## 8. Technical appendix

### Verify the figures in section 3

\`\`\`
shasum -a 256 content/integrations/wso2-live-evaluation-evidence.json
npm run validate:wso2-live-evidence
npm run reproduce:wso2-evaluation
\`\`\`

The first prints the artifact digest below. The second re-derives every
aggregate from the per-workload rows and fails on any inconsistency. The third
is the frozen-corpus dry run: it contacts no gateway and makes no provider call.

### Verify this document

\`\`\`
npm run validate:context-control-sample-assessment
\`\`\`

Regenerates the document from the committed evidence and fails if any figure in
it differs from the artifact.

### Digests

${table(['Artifact', 'SHA-256'], [
  ['Evidence artifact (published)', `\`${digests.evidenceArtifact}\``],
  ['Frozen corpus label freeze', `\`${digests.corpusLabelFreeze}\``],
  ['Reproduction manifest', `\`${digests.reproductionManifest}\``],
  ['Failure-path evidence', `\`${digests.failurePathEvidence}\``],
  ['Source checkpoint (not published)', `\`${digests.sourceCheckpoint}\``],
  ['Source adjudication (not published)', `\`${digests.sourceAdjudication}\``],
])}

### Referenced materials

- Evaluation policy bundle: \`content/integrations/wso2-policy-bundle/\` - secret-free proxy template, compatibility manifest with artifact digests, create-only installer, confirmation-gated uninstaller. Validate with \`npm run validate:wso2-policy-bundle\`.
- Frozen reproduction manifest: \`content/integrations/wso2-reproduction.json\`.
- Sanitized representative trace: \`content/integrations/wso2-sanitized-three-path-trace.json\`.
- Failure-path evidence: \`content/integrations/wso2-failure-path-result.json\`.
- Technical integration notes: \`docs/integrations/wso2-context-interceptor.md\`.
- Evidence recovery record: \`docs/integrations/wso2-live-evaluation-evidence-recovery.md\`.

### Data handling in this document

No model answer text, source document, prompt, credential, request body,
response body, private file path, or customer-identifying content appears
anywhere in this package.`)

  return `${sections.join('\n\n---\n\n')}\n`
}

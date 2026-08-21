import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'

/**
 * The buyer-facing security and data-boundary statement, as data.
 *
 * Every sentence a reviewer could challenge is a claim object carrying the
 * committed files it rests on. That makes the document machine-checkable in
 * the only way that matters here: a claim with no source, or a source whose
 * bytes have moved since the claim was written, fails the build rather than
 * reaching a procurement reviewer.
 *
 * The bar for a sentence appearing below is that it is true of the code on
 * `main` today -- not that it is a good thing to be able to say.
 */
export const BOUNDARY_MARKDOWN_PATH = 'docs/security/context-control-security-boundary.md'
export const BOUNDARY_PDF_PATH = 'content/security/context-control-security-boundary.pdf'
export const BOUNDARY_MANIFEST_PATH = 'content/security/context-control-security-boundary-sources.json'

export const BOUNDARY_VERSION = '1.0.0'

export type SourceKind = 'code' | 'test' | 'doc' | 'evidence'
export type SourceRef = { path: string; kind: SourceKind; note: string }
export type Claim = { id: string; text: string; sources: SourceRef[] }
export type Section = { id: string; title: string; lead?: string; claims: Claim[] }

const code = (path: string, note: string): SourceRef => ({ path, kind: 'code', note })
const spec = (path: string, note: string): SourceRef => ({ path, kind: 'test', note })
const doc = (path: string, note: string): SourceRef => ({ path, kind: 'doc', note })
const evidence = (path: string, note: string): SourceRef => ({ path, kind: 'evidence', note })

const COMPILER = 'lib/context-compiler.ts'
const INTERCEPTOR = 'lib/integrations/wso2-context-interceptor.ts'
const INTERCEPTOR_TEST = 'test/wso2-context-interceptor.test.ts'
const METERING = 'lib/context-compiler-metering.ts'
const REQUEST_ROUTE = 'app/api/integrations/wso2/context-compiler/handle-request/route.ts'
const RESPONSE_ROUTE = 'app/api/integrations/wso2/context-compiler/handle-response/route.ts'
const FAILURE_EVIDENCE = 'content/integrations/wso2-failure-path-result.json'
const INTEGRATION_DOC = 'docs/integrations/wso2-context-interceptor.md'
const REPRODUCTION = 'content/integrations/wso2-reproduction.json'
const SANITIZED_TRACE = 'content/integrations/wso2-sanitized-three-path-trace.json'

export const SECTIONS: readonly Section[] = [
  {
    id: 'scope',
    title: 'Purpose and scope',
    claims: [
      {
        id: 'scope.covers',
        text: 'This covers two things: the Maha Context Compiler, and the bounded interceptor that runs it inside a WSO2 AI Gateway request.',
        sources: [code(COMPILER, 'the compiler'), code(INTERCEPTOR, 'the interceptor')],
      },
      {
        id: 'scope.excludes',
        text: 'It does not describe your gateway, your model provider, your cloud account, or your deployment. Those keep their own retention, logging and network controls, and this document makes no statement about them.',
        sources: [doc(INTEGRATION_DOC, 'declared non-fit and failure boundaries')],
      },
      {
        id: 'scope.not-a-review',
        text: 'It is an evidence summary, not a substitute for your own security review.',
        sources: [doc(INTEGRATION_DOC, 'evaluation-only status')],
      },
    ],
  },
  {
    id: 'data',
    title: 'What is handled',
    claims: [
      {
        id: 'data.request',
        text: 'A request carries a task string, a token budget, and one to eight documents, each with an identifier, an optional title, and text.',
        sources: [code(COMPILER, 'parseContextPackRequest bounds and field set')],
      },
      {
        id: 'data.response',
        text: 'The response returns the compiled context pack, the selected passages verbatim with their identifiers and hashes, a per-source manifest, token and coverage metrics, explicit warnings, and input and output hashes.',
        sources: [code(COMPILER, 'compileContextPack return value')],
      },
      {
        id: 'data.metering',
        text: 'On the metered direct API, the only record kept of a call is a usage row of five fields: access mode, credential identifier, status class, and the compiler’s own input and output token estimates. No task, no document, no identifier from your content, and no hash is written to it.',
        sources: [code(METERING, 'recordContextCompilerUsage writes exactly five parameters')],
      },
    ],
  },
  {
    id: 'source-text',
    title: 'The source-text boundary',
    lead: 'Stated precisely, because the useful version of this claim is narrower than the marketing version.',
    claims: [
      {
        id: 'text.processed',
        text: 'Your source text is processed in the request that carries it. Selection is deterministic ranking and de-duplication over that text; no model is invoked and nothing is sent to a third party by the compiler.',
        sources: [code(COMPILER, 'pure function, BM25 selection, no network client imported')],
      },
      {
        id: 'text.returned',
        text: 'The compiler returns the passages it selected, verbatim. That is the product, not a leak: the pack is the text you asked it to choose from your own documents, and it is returned to the caller who supplied them.',
        sources: [code(COMPILER, 'includedPassages carries selected passage text')],
      },
      {
        id: 'text.interceptor-storage',
        text: 'In the WSO2 interceptor path, neither route handler imports or invokes any database, cache, queue or filesystem client, and both mark their responses no-store. What the gateway receives back is metadata: a pack identifier, hashes, counts, token measurements and a bypass decision.',
        sources: [
          code(REQUEST_ROUTE, 'no storage client imported; Cache-Control no-store'),
          code(RESPONSE_ROUTE, 'no storage client imported; Cache-Control no-store'),
          code(INTERCEPTOR, 'evidence header set is metadata only'),
        ],
      },
      {
        id: 'text.evidence-retained',
        text: 'Where evidence is retained, it is hashes and metadata: SHA-256 over each normalised source, a hash per selected passage, source and passage identifiers, passage counts, coverage percentages and token estimates.',
        sources: [code(COMPILER, 'sourceHash, passageHash, sourceManifest')],
      },
      {
        id: 'text.excluded',
        text: 'Published and sanitised artifacts exclude document bodies, compiled context, request headers and credentials, and declare those exclusions in the artifact itself.',
        sources: [evidence(SANITIZED_TRACE, 'sanitization flags and redacted representation')],
      },
      {
        id: 'text.no-universal-claim',
        text: 'Maha does not claim universal zero retention. The claim above is scoped to these components. Your gateway, your provider and your own logging may retain the same text under settings Maha neither sets nor sees.',
        sources: [doc(INTEGRATION_DOC, 'deployment-stage gates remain the operator’s')],
      },
    ],
  },
  {
    id: 'integrity',
    title: 'Integrity and evidence',
    claims: [
      {
        id: 'integrity.input-hash',
        text: 'The input hash commits to the task, the token budget, and for each document its identifier, title and a SHA-256 of its normalised text. Document bodies are not part of the hash preimage.',
        sources: [code(COMPILER, 'inputHash construction')],
      },
      {
        id: 'integrity.output-hash',
        text: 'The output hash is a SHA-256 over the exact rendered pack, so the bytes a model received can be identified without republishing them.',
        sources: [code(COMPILER, 'outputHash over rendered markdown')],
      },
      {
        id: 'integrity.budget',
        text: 'The declared token budget is enforced, not advised. In the default guaranteed mode the compiler fills to a margin below the stated figure and then removes the lowest-ranked passages until the rendered pack fits.',
        sources: [code(COMPILER, 'GUARANTEED_BUDGET_FACTOR and the trim loop')],
      },
      {
        id: 'integrity.non-claims',
        text: 'Every response carries machine-readable non-claims: selection is extractive, evidence retention is best-effort, no claim verification is performed, completeness is not guaranteed, hallucination prevention is not guaranteed, and token counts are model-neutral estimates rather than provider billing counts.',
        sources: [code(COMPILER, 'retentionBoundaries and warningCodes')],
      },
      {
        id: 'integrity.reviewable',
        text: 'A reviewer holding the same inputs can recompute both hashes and confirm the pack is the one the evidence describes.',
        sources: [spec('test/context-compiler-recipe.test.ts', 'reproducible pack contract')],
      },
    ],
  },
  {
    id: 'fail-closed',
    title: 'Fail-closed behaviour',
    lead: 'Each row below is a local contract test against the interceptor and the WSO2 Interceptor Service v1 policy implementation. None of it is a statement about your deployed environment.',
    claims: [
      {
        id: 'fail.unconfigured',
        text: 'Missing interceptor configuration returns HTTP 503 and forwards nothing upstream.',
        sources: [spec(INTERCEPTOR_TEST, 'fails closed when the secret is unset'), evidence(FAILURE_EVIDENCE, 'missing-interceptor-configuration')],
      },
      {
        id: 'fail.credential',
        text: 'A missing or invalid interceptor credential returns HTTP 401, is compared in constant time, and is stripped from the request rather than forwarded.',
        sources: [code(INTERCEPTOR, 'timingSafeEqual and headersToRemove'), spec(INTERCEPTOR_TEST, 'rejects an invalid credential and strips it'), evidence(FAILURE_EVIDENCE, 'invalid-interceptor-credential')],
      },
      {
        id: 'fail.oversized',
        text: 'A decoded body above 512,000 bytes is refused with HTTP 413 rather than truncated.',
        sources: [code(INTERCEPTOR, 'MAX_WSO2_OPENAI_BODY_BYTES'), spec(INTERCEPTOR_TEST, 'rejects oversized decoded bodies'), evidence(FAILURE_EVIDENCE, 'oversized-decoded-input')],
      },
      {
        id: 'fail.unavailable',
        text: 'With the interceptor timing out or refusing the connection, the gateway policy returns an immediate error and does not call the model. This was verified against the WSO2 policy implementation itself, not a Maha reimplementation of it.',
        sources: [evidence(FAILURE_EVIDENCE, 'interceptor-timeout and interceptor-unavailable, upstream Go tests')],
      },
      {
        id: 'fail.seal',
        text: 'The response phase verifies an HMAC seal over the request-phase evidence. Missing or tampered evidence fails closed instead of returning a successful response.',
        sources: [code(INTERCEPTOR, 'evidenceSeal and validEvidence'), spec(INTERCEPTOR_TEST, 'fails closed on missing or tampered evidence')],
      },
      {
        id: 'fail.passthrough',
        text: 'A request that does not carry the explicit Maha extension passes through untouched.',
        sources: [spec(INTERCEPTOR_TEST, 'requests without the extension pass through')],
      },
    ],
  },
  {
    id: 'budget',
    title: 'Budget, expansion and payment',
    claims: [
      {
        id: 'budget.minimum',
        text: 'Below 1,024 estimated tokens the interceptor forwards your original context instead of a compiled pack, and above it compares the two and forwards the original whenever compilation would not be smaller. Enabling the policy therefore cannot increase the context sent to your provider.',
        sources: [code(INTERCEPTOR, 'WSO2_CONTEXT_MINIMUM_COMPILE_TOKENS and the non-expansion guard'), spec(INTERCEPTOR_TEST, 'small contexts bypass; non-expansion guard preserves the original')],
      },
      {
        id: 'budget.declared',
        text: 'The decision is declared in the response headers, so a bypass is visible rather than silent.',
        sources: [code(INTERCEPTOR, 'x-maha-context-bypassed and bypass-reason headers')],
      },
      {
        id: 'budget.retries',
        text: 'The published evaluation runner performs no automatic retries and requires an explicit spend ceiling before it may make a paid call.',
        sources: [evidence(REPRODUCTION, 'automaticRetries 0; liveExecutionRequiresExplicitCeiling')],
      },
      {
        id: 'budget.payment-separate',
        text: 'Context control performs no payment action. The compiler signs nothing, holds no key and authorises no transfer; payment, where it applies at all, is a separate module on a separate resource path and is not part of the interceptor flow.',
        sources: [code(COMPILER, 'no payment or signing code path'), code(INTERCEPTOR, 'no payment or signing code path')],
      },
    ],
  },
  {
    id: 'limits',
    title: 'Known limitations',
    claims: [
      {
        id: 'limit.synthetic',
        text: 'Maha’s published evaluation corpus is synthetic. It establishes nothing about behaviour on your documents.',
        sources: [evidence(REPRODUCTION, 'corpus.synthetic true; stated limitations')],
      },
      {
        id: 'limit.certification',
        text: 'Maha holds no security certification or regulatory attestation, and this document is not one.',
        sources: [doc(INTEGRATION_DOC, 'no certification asserted')],
      },
      {
        id: 'limit.wso2',
        text: 'Maha is not a WSO2 partner and claims no WSO2 endorsement, certification, approval or customer validation. The integration is independent compatibility work.',
        sources: [doc(INTEGRATION_DOC, 'not a WSO2 endorsement')],
      },
      {
        id: 'limit.guarantees',
        text: 'No saving, latency, availability or provider behaviour is guaranteed, and no result is promised before measurement.',
        sources: [doc(INTEGRATION_DOC, 'no fixed result promised before measurement')],
      },
      {
        id: 'limit.injection',
        text: 'Selection is ranking and de-duplication. It does not verify claims and does not protect against prompt injection, data exfiltration or a hostile document.',
        sources: [code(COMPILER, 'claimVerificationPerformed false; extractive_selection_not_verification')],
      },
      {
        id: 'limit.customer',
        text: 'Yours to operate: the gateway-side credential mechanism, TLS termination, network egress, provider retention settings, and your own request logging. The published policy bundle is labelled evaluation-only because the interceptor-call credential is a gateway header rather than a reviewed secret reference.',
        sources: [doc(INTEGRATION_DOC, 'production promotion blocked pending a reviewed credential mechanism')],
      },
    ],
  },
]

export const VERIFICATION_COMMANDS: readonly { command: string; what: string }[] = [
  { command: 'npm test -- test/wso2-context-interceptor.test.ts', what: 'fail-closed, credential stripping, bypass and seal behaviour' },
  { command: 'npm run validate:context-control-security-boundary', what: 'every claim here maps to a committed source whose bytes still match' },
  { command: 'npm run reproduce:wso2-evaluation', what: 'the frozen evaluation, as a dry run that contacts nothing' },
]

export function sha256File(path: string): string {
  return createHash('sha256').update(readFileSync(path)).digest('hex')
}

export const ALL_CLAIMS: readonly Claim[] = SECTIONS.flatMap((section) => section.claims)

/** Every distinct file any claim rests on, with the digest it was written against. */
export function buildSourceManifest() {
  const paths = [...new Set(ALL_CLAIMS.flatMap((claim) => claim.sources.map((source) => source.path)))].sort()
  return {
    schemaVersion: '1.0.0' as const,
    documentVersion: BOUNDARY_VERSION,
    document: BOUNDARY_MARKDOWN_PATH,
    generator: 'scripts/generate-context-control-security-boundary.ts',
    note: 'Each claim in the document maps to one or more committed sources. A digest that no longer matches means the claim must be re-checked against the code before the document is republished.',
    sources: paths.map((path) => ({ path, sha256: `sha256:${sha256File(path)}` })),
    claims: ALL_CLAIMS.map((claim) => ({
      id: claim.id,
      text: claim.text,
      sources: claim.sources.map((source) => ({ path: source.path, kind: source.kind, note: source.note })),
    })),
  }
}

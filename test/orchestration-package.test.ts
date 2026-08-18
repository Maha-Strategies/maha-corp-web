import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { apiProxyGate } from '../lib/api-proxy-policy.ts'

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

test('orchestration control routes reach their dedicated bearer gate', () => {
  assert.equal(apiProxyGate('/api/v1/orchestration/tasks', 'GET', true), 'self_managed')
  assert.equal(apiProxyGate('/api/v1/orchestration/readiness', 'GET', true), 'self_managed')
  assert.equal(apiProxyGate('/api/v1/workflows/workflow-task-123/approvals/approval-123', 'POST', true), 'self_managed')
})

test('private image is standalone, non-root and health checked', () => {
  const dockerfile = read('deploy/orchestration/Dockerfile')
  const nextConfig = read('next.config.ts')
  assert.match(dockerfile, /MAHA_STANDALONE_BUILD=true/)
  assert.match(nextConfig, /MAHA_STANDALONE_BUILD === 'true' \? \{ cpus: 2 \} : undefined/)
  assert.match(dockerfile, /USER 10001:10001/)
  assert.match(dockerfile, /HEALTHCHECK/)
  assert.doesNotMatch(dockerfile, /WORKFLOW_CONTROL_TOKEN=/)
  assert.doesNotMatch(dockerfile, /UPSTASH_REDIS_REST_TOKEN=(?!build-only-placeholder)/)
})

test('container and Kubernetes references drop privilege and source runtime secrets externally', () => {
  const compose = read('deploy/orchestration/compose.yaml')
  assert.match(compose, /read_only: true/); assert.match(compose, /cap_drop:\n\s+- ALL/); assert.match(compose, /no-new-privileges:true/)
  const kubernetes = read('deploy/orchestration/kubernetes.yaml')
  assert.match(kubernetes, /automountServiceAccountToken: false/)
  assert.match(kubernetes, /readOnlyRootFilesystem: true/)
  assert.match(kubernetes, /allowPrivilegeEscalation: false/)
  assert.match(kubernetes, /secretRef:\n\s+name: maha-orchestration-secrets/)
  assert.doesNotMatch(kubernetes, /WORKFLOW_CONTROL_TOKEN:/)
})

test('deployment documentation states identity, storage and certification limits', () => {
  const guide = read('docs/orchestration-control-plane.md')
  assert.match(guide, /not yet OIDC\/SAML/)
  assert.match(guide, /Only Upstash-compatible Redis REST storage is implemented/)
  assert.match(guide, /not a claim that the current package already satisfies[\s\S]*regulatory certification/)
  assert.match(guide, /cannot independently execute a tool[\s\S]*sign a\s+payment/)
  const deploymentGuide = read('deploy/orchestration/README.md')
  assert.match(deploymentGuide, /at least 8 GiB of memory/)
  assert.match(deploymentGuide, /generate an SBOM and scan the final image/)
})

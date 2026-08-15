#!/usr/bin/env bash
# Imports the evaluation provider and three LLM proxies into a running
# WSO2 AI Gateway 1.1.0.
#
# The routes and payload shape here were recovered by probing a live gateway
# after the original definitions were lost with its runtime state. Two details
# cost real time and are worth stating: the entity is an LlmProxy, not an "API",
# and policy parameters live at policies[].paths[].params -- not as a sibling of
# the policy name, where four other spellings are accepted and silently dropped.
# A policy attached with parameters in the wrong place deploys at its default
# and reports success, which is the failure mode this evaluation exists to avoid.
set -euo pipefail

BASE="${WSO2_MANAGEMENT_API:-http://localhost:9090/api/management/v0.9}"
AUTH="${WSO2_MANAGEMENT_AUTH:-admin:admin}"
: "${MAHA_INTERCEPTOR_BASE:?Set MAHA_INTERCEPTOR_BASE to the interceptor BASE url (the policy appends /handle-request itself)}"
: "${WSO2_CONTEXT_INTERCEPTOR_SECRET:?Set WSO2_CONTEXT_INTERCEPTOR_SECRET (never commit it)}"

echo "provider: anthropic-eval"
curl --fail --silent --show-error -u "$AUTH" -X POST "${BASE}/llm-providers" \
  -H 'content-type: application/json' -d '{
    "apiVersion":"gateway.api-platform.wso2.com/v1alpha1","kind":"LlmProvider",
    "metadata":{"name":"anthropic-eval"},
    "spec":{"displayName":"Anthropic Evaluation","template":"anthropic",
            "upstream":{"url":"https://api.anthropic.com"},
            "accessControl":{"mode":"allow_all"}}}' >/dev/null || echo "  (already exists)"

for artifact in content/integrations/wso2-apis/*.json; do
  name=$(node -e "console.log(require('./$artifact').metadata.name)")
  # Env-driven values are substituted here so neither the endpoint nor the
  # credential is ever written into a committed artifact.
  body=$(node -e "
    const doc = require('./$artifact')
    for (const policy of doc.spec.policies ?? []) {
      for (const entry of policy.paths ?? []) {
        const p = entry.params ?? {}
        if (p.endpointFromEnv) { p.endpoint = process.env[p.endpointFromEnv]; delete p.endpointFromEnv }
        // The gateway-only token, injected by set-headers. Substituted here so
        // the secret never lands in a committed artifact.
        for (const header of p.request?.headers ?? []) {
          if (header.valueFromEnv) { header.value = process.env[header.valueFromEnv]; delete header.valueFromEnv }
        }
      }
    }
    console.log(JSON.stringify(doc))
  ")
  curl --silent --show-error -u "$AUTH" -X DELETE "${BASE}/llm-proxies/${name}" >/dev/null 2>&1 || true
  curl --fail --silent --show-error -u "$AUTH" -X POST "${BASE}/llm-proxies" \
    -H 'content-type: application/json' --data "$body" >/dev/null
  echo "  deployed ${name}"
done

# Deployment is automatic on create; there is no separate deploy call. Verify
# the parameters actually persisted rather than trusting the 200.
echo "verifying persisted policy parameters"
curl --fail --silent -u "$AUTH" "${BASE}/llm-proxies/maha-eval-native" \
  | node -e "
    const spec = JSON.parse(require('fs').readFileSync(0,'utf8')).spec
    const params = spec.policies?.[0]?.paths?.[0]?.params
    if (!params?.rules?.length) { console.error('FAIL: compressor parameters did not persist'); process.exit(1) }
    console.log('  compressor ratio =', params.rules[0].value)
  "

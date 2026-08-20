#!/usr/bin/env bash
set -euo pipefail

BUNDLE_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
MANAGEMENT_API=${WSO2_MANAGEMENT_API:-http://localhost:9090/api/management/v0.9}
MANAGEMENT_AUTH=${WSO2_MANAGEMENT_AUTH:-admin:admin}
RESPONSE_FILE=$(mktemp "${TMPDIR:-/tmp}/maha-wso2-policy-install.XXXXXX")
trap 'rm -f "$RESPONSE_FILE"' EXIT

: "${WSO2_PROVIDER_ID:?Set WSO2_PROVIDER_ID to an existing WSO2 LLM provider id}"
: "${MAHA_INTERCEPTOR_BASE:?Set MAHA_INTERCEPTOR_BASE to the interceptor base URL (without /handle-request)}"

WSO2_PROXY_NAME=${WSO2_PROXY_NAME:-maha-context-compiler}
WSO2_PROXY_CONTEXT=${WSO2_PROXY_CONTEXT:-/maha/context}
export WSO2_PROXY_NAME WSO2_PROXY_CONTEXT WSO2_PROVIDER_ID MAHA_INTERCEPTOR_BASE

case "$MAHA_INTERCEPTOR_BASE" in
  https://*) ;;
  http://localhost:*|http://127.0.0.1:*|http://host.docker.internal:*) ;;
  *) echo "MAHA_INTERCEPTOR_BASE must use HTTPS except for an explicit local-development host." >&2; exit 1 ;;
esac

body=$(node - "$BUNDLE_DIR/llm-proxy.template.json" <<'NODE'
const fs = require('node:fs')
const template = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'))
const read = (name) => {
  const value = process.env[name]
  if (!value) throw new Error(`${name} is required`)
  return value
}
template.metadata.name = read(template.metadata.nameFromEnv)
delete template.metadata.nameFromEnv
template.spec.provider.id = read(template.spec.provider.idFromEnv)
delete template.spec.provider.idFromEnv
template.spec.context = read(template.spec.contextFromEnv)
delete template.spec.contextFromEnv
for (const policy of template.spec.policies ?? []) {
  for (const route of policy.paths ?? []) {
    const params = route.params ?? {}
    if (params.endpointFromEnv) {
      params.endpoint = read(params.endpointFromEnv)
      delete params.endpointFromEnv
    }
  }
}
process.stdout.write(JSON.stringify(template))
NODE
)

status=$(curl --silent --show-error --output "$RESPONSE_FILE" --write-out '%{http_code}' \
  --user "$MANAGEMENT_AUTH" --request POST "${MANAGEMENT_API}/llm-proxies" \
  --header 'content-type: application/json' --data "$body")
if [[ "$status" -lt 200 || "$status" -ge 300 ]]; then
  echo "Install failed with HTTP ${status}. The installer does not replace an existing proxy; choose another WSO2_PROXY_NAME or remove the reviewed prior deployment explicitly." >&2
  exit 1
fi

deployed=$(curl --fail --silent --show-error --user "$MANAGEMENT_AUTH" \
  "${MANAGEMENT_API}/llm-proxies/${WSO2_PROXY_NAME}")
DEPLOYED_JSON="$deployed" node - "$WSO2_PROXY_NAME" "$WSO2_PROVIDER_ID" "$WSO2_PROXY_CONTEXT" "$MAHA_INTERCEPTOR_BASE" <<'NODE'
const [name, provider, context, endpoint] = process.argv.slice(2)
const document = JSON.parse(process.env.DEPLOYED_JSON)
const policy = document.spec?.policies?.find((entry) => entry.name === 'interceptor-service')
const route = policy?.paths?.find((entry) => entry.path === '/v1/chat/completions' && entry.methods?.includes('POST'))
const params = route?.params
const fail = (message) => { console.error(`Verification failed: ${message}`); process.exit(1) }
if (document.metadata?.name !== name) fail('proxy name differs')
if (document.spec?.provider?.id !== provider) fail('provider differs')
if (document.spec?.context !== context) fail('context differs')
if (policy?.version !== 'v1') fail('Interceptor Service must attach by major version v1')
if (params?.endpoint !== endpoint) fail('interceptor endpoint differs')
if (params?.request?.passthroughOnError !== false || params?.response?.passthroughOnError !== false) fail('policy is not fail closed')
if (params?.request?.includeRequestHeaders !== true || params?.request?.includeRequestBody !== true) fail('request envelope is incomplete')
if (params?.timeoutMillis !== 20000 || params?.tlsSkipVerify !== false) fail('timeout or TLS verification differs')
if (JSON.stringify(document).includes('WSO2_CONTEXT_INTERCEPTOR_SECRET')) fail('a credential placeholder persisted')
console.log(`Installed and verified ${name} at ${context}/v1/chat/completions`)
NODE

echo "Evaluation credential is not stored in the proxy. Supply x-maha-wso2-interceptor-token from the controlled evaluation client."

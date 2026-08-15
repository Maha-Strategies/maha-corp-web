#!/usr/bin/env bash
# Imports the three evaluation APIs into a running WSO2 AI Gateway 1.1.0.
#
# The definitions previously lived only in the gateway's runtime state and were
# lost when it stopped. This makes the comparator rebuildable, which is the
# difference between an evaluation and an anecdote.
#
# Reads the interceptor endpoint and credential from the environment. Neither is
# written to the repository: the endpoint changes per deployment, and the
# credential is a secret.
set -euo pipefail

CONTROLLER="${WSO2_CONTROLLER_API:-http://localhost:9090}"
: "${MAHA_INTERCEPTOR_ENDPOINT:?Set MAHA_INTERCEPTOR_ENDPOINT to the reachable Preview interceptor URL}"
: "${WSO2_CONTEXT_INTERCEPTOR_SECRET:?Set WSO2_CONTEXT_INTERCEPTOR_SECRET (never commit it)}"

for artifact in content/integrations/wso2-apis/*.json; do
  name=$(node -e "console.log(require('./$artifact').name)")
  echo "importing ${name} from ${artifact}"
  body=$(MAHA_INTERCEPTOR_ENDPOINT="$MAHA_INTERCEPTOR_ENDPOINT" node -e "
    const doc = require('./$artifact')
    for (const policy of doc.policies ?? []) {
      if (policy.endpointFromEnv) { policy.endpoint = process.env[policy.endpointFromEnv]; delete policy.endpointFromEnv }
      // The credential is supplied to the gateway out of band; it is never
      // interpolated into an artifact or logged here.
      if (policy.credentialFromEnv) { policy.credentialEnv = policy.credentialFromEnv; delete policy.credentialFromEnv }
    }
    console.log(JSON.stringify(doc))
  ")
  curl --fail --silent --show-error -X POST "${CONTROLLER}/api/v1/apis" \
    -H 'content-type: application/json' \
    --data "$body" > /dev/null
  echo "  imported ${name}"
done

echo "deploying"
curl --fail --silent --show-error -X POST "${CONTROLLER}/api/v1/deploy" > /dev/null
echo "all three APIs imported and deployed"

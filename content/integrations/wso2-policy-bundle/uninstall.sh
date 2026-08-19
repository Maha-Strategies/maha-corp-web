#!/usr/bin/env bash
set -euo pipefail

MANAGEMENT_API=${WSO2_MANAGEMENT_API:-http://localhost:9090/api/management/v0.9}
MANAGEMENT_AUTH=${WSO2_MANAGEMENT_AUTH:-admin:admin}
: "${WSO2_PROXY_NAME:=maha-context-compiler}"

if [[ "${1:-}" != "--confirm=${WSO2_PROXY_NAME}" ]]; then
  echo "Refusing deletion. Re-run with --confirm=${WSO2_PROXY_NAME}" >&2
  exit 1
fi

curl --fail --silent --show-error --user "$MANAGEMENT_AUTH" --request DELETE \
  "${MANAGEMENT_API}/llm-proxies/${WSO2_PROXY_NAME}" >/dev/null
echo "Removed ${WSO2_PROXY_NAME}. The provider and Maha service were not changed."

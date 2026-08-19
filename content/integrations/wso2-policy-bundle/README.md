# Maha Context Compiler policy bundle for WSO2

This bundle installs one `LlmProxy` on WSO2 AI Gateway 1.1.0 with Interceptor
Service v1.0.0 attached as major version `v1`. It is an evaluation bundle, not
a production-security claim.

## Install

Prerequisites: a running WSO2 AI Gateway 1.1.0, an existing LLM provider, Node,
curl, and a reachable Maha interceptor. Configure the same dedicated secret of
at least 32 characters at the Maha interceptor as
`WSO2_CONTEXT_INTERCEPTOR_SECRET`; do not put it in this bundle.

```bash
cd content/integrations/wso2-policy-bundle
export WSO2_PROVIDER_ID='your-existing-provider-id'
export MAHA_INTERCEPTOR_BASE='https://www.mahastrategies.com/api/integrations/wso2/context-compiler'

# Optional overrides:
export WSO2_MANAGEMENT_API='http://localhost:9090/api/management/v0.9'
export WSO2_MANAGEMENT_AUTH='admin:admin'
export WSO2_PROXY_NAME='maha-context-compiler'
export WSO2_PROXY_CONTEXT='/maha/context'

./install.sh
```

The installer creates rather than overwrites, then reads the deployed object
back and verifies the route, provider, endpoint, policy version, fail-closed
settings, timeout and TLS setting. It stores no provider or interceptor secret.

For this tested evaluation configuration, the controlled caller supplies:

```text
x-maha-wso2-interceptor-token: <dedicated evaluation secret>
```

Maha validates and removes that header before provider forwarding. Send only
requests containing one `{{MAHA_CONTEXT_PACK}}` marker and the documented
`maha_context` object. Requests without the extension pass through unchanged.

## Verify and remove

Run the repository's zero-cost contract and WSO2 policy tests before a pilot:

```bash
npm run test:wso2-failure-paths -- --wso2-source=/path/to/gateway-controllers
```

Remove only the named proxy; the command requires an exact confirmation:

```bash
./uninstall.sh --confirm="${WSO2_PROXY_NAME:-maha-context-compiler}"
```

## Security boundary

WSO2 1.1.0's Set Headers attachment produced `Policy chain not found for route`
in the observed environment, so this bundle does not package that known-bad
combination or pretend a static embedded secret is production-safe. Before
production use, replace caller-carried evaluation authentication with a
reviewed gateway secret reference, authenticated service identity, or mTLS,
then repeat the fail-closed, timeout, oversized-input and unavailable-service
tests in the deployed environment.

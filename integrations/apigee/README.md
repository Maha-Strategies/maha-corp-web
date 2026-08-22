# Apigee adapter

A shared flow that compiles context before the target LLM call. Attach it to
any proxy with a `FlowCallout`.

## Files

| File | Purpose |
| --- | --- |
| `sharedflowbundle/maha-context-compiler.xml` | Bundle manifest. |
| `sharedflowbundle/sharedflows/default.xml` | Prepare → callout → apply → fail-closed. |
| `sharedflowbundle/policies/SC-MahaCompile.xml` | ServiceCallout with explicit timeouts. |
| `sharedflowbundle/policies/JS-Maha{Prepare,Apply}.xml` | Decide, then apply. |
| `sharedflowbundle/policies/RF-MahaFailClosed.xml` | Refuses anything that did not compile. |
| `resources/jsc/maha-{prepare,apply}.js` | The logic. |

## Credentials

**No credential appears in any XML or JavaScript file in this bundle.** The
compiler URL and the secret are read at runtime from private KVM entries:

- `private.maha.compiler.url`
- `private.maha.interceptor.secret`

Populate them with a KeyValueMapOperations policy or the management API before
attaching the flow. The bundle will fail closed until they resolve, which is the
intended behaviour for an unconfigured environment.

## Deploy

```bash
apigeetool deploySharedflow \
  -o "$APIGEE_ORG" -e "$APIGEE_ENV" \
  -n maha-context-compiler \
  -d integrations/apigee
```

Or the management API:

```bash
zip -r sharedflow.zip sharedflowbundle resources
curl -X POST -H "Authorization: Bearer $TOKEN" \
  -F "file=@sharedflow.zip" \
  "https://apigee.googleapis.com/v1/organizations/$APIGEE_ORG/sharedflows?action=import&name=maha-context-compiler"
```

Neither command is run by this repository, and no credential is stored here.

## Attach

```xml
<FlowCallout name="FC-MahaContext">
  <SharedFlowBundle>maha-context-compiler</SharedFlowBundle>
</FlowCallout>
```

Place it in the target request preflow, before the LLM call.

## Fail-closed

The flow sets `maha.compile.ok` only on a usable compiled body or an explicit
passthrough. Any other state reaches `RF-MahaFailClosed` and the request is
refused. There is no branch that forwards an uncompiled prompt to the target.

# Maha Context & Evidence Check

Runs the Maha Context Compiler against repository-managed source documents and, when supplied, evaluates whether exact required evidence spans survive compilation.

The action never writes document text or compiled context to the GitHub job summary. Store the `context_compile` credential in GitHub Secrets for private Compiler mode. The action also has a credential-free public `preflight` mode for sanitized, non-sensitive passages.

```yaml
- uses: Maha-Strategies/maha-corp-web/.github/actions/maha-context-evidence@main
  with:
    credential: ${{ secrets.MAHA_CONTEXT_CREDENTIAL }}
    documents-file: .maha/context-documents.json
    required-evidence-file: .maha/required-evidence.json
    task: Prepare an approved security-context pack for the deployment agent.
    token-budget: '1800'
    fail-below-evidence-retention: '100'
```

`documents-file` accepts either a JSON array or `{ "documents": [...] }`. `required-evidence-file` accepts either a JSON array or `{ "requiredEvidence": [...] }`. Every required evidence item must name a supplied source document and include an exact span from that document.

## Public MPS preflight mode

This mode calls the public Maha MPS claim preflight and writes only an input hash and aggregate provenance-tag counts to the GitHub job summary. It is rate-limited and must not be used with confidential, personal, regulated, or otherwise sensitive material.

```yaml
- uses: Maha-Strategies/maha-corp-web/.github/actions/maha-context-evidence@main
  with:
    mode: preflight
    documents-file: .maha/context-documents.json # compatibility placeholder; unused
    task: Public claim preflight # compatibility placeholder; unused
    audit-passage-file: docs/sanitized-public-draft.txt
```

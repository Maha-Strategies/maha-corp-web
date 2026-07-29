# Maha Context & Evidence Check

Runs the Maha Context Compiler against repository-managed source documents and, when supplied, evaluates whether exact required evidence spans survive compilation.

The action never writes document text or compiled context to the GitHub job summary. Store the `context_compile` credential in GitHub Secrets.

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

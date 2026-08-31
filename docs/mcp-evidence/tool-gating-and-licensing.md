# MCP evidence tool gating and quota licensing

Status: implemented, private-by-discovery, migration not yet applied by this change.

## Runtime order

Every `evidence.retrieve_released_record` call is evaluated in this order:

1. Parse a bounded JSON-RPC request (16 KB maximum).
2. Authenticate an active client credential.
3. Require the exact `mcp_evidence_retrieval` capability and credential rate limit.
4. Resolve one active canonical release by release ID or canonical path.
5. Atomically require an active license grant, exact plan terms and remaining UTC-month quota.
6. Reserve one unit against the credential, request hash, tool, release ID and release digest.
7. Compile a privacy-safe projection containing released claims, sources, exact locators, sections, bridges, limitations, prohibited inferences and sanitized release provenance.
8. Append a completion event containing only the output digest, or a failure event that releases the unsuccessful reservation from quota accounting.
9. Record privacy-preserving daily aggregate commercial usage.

No tool argument accepts credentials, payment authority, release authority, deployment authority, source text, or publication instructions.

## License boundary

A license grant changes machine access and quota only. It cannot:

- publish a draft;
- retrieve a superseded or withdrawn release;
- make a source content-inspected;
- upgrade internal review to expert review;
- alter evidence maturity or uncertainty;
- remove limitations or prohibited inferences;
- convey third-party publication copyright;
- prove that a contract was signed or payment was received.

The grant snapshot records internal evaluation separately from externally contracted access. Internal grants must carry `$0 contracted` and `$0 received`. Commercial grants preserve contracted and received amounts as separate fields.

## Release protocol

The endpoint remains absent from `mcp.json` and `llms.txt` until all of the following are complete in an isolated Preview environment:

- migration convergence;
- an evidence-capable Preview credential;
- an internal-canary grant with no claimed revenue;
- successful retrieval of one active release;
- byte-identical replay;
- blocked selector substitution;
- blocked unreleased, superseded and withdrawn selectors;
- quota exhaustion and revoked-grant checks;
- served-bundle inspection proving no credentials, audit corpus or private reviewer material is exposed.

Run the bounded remote canary with secrets supplied only through protected environment variables:

```bash
npm run canary:mcp-evidence:private
```

The script prints only a credential fingerprint, release and execution identifiers, output digest and pass/block outcomes. It never prints the credential.

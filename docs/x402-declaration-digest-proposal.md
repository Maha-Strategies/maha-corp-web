# Proposal: declaration-integrity extension for x402 discovery catalogs

Status: draft for ecosystem review. This is not yet an x402 standard and is not advertised by Maha's production seller contract.

## Problem

In x402 v2, a seller declares Bazaar discovery metadata in its payment requirements. A catalog normally receives that declaration during settlement and indexes it asynchronously. The resource server may receive an `EXTENSION-RESPONSES` status such as `processing` or `rejected`, but `processing` does not prove that the new record became searchable, and an absent response does not identify which catalog version is live.

Today a diagnostic tool can fetch the live challenge and a catalog record, normalize the fields it recognizes, and compare them. That is useful but inherently heuristic: catalogs can flatten, omit, or enrich fields, and two implementations may normalize the same declaration differently.

## Proposed extension

The seller adds one optional extension to the live x402 declaration:

```json
{
  "extensions": {
    "declaration-integrity": {
      "declarationDigest": "sha256:1af4817702a2648b6a4db4cc5323562a453818110bbd9dc3996ece5c948a3556",
      "metadataVersion": "2026-08-09",
      "canonicalResource": "https://example.com/api/resource"
    }
  }
}
```

`declarationDigest` is authoritative. `metadataVersion` is a human-readable seller revision and may include a deployment suffix, such as `2026-08-09.2`; changing it alone is not proof that metadata changed. `canonicalResource` prevents catalog aliases or templated paths from being compared to the wrong live endpoint.

The schema and deterministic vectors are published at:

- `/conformance/x402-v2/declaration-integrity.schema.json`
- `/conformance/x402-v2/declaration-integrity-vectors.json`

## Digest input

The digest input is this JSON object:

```json
{
  "x402Version": 2,
  "resource": { "...": "the complete ResourceInfo object" },
  "accepts": ["the complete ordered PaymentRequirements array"],
  "extensions": { "...": "every advertised extension except declaration-integrity" }
}
```

Rules:

1. Remove only `extensions.declaration-integrity` to avoid a recursive hash.
2. Preserve array order. Requirement order can influence client selection.
3. Preserve all remaining values exactly. A tool must not lowercase addresses, rewrite descriptions, discard unknown extension fields, or coerce amounts.
4. Serialize using RFC 8785 JSON Canonicalization Scheme semantics: object keys sorted lexicographically, minimal JSON number serialization, and no insignificant whitespace.
5. Hash the UTF-8 bytes with SHA-256 and encode lowercase hexadecimal as `sha256:<64 hex characters>`.
6. Reject non-JSON values, duplicate object keys at parse time, and non-finite numbers.
7. Normalize `canonicalResource` independently with the URL parser: HTTPS only, no fragment, and standard URL serialization. The declaration's `resource.url` remains part of the digest exactly as declared.

The canonicalization input deliberately includes payment requirements. A price, token, network, payee, timeout, schema, example, or semantic-description change therefore produces a new digest.

## Catalog behavior

A catalog supporting the extension should:

1. parse and validate the extension;
2. independently recompute the digest from the declaration it accepted;
3. reject or flag the declaration if the seller's digest does not match;
4. store the independently computed digest with the indexed record; and
5. expose that value in discovery responses using the same three-field object under `declarationIntegrity`.

The catalog must not merely echo the seller-provided digest. An echo proves only that a string was received; it does not prove which metadata was validated or indexed.

Example catalog response fragment:

```json
{
  "resource": "https://example.com/api/resource",
  "lastUpdated": "2026-08-09T10:30:00Z",
  "declarationIntegrity": {
    "declarationDigest": "sha256:1af4817702a2648b6a4db4cc5323562a453818110bbd9dc3996ece5c948a3556",
    "metadataVersion": "2026-08-09",
    "canonicalResource": "https://example.com/api/resource"
  }
}
```

`EXTENSION-RESPONSES` can optionally return the computed digest immediately:

```json
{
  "declaration-integrity": {
    "status": "processing",
    "declaredDigest": "sha256:1af4817702a2648b6a4db4cc5323562a453818110bbd9dc3996ece5c948a3556",
    "computedDigest": "sha256:1af4817702a2648b6a4db4cc5323562a453818110bbd9dc3996ece5c948a3556"
  }
}
```

This acknowledges validation but still does not claim that asynchronous search indexing has completed. The discovery record is the eventual source of truth.

## Diagnostic behavior

An integrity-aware diagnostic performs three distinct checks:

- **seller consistency:** independently computed live digest equals the digest declared by the seller;
- **catalog freshness:** catalog-computed indexed digest equals the independently computed live digest; and
- **resource identity:** both sides name the same canonical resource.

If the catalog does not expose `declarationIntegrity`, diagnostics may retain field reconstruction as a legacy fallback, but should label the result as reconstructed rather than catalog-attested.

## Compatibility and security

The extension is optional. Existing clients and catalogs ignore unknown extension keys. It does not authenticate a seller or catalog, replace TLS, prove settlement, or prove search visibility. It only gives two parties a stable identifier for the exact declaration each observed.

SHA-256 collision resistance is sufficient for change detection, but the digest is not a signature. A later extension could sign the digest if authenticated publisher identity becomes a requirement; that is deliberately outside this proposal.

## Open questions for maintainers

1. Should the extension be generic (`declaration-integrity`) or scoped to Bazaar?
2. Should catalogs expose it at top level, inside their existing extension record, or both?
3. Should `metadataVersion` remain free seller metadata or be omitted from the minimal standard?
4. Should URL normalization use the exact `resource.url` or a catalog-normalized route template for high-cardinality paths?
5. Should a digest mismatch reject settlement metadata only, or reject the entire payment operation?

The smallest interoperable first version needs only the canonicalization rules, seller extension, independently computed catalog digest, and deterministic vectors. It does not require a new registry or payment flow.

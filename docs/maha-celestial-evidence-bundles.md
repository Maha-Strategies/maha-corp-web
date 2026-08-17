# Maha Celestial Evidence Bundles

`maha-celestial-evidence/0.1` is the portable audit artifact attached to a Maha Celestial consumer report. It certifies the artifact's calculation and provenance chain. It does not certify astrological prediction.

## Product boundary

Maha Celestial is a separate public vertical from Maha Strategies' enterprise AI Gateway and technical decision methodology. Code for canonicalization, hashing, and operational deployment may be shared internally; product claims and navigation are not.

## Bundle layers

The canonical JSON keeps six categories explicit:

1. `astronomicalFacts`: the complete locally computed celestial fact bundle, observer, coordinate contract, precision, software version, and per-fact digest.
2. `calculationConventions`: natal-chart, timing, pañcāṅga, compiler, and tradition-registry versions plus declared methodologies.
3. `chartGeometry`: the computed pañcāṅga, natal chart, houses, aspects, daśā periods, and transit geometry.
4. `interpretations`: separately named traditions, applicable rules, source passages, disagreements, refusals, and withheld rules.
5. `exploratoryAnalysis`: optional historical calibration with its retrospective, non-predictive boundary intact.
6. `boundaries`: empirical status, non-claims, and prohibited uses.
7. `integrity` and `proof`: RFC 8785 canonical digest and an optional detached ES256K issuer signature.

The report input form uses POST and does not persist birth inputs or Evidence Bundles. The downloaded artifact necessarily contains the resolved UTC instant and observer coordinates needed to reproduce the chart. Customers should treat it as sensitive personal data and share it deliberately.

## Signing

Production signing uses a dedicated 32-byte secp256k1 private key supplied only through:

```text
MAHA_CELESTIAL_EVIDENCE_PRIVATE_KEY
```

The key must never appear in source, logs, build output, workflow artifacts, or a downloaded bundle. The bundle carries only the compressed public key, key identifier, and detached JWS. When the variable is absent, generation remains available but emits `proof: null`; the UI labels the artifact “Digest only · unsigned.” It must never represent that state as issuer-certified.

The verifier reports four distinct outcomes:

- `invalid`: canonical content, digest, structure, or signature failed.
- `digest-valid`: content is unchanged, but no issuer signature exists.
- `signature-valid`: the embedded signature is valid, but its key is not the currently configured issuer key.
- `issuer-verified`: digest, signature, and current Maha Celestial issuer key all match.

Issuer verification proves who signed unchanged content. It does not prove that an interpretation is scientifically valid or predictive.

## Public surfaces

- `/celestial`: isolated Maha Celestial product landing page.
- `/celestial/birth`: consumer report with Evidence Bundle download.
- `/celestial/verify`: upload-and-verify interface.
- `POST /api/v1/celestial/evidence/verify`: no-store verifier used by the interface, limited to 2 MB.

The verification endpoint is intentionally absent from the Maha Strategies enterprise OpenAPI document. A future commercial Maha Celestial API should publish a separate contract and credentials rather than blending verticals.

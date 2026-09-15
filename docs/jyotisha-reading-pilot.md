# Jyotiṣa interpretation API pilot

Local implementation: `POST /api/v1/interpretations/jyotisha`.
Profile: `varahamihira-iyer-lahiri/0.1`.

The implementation reuses the existing interpretation compiler, local celestial
fact provider, chart calculations, and passage registry. It introduces no new
source acceptance or practitioner review. No build, deployment, payment offer,
or Bazaar registration is part of this change.

## Request

```json
{
  "profile": "varahamihira-iyer-lahiri/0.1",
  "birthTimeUncertaintyMinutes": 0,
  "calculation": {
    "dataClass": "synthetic",
    "instantUtc": "2000-01-01T12:00:00.000Z",
    "latitudeDegrees": 0,
    "longitudeDegrees": 0
  }
}
```

The private route defaults to 404. A server-configured
`MAHA_JYOTISHA_PILOT_TOKEN` of at least 32 characters enables authenticated
requests with a Bearer header. No token is provisioned by this change.
Requests are limited to 2 KiB, require public or synthetic calculation inputs,
and accept no caller-supplied review authority. Responses use `no-store`.
The service does not persist request or response bodies.

## What works

- A single named source profile, with the historical translation distinguished
  from Maha's modern Lahiri/whole-sign/mean-node calculation conventions.
- Deterministic structured modules and a readable report with exact source
  locators, edition identity, rights metadata, passage digests and chart factors.
- Two separately calculated Musala occupancy readings from the existing
  Bṛhat Jātaka XII.2 and note (a) registry passages. These remain pending review,
  and do not contribute a personal prediction to the report.
- Earliest, nominal and latest time calculations for a caller-declared interval
  up to ±120 minutes. Ascendant, Moon nakshatra, planetary houses and Musala
  matches are compared. Sampling does not prove interval stability; all
  interpretive modules are withheld when the interval is nonzero.
- An integrity receipt covering the entire response and a verifier that
  recomputes against the original request, catching a rewritten response even
  if someone recomputes its self-declared digest.

## Coverage and remaining work

Current natal output is limited to the compiler's existing calendar-structure
module. This is an API foundation, not a complete natal reading product.
The source-bound expansion retains its practitioner-review requirements.
The 1885 Iyer edition identity and Public Domain Mark were reconfirmed at
https://wellcomecollection.org/works/afmgm695 during this task; its passage
transcriptions are inherited from the existing registry, not newly reinspected.

Timing calculations are available through `/api/v1/calculations/vimshottari`,
but interpretation remains unavailable: the recorded daśā passage has unresolved
conventions. Its period system must be established before connecting it to
Vimshottari output. This version does not blend different schools.

Before commercial activation: review the source and rule packets, implement
additional accepted chart predicates, establish a real interval transition
solver, add service-level rate limiting, measure cost, and choose a price.
The current report must not be sold as a complete natal or timing reading.

Tests: `node --experimental-strip-types --test test/jyotisha-reading.test.ts test/interpretation-compiler.test.ts`.

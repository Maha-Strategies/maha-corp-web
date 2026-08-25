# Quantum bridge namespace correction

Status: authoritative correction  
Date: 2026-08-25  
Applies to: Q-BR-001 through Q-BR-012

The first quantum-bridge audit incorrectly reported four endpoint references as
`unresolved-domain`. That result came from an incomplete, locally assembled
corpus and was a resolver defect—not a fact about the Maha corpus.

The corrected namespace-aware resolver establishes that:

- `mathematics` exists as a pilot-only domain with four records in
  `EPISTEMIC_PHASE4_PILOT_ENTRIES`;
- `neuromorphic-biocomputing` exists as a pilot-only domain with four records in
  the same corpus;
- submitted references to `semiconductor-manufacturing` normalize through the
  explicit, versioned alias to the corpus domain ID `semiconductor`, which has
  four pilot-only records.

None of these domains is absent. Pilot-only records are not canonical graph
records and carry source blockers, so they return `incompatible-record-class`
when directly matched; they are never silently treated as canonical endpoints.

After the correction, the 24 submitted bridge endpoints resolve as follows:

- exact or declared-alias resolution: 1;
- unresolved record: 23;
- unresolved domain: 0.

The correction therefore changes the accuracy of the diagnosis, not the release
decision. The referenced records themselves still do not exist in compatible
canonical form. Q-BR-001 through Q-BR-012 remain `BLOCK`, noncanonical, noindex,
and ineligible for public projection. Missing passage locators remain a blocker
for every bridge.

This note supersedes any earlier commit narrative or report claiming that the
four domains were absent. The submitted references and the erroneous historical
diagnosis remain preserved in append-only history; current resolution must use
`lib/epistemic-reference-resolver.ts` and the generated quantum bridge gap
report.

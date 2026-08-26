# Substantial page quality gate

`maha-substantial-page/0.1` is a second, fail-closed contract for turning a canonical epistemic record into a useful public explanation. It does not replace `maha-epistemic/1.0`, approve a record, or make search-performance promises.

The epistemic publication gate asks whether the underlying claims, sources, rights, locators, boundaries, and reviews are eligible for publication. The substantial-page gate asks whether the proposed page helps a defined reader understand that eligible record without losing those boundaries.

## Required coverage

- A direct answer linked to the record's claim and source graph.
- At least three source-bound explanatory sections and two substantive paragraphs per section.
- An explicit comparison section, or a reason comparison is not applicable.
- An explicit reproducible calculation section, or a reason calculation is not applicable.
- Every record boundary and prohibited inference rendered as a limitation.
- At least three resolved related-record links with typed relationships.
- A search-intent contract containing the reader's question, audience, outcome, supporting questions, and query variants.
- A statement of Maha's original contribution that distinguishes synthesis from source claims.
- An explicit statement that page quality does not guarantee impressions, rankings, traffic, or commercial outcomes.

## What the gate does not measure

The gate does not use word count as a proxy for usefulness, predict impressions, certify scientific truth, or reward repeated prose. Its measures are diagnostic counts. Its verdict is binary and its blocker codes are explicit.

Comparison and calculation are not mandatory when they would be artificial. They may be marked `not-applicable`, but the rationale must be recorded and their content fields must remain empty. This prevents both silent omissions and invented mathematical dressing.

The page contract binds to `epistemicReviewTargetHash(record)`. Any change to the record's claims, sources, sections, bridges, boundaries, or prohibited inferences makes the page stale and requires recompilation.

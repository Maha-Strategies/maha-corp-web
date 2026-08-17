# Celestial forecasting Phase 2

Phase 2 treats coordinate systems as competing, inspectable models. Tropical, Lahiri sidereal, and any later ayanamsha retain separate feature bundles, versions, probabilities, and scores. The system never silently averages interpretations after observing an outcome.

The first implementation supplies:

- reproducible reference-frame manifests;
- temporal historical splits based on when an outcome became available;
- leakage checks that prohibit training beyond forecast issuance;
- fixed, pre-declared ensemble weights;
- Brier score, log loss, and Brier skill against a non-celestial baseline;
- a digest over the complete forecast protocol.

Historical correspondences remain exploratory. They may generate hypotheses and fit model weights using training and validation partitions, but only untouched test partitions and prospective forecasts may support performance claims.

This version does not calculate planetary positions, ingest third-party datasets, fit weights, persist forecasts, or claim predictive validity. Those are subsequent slices built on this scoring contract.

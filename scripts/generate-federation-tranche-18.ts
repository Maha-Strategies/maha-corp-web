/**
 * Tranche 18 — configuration only.
 *
 * Reviews the 32 definitions added in candidate map v3. They are the
 * prerequisites that 94 dependency records across Tranches 13-17 were blocked
 * on, and they existed nowhere until v3 supplied them.
 *
 * This is the first tranche to read v3. Tranches 13-17 continue to read v2, so
 * their cohorts and digests are untouched: re-running them against a larger map
 * would reshuffle five completed reviews to no purpose.
 *
 * Every candidate here is a definition on the property that owns its concept,
 * so dependency resolution is `live` throughout. What bounds the outcome is
 * source inspection, exactly as everywhere else — a definition still needs an
 * inspected source, which is the limit the corrected contract states.
 */
import { runTranche, type Inspection } from '../lib/federation/tranche-runner.ts'

const FRESH: Inspection[] = []

runTranche({
  n: '18',
  prev: '17',
  frozenOn: '2026-09-06',
  mapVersion: 'v3',
  priorCohorts: ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11-mythology', '12-mythology', '13', '14', '15', '16', '17'],
  freshInspections: FRESH,
  soughtButNotInspected: [],
  situationNote:
    'The 32 definitions added in map v3. All are canonical-owner routes on maha-research, so none depends on ' +
    'another definition. Evidence-ready is bounded by source inspection alone.',
})

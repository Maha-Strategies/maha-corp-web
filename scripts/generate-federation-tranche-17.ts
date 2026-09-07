/**
 * Tranche 17 — configuration only. The final tranche.
 *
 * 28 candidates remain, and no site::topic group exceeds the four-page cap, so
 * this cohort takes all of them and the frozen map is fully reviewed at 1,628.
 * The cohort is 28 rather than 100 because that is what is left, not because
 * selection stopped early.
 *
 * The review policy lives in lib/federation/tranche-runner.ts.
 */
import { runTranche, type Inspection } from '../lib/federation/tranche-runner.ts'

const FRESH: Inspection[] = []


runTranche({
  n: '17',
  prev: '16',
  frozenOn: '2026-09-06',
  priorCohorts: ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11-mythology', '12-mythology', '13', '14', '15', '16'],
  freshInspections: FRESH,
  soughtButNotInspected: [],
  situationNote:
    'The final tranche. 28 candidates remained and all were selected, exhausting the frozen map at 1,628 reviewed ' +
    'candidates. No prerequisite blocking Tranche 16 exists in the pool, because there is no pool left.',
})

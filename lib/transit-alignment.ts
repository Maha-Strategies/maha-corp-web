export type TransitPhase = {
  id: string
  planet: 'Jupiter' | 'Saturn' | 'Rahu'
  sign: string
  house: number
  startsOn: string
  endsOn: string
  title: string
  operatingTheme: string
  focus: string[]
  protect: string[]
}

export type Operation = {
  id: string
  name: string
  description: string
  bestIn: string[]
  prepareIn: string[]
  avoidIn: string[]
}

// Lahiri sidereal operating calendar for a Cancer ascendant. This is intentionally
// a transparent, reviewable planning input—not a prediction engine or a substitute
// for customer evidence, cash flow, legal review, or professional judgment.
export const TRANSIT_PHASES: TransitPhase[] = [
  {
    id: 'jupiter-cancer-2026', planet: 'Jupiter', sign: 'Cancer', house: 1,
    startsOn: '2026-06-02', endsOn: '2026-10-30', title: 'Identity, method, and authority',
    operatingTheme: 'Choose the category, articulate the method, and let the work become recognizable.',
    focus: ['Name the commercial category: evidence assurance, not generic consulting.', 'Publish proof of the method and complete a small number of credible pilot engagements.', 'Clarify the offer ladder and the buyer it is for.'],
    protect: ['Do not expand the catalogue just because you can build it.', 'Avoid using attention or activity as a proxy for demand.'],
  },
  {
    id: 'jupiter-leo-2026', planet: 'Jupiter', sign: 'Leo', house: 2,
    startsOn: '2026-10-31', endsOn: '2027-01-24', title: 'First revenue test',
    operatingTheme: 'Put the chosen identity into prices, terms, and a measurable sales path.',
    focus: ['Sell the validated audit outcome, not open-ended expertise.', 'Test scope, price, deposits, and turnaround with real buyers.', 'Track inquiry-to-paid conversion and contribution margin by offer.'],
    protect: ['Do not discount away the accountability that makes the work defensible.', 'Do not scale delivery before a repeatable scope exists.'],
  },
  {
    id: 'jupiter-cancer-2027', planet: 'Jupiter', sign: 'Cancer', house: 1,
    startsOn: '2027-01-25', endsOn: '2027-06-25', title: 'Refine the operating identity',
    operatingTheme: 'Return to the method: tighten positioning, delivery, proof, and the boundaries of the offer.',
    focus: ['Use buyer feedback to simplify the audit package.', 'Turn completed work into an anonymized proof artifact and case-study system.', 'Remove features and adjacent services that distract from the revenue engine.'],
    protect: ['Do not interpret a revision cycle as failure.', 'Avoid changing the buyer and offer at the same time.'],
  },
  {
    id: 'jupiter-leo-2027', planet: 'Jupiter', sign: 'Leo', house: 2,
    startsOn: '2027-06-26', endsOn: '2027-11-26', title: 'Scale the proven offer',
    operatingTheme: 'Increase revenue quality through repeatable packages, stronger terms, and a narrow expansion.',
    focus: ['Raise or standardize pricing from evidence, not hope.', 'Offer team workflows or API access only where repeated demand is visible.', 'Build a cash reserve and a light delivery system around the proven audit.'],
    protect: ['Do not turn a bespoke service into software before its repeating workflow is visible.', 'Avoid adding new product lines that lack a specific buyer signal.'],
  },
]

export const BACKGROUND_TRANSITS: TransitPhase[] = [
  {
    id: 'saturn-pisces-2026', planet: 'Saturn', sign: 'Pisces', house: 9,
    startsOn: '2026-02-13', endsOn: '2027-06-02', title: 'Institutional rigor',
    operatingTheme: 'Build doctrine, documentation, and standards that can survive scrutiny.',
    focus: ['Document the method.', 'Set clear exclusions and operating boundaries.'],
    protect: ['Do not make credibility claims that exceed the public record.'],
  },
  {
    id: 'rahu-aquarius-2026', planet: 'Rahu', sign: 'Aquarius', house: 8,
    startsOn: '2025-05-18', endsOn: '2026-12-04', title: 'Complexity and hidden risk',
    operatingTheme: 'Use research depth carefully; surface operational, privacy, and financial risk before it becomes expensive.',
    focus: ['Keep a risk register for payments, data handling, and delivery dependencies.'],
    protect: ['Avoid opaque partnerships or unclear shared-money arrangements.'],
  },
]

export const OPERATIONS: Operation[] = [
  { id: 'positioning', name: 'Choose positioning or rewrite the core offer', description: 'Name the category, buyer, problem, and proof standard.', bestIn: ['jupiter-cancer-2026', 'jupiter-cancer-2027'], prepareIn: [], avoidIn: [] },
  { id: 'pilot', name: 'Run a paid pilot or human Evidence Audit', description: 'Deliver one bounded, accountable outcome for a real buyer.', bestIn: ['jupiter-cancer-2026', 'jupiter-leo-2026'], prepareIn: ['jupiter-cancer-2027'], avoidIn: [] },
  { id: 'price', name: 'Set price, deposits, and commercial terms', description: 'Turn proven work into a clear purchase decision and protect margin.', bestIn: ['jupiter-leo-2026', 'jupiter-leo-2027'], prepareIn: ['jupiter-cancer-2026', 'jupiter-cancer-2027'], avoidIn: [] },
  { id: 'scale', name: 'Expand delivery, API access, or team workflow', description: 'Increase capacity only after repeated customer demand is observable.', bestIn: ['jupiter-leo-2027'], prepareIn: ['jupiter-leo-2026', 'jupiter-cancer-2027'], avoidIn: ['jupiter-cancer-2026'] },
  { id: 'partnership', name: 'Enter a partnership or distribution agreement', description: 'Use another organization’s distribution while preserving clear scope and accountability.', bestIn: ['jupiter-leo-2027'], prepareIn: ['jupiter-leo-2026'], avoidIn: ['jupiter-cancer-2026'] },
  { id: 'lab', name: 'Start a new app, book, or experimental lab', description: 'Develop a new intellectual or product branch outside the core revenue engine.', bestIn: [], prepareIn: ['jupiter-cancer-2027'], avoidIn: ['jupiter-cancer-2026', 'jupiter-leo-2026', 'jupiter-leo-2027'] },
]

function dateNumber(value: string) { return new Date(`${value}T00:00:00Z`).getTime() }

export function currentJupiterPhase(date = new Date()) {
  const at = date.getTime()
  return TRANSIT_PHASES.find((phase) => at >= dateNumber(phase.startsOn) && at <= dateNumber(phase.endsOn)) ?? TRANSIT_PHASES[0]
}

export function formatDate(value: string) {
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${value}T00:00:00Z`))
}


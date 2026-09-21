/**
 * The Caldera: a concept for a future Maha Strategies headquarters.
 *
 * Everything here is drawn from two internal documents — the owner's project
 * brief and the executive prospectus, both dated 19 September 2026 and both
 * marked concept-only. Nothing else from that working package belongs on a
 * public page: the consultant RFP drafts are unissued, and the capital stack,
 * spending allowances and revenue aspirations are internal planning figures,
 * not results. They are deliberately not restated here.
 *
 * The source package instructs that any public presentation carry the label
 * below until site, funding, approvals and schedule are established. That is
 * the reason this page exists in this shape rather than as a promotional one.
 */

export const CALDERA_PATH = '/caldera'
export const CALDERA_STATUS_LABEL =
  'Concept vision; site, funding, approvals and schedule not established.'
export const CALDERA_PREPARED = '19 September 2026'

/** The four strata, as the owner's brief names them. */
export type Stratum = {
  name: string
  concept: string
  intent: string
  /** What the brief explicitly reserves for a future architect. */
  reserved: string
}

export const CALDERA_STRATA: Stratum[] = [
  {
    name: 'Public Threshold',
    concept: 'Floors 1–4',
    intent:
      'An atrium, a library and reading room, exhibitions of art and mathematics, and a relationship with the waterfront. The public part of the building is the part the concept treats as its reason to exist.',
    reserved:
      'Visitor numbers, collection size, event capacity, public access hours, the operator, the security boundary, accessibility obligations and the operating subsidy that would keep it open.',
  },
  {
    name: 'Mantle',
    concept: 'Floors 5–16',
    intent:
      'Engineering, verification laboratories, formal-methods research and protocol operations — the working core of the company.',
    reserved:
      'Headcount, equipment, work patterns, security zoning, and power and cooling requirements. None of these is known.',
  },
  {
    name: 'Summit Ring',
    concept: 'Floors 17–25',
    intent:
      'Maha OS and cognitive research, deep-work space and attention restoration.',
    reserved:
      'What the research actually is. Until that is defined, no laboratory classification, instrumentation or privacy requirement can be settled, and none is assumed.',
  },
  {
    name: 'Caldera Crown',
    concept: 'Floor 26 and roof',
    intent:
      'A recessed, planted summit: a garden, a walking labyrinth, and a place for astronomical observation.',
    reserved:
      'Occupancy, public versus private access, weather use, planting conditions, telescope needs and maintenance access.',
  },
]

/**
 * The authored scale study. These are inputs to a model someone wrote down,
 * not dimensions measured from a drawing and not an approved schedule.
 */
export const CALDERA_SCALE = {
  aboveGradeGsf: 551_000,
  publicStrataGsf: 156_000,
  optionalBelowGradeGsf: 25_000,
  lotSearchFilterAcres: 3,
  caveat:
    'A first authored scale study, offered as something testable. It is not a demonstrated occupancy requirement, a professional design, or a quantity taken off a drawing. A future architect may well recommend something smaller, or phased.',
} as const

/**
 * Words in the source material that sound like claims and are not. Each is
 * corrected here rather than quietly dropped, because the correction is the
 * useful part.
 */
export type Clarification = { term: string; reading: string }

export const CALDERA_CLARIFICATIONS: Clarification[] = [
  {
    term: '“Self-sovereign”',
    reading:
      'Describes a desired degree of operational control and resilience. It does not mean off-grid energy, legal autonomy, or immunity from public obligations.',
  },
  {
    term: '“Hyperboloid”, “parabolic”, “stratovolcano”',
    reading:
      'Aesthetic references, not interchangeable geometric specifications. A future architect would have to define one coherent, dimensioned geometry; the rendering and the prose do not already agree on one.',
  },
  {
    term: '“Biological defense labs”',
    reading:
      'Does not describe an actual scientific programme. No wet laboratory, containment facility, clinical work or biosafety level should be inferred. The research would have to be defined before any building system or permitting path followed from it.',
  },
  {
    term: 'Low-electromagnetic spaces',
    reading:
      'Expresses a desired working environment. No health or performance benefit is established by the concept.',
  },
  {
    term: 'A 2035–2036 opening',
    reading:
      'The founder’s aspiration, not a forecast. No feasible delivery date has been established, and none can be until there is a site and a funded study.',
  },
]

/** Questions a professional would have to answer. Not findings. */
export const CALDERA_OPEN_QUESTIONS: string[] = [
  'Structure and foundations, against a real site’s ground conditions, wind environment and construction access. A flared base does not by itself demonstrate acceptable wind performance.',
  'The facade: curved glass against faceted alternatives that keep the silhouette, modelled for heat gain, glare, condensation, comfort, daylight, embodied carbon and replacement cost.',
  'The atrium: how deep usable daylight actually reaches, and how a luminous vertical core coexists with protected escape routes, smoke management and secure circulation.',
  'Waterfront resilience: flood exposure and required elevations. Below-grade critical equipment is an unresolved risk in this concept, not a settled feature of it.',
  'Ventilation and energy, including what “energy sovereignty” is meant to mean — efficiency, resilience, an annual energy balance, or off-grid operation. Those are four different objectives with four different costs.',
  'The crown: wind comfort, garden loads, drainage, horticulture, and safe operation in bad weather.',
  'The observatory: whether it is for education or for research-grade astronomy, and then light pollution, vibration, heat plumes and sightlines.',
  'Daily operation: public access alongside secure research, deliveries, waste, emergency access, facade cleaning, accessibility and long-term staffing.',
]

/** What has not happened. The list is the point. */
export const CALDERA_NOT_ESTABLISHED: string[] = [
  'No site has been selected, and no land is owned or optioned.',
  'No architect, engineer or development adviser has been appointed.',
  'No budget, financing or construction has been approved.',
  'No land-use approval has been sought or granted.',
  'No delivery date has been established.',
  'No third party has been solicited, and nothing here is an offering of securities, a financing commitment or a technical certification.',
]

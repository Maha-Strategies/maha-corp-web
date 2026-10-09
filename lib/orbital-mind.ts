/** Curated paraphrases of the supplied manuscripts, not clinical or astrological rules. */
export const ORBITAL_LENSES = [
  { id: 'action-constraint', title: 'Wanting to act, holding back', planets: 'Mars–Saturn', functions: 'Action & constraint',
    needs: ['Movement toward something that matters.', 'A manageable scope and protection against avoidable consequences.'],
    account: 'The book describes a deadlock between mobilization and consequence-assessment. Its proposed response is to reduce the unit of action while keeping a containing boundary.',
    question: 'What do you want to begin, and what would make beginning feel manageable?',
    experiment: 'Choose one small task. Give it a 20-minute window and a clear stopping point. Notice what you produced, even if the tension did not disappear.', locator: 'Chapter XI, §2.1 and §IV', pages: '196–198, 207–208' },
  { id: 'expansion-structure', title: 'Big ambitions, little follow-through', planets: 'Jupiter–Saturn', functions: 'Expansion & structure',
    needs: ['Room for an idea that feels worthwhile.', 'Time and a realistic structure to make something concrete.'],
    account: 'The book proposes sequencing vision and execution: allow bounded exploration, then build supporting competence through sustained work. Neither unchecked expansion nor rigid constraint is the goal.',
    question: 'Which idea deserves a concrete first version, and what can you realistically finish?',
    experiment: 'Write the vision briefly, then define the smallest deliverable you can finish this week. Complete that version before expanding its scope.', locator: 'Chapter XI, §2.2 and §IV', pages: '198–200, 208' },
  { id: 'change-structure', title: 'Reliable routines, no room for change', planets: 'Uranus–Saturn', functions: 'Change & structure',
    needs: ['A legitimate opportunity to explore something different.', 'Reliable commitments that keep daily life workable.'],
    account: 'The book proposes a protected channel for change within a dependable structure, rather than suppressing novelty or dismantling the whole structure.',
    question: 'What change would you like to explore without abandoning the commitments you value?',
    experiment: 'Design one bounded experiment with a time limit and a clear commitment to protect. Afterwards, decide what to keep, adjust or stop.', locator: 'Chapter XI, §2.3', pages: '200–202' },
  { id: 'imagination-articulation', title: 'A vivid vision, hard to put into words', planets: 'Neptune–Mercury', functions: 'Imagination & articulation',
    needs: ['Space for images and ideas before they are tidy.', 'A separate opportunity to explain and sequence them clearly.'],
    account: 'The book describes interference between generative and precise processes and proposes alternating them. The companion paper treats this as a proposed scheduling motif, not an established psychological mechanism.',
    question: 'What are you trying to express, and which part needs exploration before planning?',
    experiment: 'Spend a short session freely writing or sketching. In a separate session, turn one idea into three plain sentences and one next step.', locator: 'Chapter XI, §2.4', pages: '202–204' },
  { id: 'output-replenishment', title: 'Always producing, rarely replenished', planets: 'Sun–Moon', functions: 'Output & replenishment',
    needs: ['Purpose and the ability to contribute.', 'Time to receive, rest and enjoy something without producing an output.'],
    account: 'The book distinguishes stopping work from genuinely receiving replenishment. It proposes protecting a space where output and monitoring are set aside.',
    question: 'What are you continually giving, and what would feel replenishing to receive?',
    experiment: 'Protect one realistic interval with no expected output. Choose something you genuinely enjoy or receive support from. Afterwards, note what you noticed without grading your rest.', locator: 'Chapter XI, §2.5', pages: '204–206' },
] as const
export type OrbitalLensId = typeof ORBITAL_LENSES[number]['id']
export type OrbitalCheckIn = { lensId: OrbitalLensId | null; situation: string; outcome: string }
export const ORBITAL_BOUNDARY = 'The Orbital Mind is a reflection framework. These lenses describe interacting needs, not fixed personality types, clinical diagnoses or conditions inferred from your birth chart.'
export function orbitalSource(id: string) { return `/astrology/orbital-mind#${id}` }
export function retrieveOrbitalLenses(question: string, selected: OrbitalLensId | null) {
  if (selected) return ORBITAL_LENSES.filter(lens => lens.id === selected)
  const words = question.toLowerCase().match(/[a-z]{4,}/g) ?? []
  return ORBITAL_LENSES.map((lens, index) => ({ lens, index, score: words.reduce((sum, word) => sum + Number(`${lens.title} ${lens.functions} ${lens.account} ${lens.question}`.toLowerCase().includes(word)), 0) }))
    .sort((a, b) => b.score - a.score || a.index - b.index).filter(item => item.score > 0).slice(0, 2).map(item => item.lens)
}

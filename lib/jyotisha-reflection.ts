/** Shared source vocabulary and optional prompts; no astronomical influence is asserted. */
const book = {
  title: 'Bṛhat Jātaka, translated by N. Chidambaram Iyer',
  edition: 'Foster Press, Madras, 1885',
  url: 'https://wellcomecollection.org/works/afmgm695',
  rights: 'Public Domain Mark, Wellcome Collection',
  inspectedAt: '2026-09-14',
}

// These bounded paraphrases were checked against the downloaded Wellcome PDF
// images (one-based PDF pages below). No old practitioner acceptance is reused.
export const EDUCATIONAL_SOURCES = {
  houses: { ...book, id: 'iyer-I-15', locator: 'Chapter I, stanza 15 and note (a), printed pp. 11–12; PDF pp. 52–53',
    account: 'The text assigns the seventh house to wife and the tenth to avocation. The translator’s table adds generosity and respect to the seventh, and knowledge and clothes to the tenth.',
    boundary: 'Historical gendered vocabulary, not a claim about a visitor’s orientation, spouse, occupation or prospects. Gender-neutral relationship reflection is Maha’s adaptation.' },
  symbols: { ...book, id: 'iyer-II-1', locator: 'Chapter II, stanza 1, printed p. 14; PDF p. 55',
    account: 'In the Kalapurusha framework the text associates Sun with soul, Moon with mind, Mars with strength, Mercury with speech, Jupiter with knowledge and health, Venus with desire, and Saturn with sorrow.',
    boundary: 'These are historical correspondences, not diagnoses or measured personal qualities. Health and sorrow are not turned into health or misfortune predictions.' },
  nodes: { ...book, id: 'iyer-II-3', locator: 'Chapter II, stanza 3, printed p. 15; PDF p. 56',
    account: 'The stanza lists names of Rahu, the ascending node, and Ketu, the descending node.',
    boundary: 'This passage identifies the nodes. It does not support a foreign-spouse, karmic-destiny or period-outcome rule.' },
} as const

export const REFLECTION_PROMPTS: Record<string, { symbol: string; question: string }> = {
  Sun: { symbol: 'soul', question: 'Which commitments reflect the values you actually want to live by?' },
  Moon: { symbol: 'mind', question: 'What do you notice about your responses, and what evidence might change your interpretation of them?' },
  Mars: { symbol: 'strength', question: 'Where would deliberate effort help, and where would a pause prevent unnecessary conflict?' },
  Mercury: { symbol: 'speech', question: 'What needs to be expressed more clearly, and what should you ask rather than assume?' },
  Jupiter: { symbol: 'knowledge', question: 'What do you need to learn or verify before taking the next step?' },
  Venus: { symbol: 'desire', question: 'What do you value or want, and how can you discuss it with respect for another person’s choices?' },
  Saturn: { symbol: 'sorrow', question: 'Which limits or difficult commitments deserve acknowledgement and a practical response?' },
}

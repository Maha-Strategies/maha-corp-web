import { readFileSync } from 'node:fs'
import { resolve, sep } from 'node:path'

export type OpenBookSection = { slug: string; title: string; marker: string }
export type OpenBookEdition = {
  slug: 'the-borrowed-light' | 'the-cosmic-recursion' | 'the-imagined-life' | 'the-maha-principle' | 'the-orbital-mind' | 'the-synthetic-self' | 'the-volcanic-engine'
  title: string
  subtitle: string
  manuscriptFiles: string[]
  sections: OpenBookSection[]
}

const CONTENT_ROOT = resolve(process.cwd(), 'content', 'books')

// These editions read directly from one canonical manuscript each. The reader
// URLs are derived views, never separately maintained chapter copies.
export const openBookEditions: Record<OpenBookEdition['slug'], OpenBookEdition> = {
  'the-cosmic-recursion': {
    slug: 'the-cosmic-recursion',
    title: 'The Cosmic Recursion',
    subtitle: 'What Survives the Compression',
    manuscriptFiles: ['THE-COSMIC-RECURSION-manuscript.md'],
    sections: [
      ['introduction', 'Introduction: The Deep Field and the Ledger', '## Introduction — The Deep Field and the Ledger'],
      ['the-first-forgetting', 'Chapter 1: The First Forgetting', '# Chapter One'],
      ['the-price-of-erasure', 'Chapter 2: The Price of Erasure', '# Chapter Two'],
      ['the-threshold', 'Chapter 3: The Threshold', '# Chapter Three'],
      ['the-long-burn', 'Chapter 4: The Long Burn', '# Chapter Four'],
      ['writing-to-metal', 'Chapter 5: Writing to Metal', '# Chapter Five'],
      ['the-clock-in-the-dark', 'Chapter 6: The Clock in the Dark', '# Chapter Six'],
      ['the-boundary-that-holds', 'Chapter 7: The Boundary That Holds', '# Chapter Seven'],
      ['the-invisible-majority', 'Chapter 8: The Invisible Majority', '# Chapter Eight'],
      ['the-cannibal-and-the-engine', 'Chapter 9: The Cannibal and the Engine', '# Chapter Nine'],
      ['reading-a-sparse-sky', 'Chapter 10: Reading a Sparse Sky', '# Chapter Ten'],
      ['the-last-erasure', 'Chapter 11: The Last Erasure', '# Chapter Eleven'],
      ['the-retained-invariant', 'Coda: The Retained Invariant', '# Coda'],
      ['universe-as-computer-claims', 'Appendix A: What “The Universe Is a Computer” Actually Claims, and Doesn’t', '# Appendix A'],
      ['provenance-index', 'Appendix B: Provenance Index', '# Appendix B'],
      ['sources-and-verification', 'Appendix C: Sources and Verification', '# Appendix C'],
    ].map(([slug, title, marker]) => ({ slug, title, marker })),
  },
  'the-maha-principle': {
    slug: 'the-maha-principle',
    title: 'The Maha Principle',
    subtitle: 'The Architecture of Human Flourishing',
    manuscriptFiles: ['The-Maha-Principle.md'],
    sections: [
      ['medical-disclaimer', 'Medical Disclaimer and Notice of Liability', '# MEDICAL DISCLAIMER AND NOTICE OF LIABILITY'],
      ['dedication', 'Dedication', '# Dedication'],
      ['authors-note', 'Author’s Note', '# AUTHOR’S NOTE'],
      ['map-of-the-terrain', 'The Maha Principle: A Map of the Terrain', '# THE MAHA PRINCIPLE: A MAP OF THE TERRAIN'],
      ['prologue-the-year-2027', 'Prologue: The Year 2027', '# PROLOGUE: THE YEAR 2027'],
      ['founders-pledge', 'The Founder’s Pledge', '# THE FOUNDER’S PLEDGE'],
      ['introduction', 'Introduction: The Silent Sickness and the Synchronous Echo', '# INTRODUCTION: The Silent Sickness and the Synchronous Echo'],
      ['part-i-the-diagnosis', 'Part I: The Diagnosis', '# PART I: The Diagnosis'],
      ['the-poisoned-body', 'Chapter 1: The Poisoned Body', '# CHAPTER 1: The Poisoned Body'],
      ['the-biological-audit', 'Protocol 0: The Biological Audit', '# PROTOCOL 0: The Biological Audit'],
      ['the-fractured-mind', 'Chapter 2: The Fractured Mind', '# CHAPTER 2: The Fractured Mind'],
      ['the-attention-audit', 'Protocol 1: The Attention Audit', '# PROTOCOL 1: The Attention Audit'],
      ['the-starving-spirit', 'Chapter 3: The Starving Spirit', '# CHAPTER 3: The Starving Spirit'],
      ['the-community-audit', 'Protocol 2: The Community Audit', '# PROTOCOL 2: The Community Audit'],
      ['part-ii-the-doctrine', 'Part II: The Doctrine', '# PART II: The Doctrine'],
      ['flawless-execution', 'Chapter 4: The Mandate of Flawless Execution', '# CHAPTER 4: The Mandate of Flawless Execution'],
      ['the-principle-of-strategy', 'Chapter 5: The Principle of Strategy', '# CHAPTER 5: The Principle of Strategy'],
      ['humane-governance', 'Chapter 6: The Principle of Humane Governance', '# CHAPTER 6: The Principle of Humane Governance'],
      ['navigating-complexity', 'Chapter 7: The Principle of Navigating Complexity', '# CHAPTER 7: The Principle of Navigating Complexity'],
      ['the-principle-of-vision', 'Chapter 8: The Principle of Vision', '# CHAPTER 8: The Principle of Vision'],
      ['part-iii-the-application', 'Part III: The Application', '# PART III: The Application'],
      ['forging-the-maha-individual', 'Chapter 9: Forging the Maha Individual', '# CHAPTER 9: Forging the Maha Individual'],
      ['weaving-the-maha-community', 'Chapter 10: Weaving the Maha Community', '# CHAPTER 10: Weaving the Maha Community'],
      ['architecting-the-maha-nation', 'Chapter 11: Architecting the Maha Nation', '# CHAPTER 11: Architecting the Maha Nation'],
      ['the-inevitable-spring', 'Conclusion: The Inevitable Spring', '# CONCLUSION: The Inevitable Spring'],
      ['the-great-bifurcation', 'Epilogue: The Great Bifurcation', '# EPILOGUE: THE GREAT BIFURCATION'],
      ['about-the-author', 'About the Author', '# ABOUT THE AUTHOR'],
      ['appendices', 'Appendices', '# APPENDICES'],
      ['seven-day-sovereignty-challenge', 'Appendix A: The 7-Day Sovereignty Challenge', '# APPENDIX A: The 7-Day Sovereignty Challenge'],
      ['the-maha-lexicon', 'Appendix B: The Maha Lexicon', '# APPENDIX B: The Maha Lexicon'],
      ['the-falsifiability-protocol', 'Appendix C: The Falsifiability Protocol', '# APPENDIX C: The Falsifiability Protocol'],
      ['the-maha-commons-analog-ledger', 'Appendix D: The Maha Commons Analog Ledger', '# APPENDIX D: The Maha Commons Analog Ledger'],
      ['the-town-hall-toolkit', 'Appendix E: The Town Hall Toolkit', '# APPENDIX E: The Town Hall Toolkit'],
      ['the-biological-dashboard', 'Appendix F: The Biological Dashboard', '# APPENDIX F: The Biological Dashboard'],
      ['the-maha-master-protocol', 'Appendix G: The Maha Master Protocol', '# APPENDIX G: The Maha Master Protocol'],
      ['the-shoppers-integrity-card', 'Appendix H: The Shopper’s Integrity Card', '# APPENDIX H: The Shopper’s Integrity Card'],
      ['the-school-lunch-audit', 'Appendix I: The School Lunch Audit', '# APPENDIX I: The School Lunch Audit'],
      ['the-digital-family-constitution', 'Appendix J: The Digital Family Constitution', '# APPENDIX J: The Digital Family Constitution'],
      ['acknowledgments-and-method', 'Acknowledgments & A Note on Method', '# Acknowledgments & A Note on Method'],
      ['notes-and-references', 'Notes and References', '# Notes and References'],
    ].map(([slug, title, marker]) => ({ slug, title, marker })),
  },
  'the-volcanic-engine': {
    slug: 'the-volcanic-engine', title: 'The Volcanic Engine', subtitle: 'Living on a Firing Planet',
    manuscriptFiles: [
      'The-Volcanic-Engine-Introduction.md',
      ...Array.from({ length: 14 }, (_, index) => `The-Volcanic-Engine-Chapter-${index + 1}.md`),
      'The-Volcanic-Engine-Coda.md',
      'The-Volcanic-Engine-Sources.md',
    ],
    sections: [
      ['introduction', 'Introduction: The Engine and the Interruption', '# Introduction: The Engine and the Interruption'],
      ['the-rock-that-flows', 'Chapter 1: The Rock That Flows', '# Chapter 1: The Rock That Flows'],
      ['the-physics-of-the-cork', 'Chapter 2: The Physics of the Cork', '# Chapter 2: The Physics of the Cork'],
      ['the-instrument-you-cannot-insert', 'Chapter 3: The Instrument You Cannot Insert', '# Chapter 3: The Instrument You Cannot Insert'],
      ['the-death-of-the-cavern', 'Chapter 4: The Death of the Cavern', '# Chapter 4: The Death of the Cavern'],
      ['two-warnings', 'Chapter 5: Two Warnings', '# Chapter 5: Two Warnings'],
      ['the-vent-at-the-beginning-of-life', 'Chapter 6: The Vent at the Beginning of Life', '# Chapter 6: The Vent at the Beginning of Life'],
      ['air-ocean-continent', 'Chapter 7: Air, Ocean, Continent', '# Chapter 7: Air, Ocean, Continent'],
      ['the-dead-worlds-and-the-icy-ones', 'Chapter 8: The Dead Worlds and the Icy Ones', '# Chapter 8: The Dead Worlds and the Icy Ones'],
      ['is-a-living-planet-necessarily-a-firing-one', 'Chapter 9: Is a Living Planet Necessarily a Firing One?', '# Chapter 9: Is a Living Planet Necessarily a Firing One?'],
      ['the-caldera-problem', 'Chapter 10: The Caldera Problem', '# Chapter 10: The Caldera Problem'],
      ['the-great-dyings', 'Chapter 11: The Great Dyings', '# Chapter 11: The Great Dyings'],
      ['volcanic-winter', 'Chapter 12: Volcanic Winter, and the Temptation to Borrow It', '# Chapter 12: Volcanic Winter, and the Temptation to Borrow It'],
      ['who-lives-on-the-flank', 'Chapter 13: Who Lives on the Flank', '# Chapter 13: Who Lives on the Flank'],
      ['tapping-the-furnace', 'Chapter 14: Tapping the Furnace', '# Chapter 14: Tapping the Furnace'],
      ['the-deep-time-horizon', 'Coda: The Deep-Time Horizon', '# Coda: The Deep-Time Horizon'],
      ['sources-and-further-reading', 'Sources and Further Reading', '# Sources and Further Reading'],
    ].map(([slug, title, marker]) => ({ slug, title, marker })),
  },
  'the-imagined-life': {
    slug: 'the-imagined-life', title: 'The Imagined Life', subtitle: 'Living Inside a Dreaming Brain', manuscriptFiles: ['the-imagined-life.md'],
    sections: [
      ['introduction', 'Introduction: The Faculty of the Possible', '# Introduction: The Faculty of the Possible'],
      ['what-happens-when-you-sleep', 'Chapter 1: What Happens When You Sleep', '# Chapter 1 — What Happens When You Sleep'],
      ['why-we-dream', 'Chapter 2: Why We Dream, and Why No One Yet Knows', '# Chapter 2 — Why We Dream, and Why No One Yet Knows'],
      ['the-hardest-thing-to-study', 'Chapter 3: The Hardest Thing to Study', '# Chapter 3 — The Hardest Thing to Study'],
      ['two-engines-one-trick', 'Chapter 4: Two Engines, One Trick', '# Chapter 4 — Two Engines, One Trick'],
      ['the-dreamer-at-the-controls', 'Chapter 5: The Dreamer at the Controls', '# Chapter 5 — The Dreamer at the Controls'],
      ['when-the-machinery-fails', 'Chapter 6: When the Machinery Fails', '# Chapter 6 — When the Machinery Fails'],
      ['are-dreams-computation', 'Chapter 7: Are Dreams Computation?', '# Chapter 7 — Are Dreams Computation?'],
      ['the-quantum-question', 'Chapter 8: The Quantum Question', '# Chapter 8 — The Quantum Question'],
      ['the-machines-that-dream', 'Chapter 9: The Machines That Dream', '# Chapter 9 — The Machines That Dream'],
      ['the-waking-dream', 'Chapter 10: The Waking Dream', '# Chapter 10 — The Waking Dream'],
      ['steering-the-simulator', 'Chapter 11: Steering the Simulator', '# Chapter 11 — Steering the Simulator'],
      ['future-of-dreaming', 'Coda: The Future of Dreaming', '# Coda — The Future of Dreaming'],
      ['retraining-protocols', 'Appendix: The Retraining Protocols', '# Appendix — The Retraining Protocols'],
    ].map(([slug, title, marker]) => ({ slug, title, marker })),
  },
  'the-synthetic-self': {
    slug: 'the-synthetic-self', title: 'The Synthetic Self', subtitle: 'Engineering the Soul of the Machine', manuscriptFiles: ['the-synthetic-self.md'],
    sections: [
      ['introduction', 'Introduction: The Mirror We Built', '## Introduction: The Mirror We Built'],
      ['the-learning-machine', 'Chapter 1: The Learning Machine', '# Chapter 1 — The Learning Machine'],
      ['thermodynamics-of-thought', 'Chapter 2: The Thermodynamics of Thought', '# Chapter 2 — The Thermodynamics of Thought'],
      ['computation-versus-understanding', 'Chapter 3: Computation Versus Understanding', '# Chapter 3 — Computation Versus Understanding'],
      ['the-data-problem', 'Chapter 4: The Data Problem', '# Chapter 4 — The Data Problem'],
      ['the-alignment-problem', 'Chapter 5: The Alignment Problem, Honestly', '# Chapter 5 — The Alignment Problem, Honestly'],
      ['inside-the-black-box', 'Chapter 6: Inside the Black Box', '# Chapter 6 — Inside the Black Box'],
      ['the-centaur', 'Chapter 7: The Centaur', '# Chapter 7 — The Centaur'],
      ['cognitive-offloading-and-atrophy', 'Chapter 8: Cognitive Offloading and Atrophy', '# Chapter 8 — Cognitive Offloading and Atrophy'],
      ['economics-of-synthetic-abundance', 'Chapter 9: The Economics of Synthetic Abundance', '# Chapter 9 — The Economics of Synthetic Abundance'],
      ['the-substrate-question', 'Chapter 10: The Substrate Question', '# Chapter 10 — The Substrate Question'],
      ['the-parent-and-the-child', 'Chapter 11: The Parent and the Child', '# Chapter 11 — The Parent and the Child'],
      ['the-glass', 'Coda: The Glass', '# Coda — The Glass'],
      ['provenance-and-method', 'Appendix A: Provenance and Method', '# Appendix A — Provenance and Method'],
      ['claims-and-status', 'Appendix B: Claims and Their Status', '# Appendix B — Claims and Their Status'],
      ['sources', 'Appendix C: Sources', '# Appendix C — Sources'],
    ].map(([slug, title, marker]) => ({ slug, title, marker })),
  },
  'the-orbital-mind': {
    slug: 'the-orbital-mind', title: 'The Orbital Mind', subtitle: 'The Astrophysics of the Self', manuscriptFiles: ['the-orbital-mind.md'],
    sections: [
      ['maha-framework', 'A Note on the Maha Framework', '# A Note on the Maha Framework'],
      ['how-to-use-this-book', 'How to Use This Book', '# How to Use This Book'],
      ['introduction', 'Introduction: The Map Is Not the Mind', '# Introduction: The Map Is Not the Mind'],
      ['the-governing-center', 'The Sun: The Governing Center', '# The Sun · The Governing Center'],
      ['body-and-rhythms', 'Earth and Moon: The Body and Its Rhythms', '# Earth and Moon · The Body and Its Rhythms'],
      ['structure-and-limit', 'Saturn: Structure and Limit', '# Saturn · Structure and Limit'],
      ['thought-and-attention', 'Mercury: Thought and Attention', '# Mercury · Thought and Attention'],
      ['desire-and-value', 'Venus: Desire and Value', '# Venus · Desire and Value'],
      ['agency-and-boundary', 'Mars: Agency and Boundary', '# Mars · Agency and Boundary'],
      ['responsibility-and-coordination', 'Jupiter: Responsibility and Coordination', '# Jupiter · Responsibility and Coordination'],
      ['disruption-and-novelty', 'Uranus: Disruption and Novelty', '# Uranus · Disruption and Novelty'],
      ['ambiguity-and-imagination', 'Neptune: Ambiguity and Imagination', '# Neptune · Ambiguity and Imagination'],
      ['depth-and-grief', 'Pluto: Depth and Grief', '# Pluto · Depth and Grief'],
      ['orientation-toward-the-unseen', 'Planet Nine: Orientation Toward the Unseen', '# Planet Nine · Orientation Toward the Unseen'],
      ['orbital-dynamics', 'Orbital Dynamics: The Grammar of the Whole', '# Orbital Dynamics · The Grammar of the Whole'],
      ['five-collisions', 'Quick Reference: The Five Collisions', '# Quick Reference · The Five Collisions'],
      ['formal-turn', 'The Formal Turn', '# The Formal Turn'],
      ['guide-to-sources', 'Appendix A: A Guide to the Sources', '# Appendix A · A Guide to the Sources'],
      ['claim-register', 'Appendix B: What Kind of Claim Is This?', '# Appendix B · What Kind of Claim Is This?'],
      ['when-the-map-is-not-enough', 'Appendix C: When the Map Is Not Enough', '# Appendix C · When the Map Is Not Enough'],
      ['formal-model', 'Appendix D: A Formal Model of Orbital Dynamics', '# Appendix D · A Formal Model of Orbital Dynamics'],
      ['maha-invariance', 'Appendix E: The Maha Invariance', '# Appendix E · The Maha Invariance: A Cross-Scale Conjecture'],
      ['predictions-that-could-lose', 'Appendix F: Predictions That Could Lose', '# Appendix F · A Research Program: Predictions That Could Lose'],
    ].map(([slug, title, marker]) => ({ slug, title, marker })),
  },
  'the-borrowed-light': {
    slug: 'the-borrowed-light', title: 'The Borrowed Light', subtitle: 'The Physics of a Self Made With Others',
    manuscriptFiles: ['introduction.md', 'chapter-1.md', 'chapter-2.md', 'chapter-3.md', 'chapter-4.md', 'chapter-5.md', 'chapter-6.md', 'chapter-7.md', 'chapter-8.md', 'chapter-9.md', 'chapter-10.md', 'chapter-11.md', 'appendix-a.md', 'appendix-b.md'],
    sections: [
      ['introduction', 'Introduction: The Light Without a Source', '## Introduction — The Light Without a Source'],
      ['the-amnesia-of-the-sources', 'Chapter 1: The Amnesia of the Sources', '## Chapter One — The Amnesia of the Sources, The Far Side, and the Physics of Own Gravity'],
      ['five-certain-theories', 'Chapter 2: Five Certain Theories', '## Chapter Two — Five Certain Theories, The Elephant, and the Physics of Rival Certainties'],
      ['the-intimate-and-the-vast', 'Chapter 3: The Intimate and the Vast', '## Chapter Three — The Intimate and the Vast, The Kitchen Table, and the Physics of the Curled Dimension'],
      ['the-legible-adversary', 'Chapter 4: The Legible Adversary', '## Chapter Four — The Legible Adversary, The Chipped Mug, and the Physics of Strong Coupling'],
      ['the-invariants', 'Chapter 5: The Invariants', '## Chapter Five — The Invariants, The Two Funerals, and the Physics of Mirror Worlds'],
      ['the-boundary-that-writes-the-bulk', 'Chapter 6: The Boundary That Writes the Bulk', '## Chapter Six — The Boundary That Writes the Bulk, The Wake, and the Physics of the Written Surface'],
      ['endpoints', 'Chapter 7: Endpoints', '## Chapter Seven — Endpoints, The Strange Situation, and the Physics of the Attached String'],
      ['what-crosses-anyway', 'Chapter 8: What Crosses Anyway', '## Chapter Eight — What Crosses Anyway, The Blocked Number, and the Physics of the Closed String'],
      ['the-chosen-world', 'Chapter 9: The Chosen World', '## Chapter Nine — The Chosen World, The Vow, and the Physics of the Landscape'],
      ['the-worlds-that-cannot-be-built', 'Chapter 10: The Worlds That Cannot Be Built', '## Chapter Ten — The Worlds That Cannot Be Built, The Phalanstery, and the Physics of the Swampland'],
      ['the-unnamed-unity', 'Chapter 11: The Unnamed Unity', '## Chapter Eleven — The Unnamed Unity, The Upside-Down W, and the Physics of the Letter M'],
      ['what-m-theory-is-and-isnt', "Appendix A: What M-Theory Actually Is and Isn't", "## Appendix A — What M-Theory Actually Is and Isn't"],
      ['provenance-index', 'Appendix B: Provenance Index', '## Appendix B — Provenance Index'],
    ].map(([slug, title, marker]) => ({ slug, title, marker })),
  },
}

export function getOpenBookEdition(slug: string): OpenBookEdition | null {
  return slug in openBookEditions ? openBookEditions[slug as OpenBookEdition['slug']] : null
}

function manuscriptPath(book: OpenBookEdition, filename: string) {
  const file = resolve(CONTENT_ROOT, book.slug, filename)
  if (!file.startsWith(CONTENT_ROOT + sep)) throw new Error('Invalid book manuscript path.')
  return file
}

export function readOpenBookManuscript(book: OpenBookEdition): string {
  return book.manuscriptFiles
    .map((filename) => stripRepeatedEditionHeader(readFileSync(manuscriptPath(book, filename), 'utf8'), book))
    .join('\n\n')
}

// Split-file editions repeat the title, subtitle, author and rule at the top of
// every source file. Those lines belong to the edition, not to the preceding
// chapter, so normalize them before deriving the stable section views.
function stripRepeatedEditionHeader(markdown: string, book: OpenBookEdition): string {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n')
  if (lines[0]?.trim().toLowerCase() !== `# ${book.title}`.toLowerCase()) return markdown.trim()

  lines.shift()
  while (lines[0]?.trim() === '') lines.shift()
  if (lines[0]?.trim() === `*${book.subtitle}*`) lines.shift()
  while (lines[0]?.trim() === '') lines.shift()
  if (/^\*\*Mayone(?: Maha)? Rajan\*\*$/.test(lines[0]?.trim() ?? '')) lines.shift()
  while (lines[0]?.trim() === '') lines.shift()
  if (/^-{3,}$/.test(lines[0]?.trim() ?? '')) lines.shift()
  const normalized = lines.join('\n').trim()
  return book.slug === 'the-volcanic-engine'
    ? normalized.replace(/^# Part [IVXLCDM]+ — .+\n+/gm, '').trim()
    : normalized
}

export function getOpenBookSection(book: OpenBookEdition, slug: string): { section: OpenBookSection; markdown: string } | null {
  const index = book.sections.findIndex((section) => section.slug === slug)
  if (index === -1) return null
  const manuscript = readOpenBookManuscript(book)
  const start = manuscript.indexOf(book.sections[index].marker)
  const end = index === book.sections.length - 1 ? manuscript.length : manuscript.indexOf(book.sections[index + 1].marker)
  if (start === -1 || end === -1) return null
  return { section: book.sections[index], markdown: manuscript.slice(start, end).trim() }
}

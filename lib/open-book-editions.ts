import { readFileSync } from 'node:fs'
import { resolve, sep } from 'node:path'

export type OpenBookSection = { slug: string; title: string; marker: string }
export type OpenBookEdition = {
  slug: 'the-borrowed-light' | 'the-imagined-life' | 'the-orbital-mind' | 'the-synthetic-self'
  title: string
  subtitle: string
  manuscriptFiles: string[]
  sections: OpenBookSection[]
}

const CONTENT_ROOT = resolve(process.cwd(), 'content', 'books')

// These editions read directly from one canonical manuscript each. The reader
// URLs are derived views, never separately maintained chapter copies.
export const openBookEditions: Record<OpenBookEdition['slug'], OpenBookEdition> = {
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
    .map((filename) => readFileSync(manuscriptPath(book, filename), 'utf8').replace(/^# THE BORROWED LIGHT\s*\r?\n\r?\n?/i, '').trim())
    .join('\n\n')
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

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const MANUSCRIPT_PATH = resolve(
  process.cwd(),
  'content/books/the-unfinished-species/The-Unfinished-Species-FULL.md',
)

export type UnfinishedSpeciesSection = {
  slug: string
  title: string
  description: string
  articleSection: string
}

// This is deliberately a single canonical manuscript. The reader routes derive
// their sections from it, so an edit to the manuscript cannot leave a chapter
// page with a different version of the text.
export const unfinishedSpeciesSections: UnfinishedSpeciesSection[] = [
  {
    slug: 'introduction',
    title: 'Introduction: The Blind Watchmaker Opens His Eyes',
    description: 'The book’s thesis, epistemic contract, and opening argument about evolution, prediction, and self-design.',
    articleSection: 'Introduction',
  },
  {
    slug: 'the-algorithm',
    title: 'Chapter 1: The Algorithm',
    description: 'Natural selection, the era of randomness, and the machine that wrote us.',
    articleSection: 'Chapter 1',
  },
  {
    slug: 'the-crucible',
    title: 'Chapter 2: The Crucible',
    description: 'How pressure, adaptation, and constraint shape living systems.',
    articleSection: 'Chapter 2',
  },
  {
    slug: 'the-zoo',
    title: 'Chapter 3: The Zoo',
    description: 'Mismatch, domestication, and the environments humans have built around themselves.',
    articleSection: 'Chapter 3',
  },
  {
    slug: 'the-runaway-maximizer',
    title: 'Chapter 4: The Runaway Maximizer',
    description: 'When selection pressures optimize toward outcomes no organism chose.',
    articleSection: 'Chapter 4',
  },
  {
    slug: 'software-writes-hardware',
    title: 'Chapter 5: Software Writes Hardware',
    description: 'Learning, development, inheritance, and the permeability of biological form.',
    articleSection: 'Chapter 5',
  },
  {
    slug: 'the-switchboard-of-sovereignty',
    title: 'Chapter 6: The Switchboard of Sovereignty',
    description: 'Epigenetics, environment, and the practical limits of self-direction.',
    articleSection: 'Chapter 6',
  },
  {
    slug: 'building-the-selection-pressure',
    title: 'Chapter 7: Building the Selection Pressure',
    description: 'How environments, tools, and institutions become design choices.',
    articleSection: 'Chapter 7',
  },
  {
    slug: 'the-merger-already-happened',
    title: 'Chapter 8: The Merger Already Happened',
    description: 'AI as an instrument for reading, modeling, and intervening in the human substrate.',
    articleSection: 'Chapter 8',
  },
  {
    slug: 'the-quantum-substrate',
    title: 'Chapter 9: The Quantum Substrate',
    description: 'Quantum computation, quantum biology, and the boundaries of the argument.',
    articleSection: 'Chapter 9',
  },
  {
    slug: 'the-cyborg-fallacy',
    title: 'Chapter 10: The Cyborg Fallacy',
    description: 'Why human–machine integration is not reducible to the fantasy of replacing flesh.',
    articleSection: 'Chapter 10',
  },
  {
    slug: 'design-as-destiny',
    title: 'Chapter 11: Design as Destiny',
    description: 'Sovereign selection, human dignity, and the ethics of choosing what comes next.',
    articleSection: 'Chapter 11',
  },
  {
    slug: 'method-and-sources',
    title: 'A Note on Method and Selected Sources',
    description: 'The three-register method and the book’s selected sources and further reading.',
    articleSection: 'Back matter',
  },
]

const markers = [
  '## Introduction: The Blind Watchmaker Opens His Eyes',
  '## Chapter 1 — The Algorithm',
  '## Chapter 2 — The Crucible',
  '## Chapter 3 — The Zoo',
  '## Chapter 4 — The Runaway Maximizer',
  '## Chapter 5 — Software Writes Hardware',
  '## Chapter 6 — The Switchboard of Sovereignty',
  '## Chapter 7 — Building the Selection Pressure',
  '## Chapter 8 — The Merger Already Happened',
  '## Chapter 9 — The Quantum Substrate',
  '## Chapter 10 — The Cyborg Fallacy',
  '## Chapter 11 — Design as Destiny',
  '# Back Matter',
]

export function readUnfinishedSpeciesManuscript(): string {
  return readFileSync(MANUSCRIPT_PATH, 'utf8')
}

export function getUnfinishedSpeciesSection(slug: string): {
  section: UnfinishedSpeciesSection
  markdown: string
} | null {
  const index = unfinishedSpeciesSections.findIndex((section) => section.slug === slug)
  if (index === -1) return null

  const manuscript = readUnfinishedSpeciesManuscript()
  const start = manuscript.indexOf(markers[index])
  const end = index === markers.length - 1 ? manuscript.length : manuscript.indexOf(markers[index + 1])
  if (start === -1 || end === -1) return null

  return { section: unfinishedSpeciesSections[index], markdown: manuscript.slice(start, end).trim() }
}

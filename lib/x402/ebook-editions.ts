// Immutable historical purchase commitments. Never edit an already sold edition.
export type EbookBook = {
  title: string; subtitle: string; filename: string; bytes: number; sha256: string;
  pdf: { filename: string; bytes: number; sha256: string; editionNote: string };
  description: string;
}
export type EbookId = 'the-maha-principle' | 'the-orbital-mind'
export const EBOOKS_V1: Readonly<Record<EbookId, EbookBook>> = {
  'the-maha-principle': {
    title: 'The Maha Principle', subtitle: 'The Architecture of Human Flourishing',
    filename: 'The-Maha-Principle.epub', bytes: 828345,
    sha256: 'sha256:4dad89b9b24e9225638989ce2b917cda83a2ce360d8a8b48e4d88d3e187e013f',
    pdf: { filename: 'The-Maha-Principle-print.pdf', bytes: 2048145,
      sha256: 'sha256:3906e8761a6dd2668e9def504206d0e5b2ccac7f39871d126a6a5018f72f17e0',
      editionNote: 'Author-approved print PDF dated July 6, 2026; a separate print edition, not a byte-equivalent rendering of the EPUB.' },
    description: 'A book on human flourishing, strategy and humane governance. Includes the author’s medical disclaimer; not medical advice or a validated treatment.',
  },
  'the-orbital-mind': {
    title: 'The Orbital Mind', subtitle: 'The Astrophysics of the Self',
    filename: 'The-Orbital-Mind.epub', bytes: 1324291,
    sha256: 'sha256:82072241663d51b26d98d393d8a703350ef33cc78f15316a269ff0b792bc8642',
    pdf: { filename: 'The-Orbital-Mind-print.pdf', bytes: 1886017,
      sha256: 'sha256:021d00d04293b0f333f9c20201a74d5453ea42e2f1af7c6adb4fdc79662fef31',
      editionNote: 'October 2026 print reading edition aligned to the author-selected EPUB, with linked contents, bookmarks and added publishing matter. The EPUB supplies no bibliographic entries; this limitation is disclosed rather than supplemented with invented references.' },
    description: 'A book using orbital dynamics as a framework for attention, agency, limits and integration. Metaphor and conjecture are not established psychological or medical findings.',
  },
}

export const EBOOKS_V1_1: Readonly<Record<EbookId, EbookBook>> = {
  'the-maha-principle': {
    ...EBOOKS_V1['the-maha-principle'],
    pdf: { filename: 'The-Maha-Principle-print.pdf', bytes: 1362197,
      sha256: 'sha256:ee457122aa15551b58fbcb82ad6a0fb2b99e6d55aaf3aac51bc711eb739f61c4',
      editionNote: 'October 2026 reading PDF aligned to the author-selected October 7 EPUB, with linked contents, bookmarks, the medical disclaimer, appendices A-J, and Notes and References. Typography and pagination differ; manuscript prose is preserved.' },
  },
  'the-orbital-mind': {
    ...EBOOKS_V1['the-orbital-mind'], bytes: 1284642,
    sha256: 'sha256:a3c833c3daec0b15d8d8ee8f55fd98b9bc72ed283edd61cc784c83d8c017ca62',
    pdf: { filename: 'The-Orbital-Mind-print.pdf', bytes: 1784212,
      sha256: 'sha256:38fa735a3b2ca9015865b4755f03c76ccc504e4ec505a92c14d59caf7f266fa6',
      editionNote: 'Revised V3 EPUB and October 2026 reading PDF aligned to the author-selected EPUB, with linked contents, bookmarks and appendices A-F, including A Guide to the Sources. Typography and pagination differ; manuscript prose is preserved.' },
  },
}

// The artwork revision preserves the approved EPUB and the other title's files.
export const EBOOKS_CURRENT: Readonly<Record<EbookId, EbookBook>> = {
  ...EBOOKS_V1_1,
  'the-maha-principle': {
    ...EBOOKS_V1_1['the-maha-principle'],
    pdf: { filename: 'The-Maha-Principle-print.pdf', bytes: 1355839,
      sha256: 'sha256:703e19222acd9e160efecf73b860184c7283ea8a952830269b08d43409c2645d',
      editionNote: 'October 2026 reading PDF with the revised gold-tree cover, architectural roots and water reflection, aligned to the approved EPUB manuscript. Includes the two-line dedication to Claire, linked contents, bookmarks, the medical disclaimer, appendices A-J, and Notes and References. Typography and pagination differ; manuscript prose is preserved.' },
  },
}

import type { Metadata } from 'next'

/** Public presentation copy only. This is not evidence, a review, or release authority. */
export const SEARCH_CLICK_PILOT: Readonly<Record<string, { title: string; description: string }>> = {
  '/knowledge/mathematics/gamma-function': {
    title: 'Gamma Function: Factorial Extension, Identities and Limits',
    description: 'Understand the gamma function through its recurrence, reflection and duplication formulas, with DLMF references and limits on numerical evaluation.',
  },
  '/knowledge/mathematics/incomplete-gamma-functions': {
    title: 'Incomplete Gamma Functions: Lower, Upper and Normalized Forms',
    description: 'Compare lower and upper incomplete gamma functions, their normalized forms P and Q, and the parameter restrictions in the cited DLMF definitions.',
  },
  '/knowledge/astrology/calculations/placidus-houses': {
    title: 'Placidus Houses: Calculation Inputs and Polar Limitations',
    description: 'How Placidus houses are defined, which time and location inputs they require, and why high latitudes can cause failures. A reference, not a calculator.',
  },
  '/knowledge/astrology/calculations/ascendant': {
    title: 'Ascendant Calculation: Time, Location and the Eastern Horizon',
    description: 'Understand the inputs and eastern-horizon geometry behind ascendant calculation, including time uncertainty and polar limits—not personality predictions.',
  },
  '/knowledge/astrology/calculations/geocentric-vs-topocentric': {
    title: 'Geocentric vs Topocentric: Origins, Parallax and Comparison',
    description: 'Compare Earth-centered and observer-centered positions, the role of parallax, and the shared frames and corrections needed for a meaningful comparison.',
  },
  '/guides/retrieval-augmented-generation-lewis-2020': {
    title: 'RAG Explained: A Developer Guide to Lewis et al. (2020)',
    description: 'Read a developer summary of the original RAG paper: retrieved passages, model memory and implementation boundaries. Includes a link to the original paper.',
  },
  '/knowledge/mechanistic-interpretability/methods/mechanistic-interpretability-causal-scrubbing': {
    title: 'Causal Scrubbing: Testing Interpretability Hypotheses',
    description: 'Explore causal scrubbing, its resampling interventions and the limits of testing an interpretability hypothesis. Passing a test is not proof of completeness.',
  },
  '/knowledge/quantum-systems/comparisons/error-mitigation-versus-correction': {
    title: 'Quantum Error Mitigation vs Correction: Compare the Approaches',
    description: 'Compare quantum error mitigation and error correction through the claims, sources and limitations documented in this technical reference.',
  },
  '/knowledge/religion/mayon': {
    title: 'Who Is Māyōṉ (Mayon)? Tamil Sources, Mullai and Tirumāl',
    description: 'Explore Māyōṉ in early Tamil texts, the mullai landscape and connections to Tirumāl, Vishnu and Krishna, keeping textual evidence and later interpretation separate.',
  },
  '/knowledge/religion/textual-authority': {
    title: 'Textual Authority: Who Treats a Text as Authoritative—and Why?',
    description: 'Distinguish a text’s authority within a community from historical accuracy or theological truth, with questions for examining context and interpretation.',
  },
}

export function searchClickCopy(path: string) {
  return Object.hasOwn(SEARCH_CLICK_PILOT, path) ? SEARCH_CLICK_PILOT[path] : undefined
}

/** Called only after the route's normal existence/release checks. Preserve all URL and policy fields. */
export function searchClickMetadata(path: string, original: Metadata): Metadata {
  const copy = searchClickCopy(path)
  if (!copy) return original
  return {
    ...original,
    title: { absolute: `${copy.title} | Maha` },
    description: copy.description,
    openGraph: { ...original.openGraph, title: copy.title, description: copy.description },
    twitter: { ...original.twitter, title: copy.title, description: copy.description },
  }
}

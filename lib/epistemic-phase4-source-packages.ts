import type { EvidenceMaturity } from './epistemic-schema.ts'

export const EPISTEMIC_PHASE4_SOURCE_PACKAGE_VERSION = 'maha-phase4-source-packages/1.0' as const

export interface Phase4SourceCorrection {
  blockerCode: string
  sourceUrl: string
  exactLocator: string | null
  proposedValue: string
  note: string
  rightsBasis: string
}

export interface Phase4SourcePackage {
  recordId: string
  researchStatus: 'operator-researched-review-required'
  corrections: readonly Phase4SourceCorrection[]
}

const ACCESSED_AT = '2026-08-24'
const LINK_ONLY = 'Official link and paraphrase only; no source quotation imported.'

function chronology(status: 'undated' | 'living-document', sourceVersion?: string): string {
  return JSON.stringify({ status, accessedAt: ACCESSED_AT, ...(sourceVersion ? { sourceVersion } : {}) })
}

function sourceCorrection(
  blockerCode: string,
  sourceUrl: string,
  proposedValue: string,
  note: string,
  exactLocator: string | null = null,
): Phase4SourceCorrection {
  return { blockerCode, sourceUrl, exactLocator, proposedValue, note, rightsBasis: LINK_ONLY }
}

function maturity(
  recordId: string,
  sequence: string,
  sourceUrl: string,
  value: Exclude<EvidenceMaturity, 'not-assessed'>,
  note: string,
): Phase4SourceCorrection {
  return sourceCorrection(`claim-evidence-not-assessed:${recordId.replace(':record:', ':claim:')}-${sequence}`, sourceUrl, value, note)
}

const nistHandbook = 'https://www.itl.nist.gov/div898/handbook/'
const tei = 'https://www.tei-c.org/release/doc/tei-p5-doc/en/html/index.html'
const loc = 'https://www.loc.gov/programs/teachers/getting-started-with-primary-sources/guides/'

/**
 * Operator research for the 13 Phase 4 pilot records that had not yet been
 * compiled on 2026-08-24. These packages satisfy only the mechanical source
 * fields. They deliberately preserve documented source mismatches for an
 * invited source-fidelity reviewer; they are not expert decisions.
 */
export const EPISTEMIC_PHASE4_SOURCE_PACKAGES: readonly Phase4SourcePackage[] = [
  {
    recordId: 'urn:maha:record:legacy-semiconductor-ion-implantation-and-annealing',
    researchStatus: 'operator-researched-review-required',
    corrections: [
      sourceCorrection(
        'source-publication-date-missing:legacy-semiconductor-applied-implant',
        'https://www.appliedmaterials.com/eu/en/semiconductor/products/modify/implant.html',
        chronology('living-document'),
        'The product page states no publication date and changes with the current Applied Materials portfolio, so it is represented as a living document.',
      ),
      sourceCorrection(
        'source-locator-missing:legacy-semiconductor-applied-implant',
        'https://www.appliedmaterials.com/eu/en/semiconductor/products/modify/implant.html',
        'Ion Implant; paragraphs defining implantation as doping and enumerating high-current, medium-current, high-energy, and plasma-doping systems.',
        'The identified paragraphs support implantation as doping and the named equipment classes. They do not establish the separate anneal and activation claim.',
        'Ion Implant; paragraphs defining implantation as doping and enumerating high-current, medium-current, high-energy, and plasma-doping systems.',
      ),
      maturity(
        'urn:maha:record:legacy-semiconductor-ion-implantation-and-annealing',
        '01',
        'https://www.appliedmaterials.com/eu/en/semiconductor/products/modify/implant.html',
        'not-applicable',
        'This is an official vendor process and product description, not an empirical replication assessment.',
      ),
      maturity(
        'urn:maha:record:legacy-semiconductor-ion-implantation-and-annealing',
        '02',
        'https://www.appliedmaterials.com/eu/en/semiconductor/products/modify/implant.html',
        'not-applicable',
        'The cited page does not establish the claim about activation and thermal budget; source-fidelity review must request a source change or narrower claim.',
      ),
    ],
  },
  {
    recordId: 'urn:maha:record:legacy-mathematics-bayesian-updating',
    researchStatus: 'operator-researched-review-required',
    corrections: [
      sourceCorrection(
        'source-publication-date-missing:legacy-mathematics-nist-statistical-handbook',
        nistHandbook,
        chronology('living-document', 'NIST/SEMATECH e-Handbook; significant update April 2012; citation page updated 2022-04-27'),
        'NIST describes the e-Handbook as an evolving web reference and instructs readers to cite an access date.',
      ),
      sourceCorrection(
        'source-locator-missing:legacy-mathematics-nist-statistical-handbook',
        nistHandbook,
        '§8.1.10, “How can Bayesian methodology be used for reliability evaluation?”, especially “Bayes Formula, Prior and Posterior Distribution”.',
        'The section supports prior, likelihood, and posterior updating. The imported sentence about model misspecification and leakage extends beyond this passage and remains for source-fidelity review.',
        '§8.1.10, “How can Bayesian methodology be used for reliability evaluation?”, especially “Bayes Formula, Prior and Posterior Distribution”.',
      ),
      maturity(
        'urn:maha:record:legacy-mathematics-bayesian-updating',
        '01', nistHandbook, 'not-applicable',
        'The record states a mathematical method and its modeling boundary; empirical replication maturity is not the applicable axis.',
      ),
    ],
  },
  {
    recordId: 'urn:maha:record:legacy-mathematics-calibration-and-reliability',
    researchStatus: 'operator-researched-review-required',
    corrections: [
      sourceCorrection(
        'source-publication-date-missing:legacy-mathematics-nist-statistical-handbook', nistHandbook,
        chronology('living-document', 'NIST/SEMATECH e-Handbook; significant update April 2012; citation page updated 2022-04-27'),
        'NIST describes the e-Handbook as an evolving web reference and instructs readers to cite an access date.',
      ),
      sourceCorrection(
        'source-locator-missing:legacy-mathematics-nist-statistical-handbook', nistHandbook,
        '§2.3.6, “Calibration Process” (instrument calibration); no passage located for probabilistic forecast calibration or reliability diagrams.',
        'The closest NIST section concerns instrument calibration, not probabilistic forecast calibration. The mismatch is explicit so a reviewer can request a replacement source.',
        '§2.3.6, “Calibration Process” (instrument calibration); no passage located for probabilistic forecast calibration or reliability diagrams.',
      ),
      maturity(
        'urn:maha:record:legacy-mathematics-calibration-and-reliability',
        '01', nistHandbook, 'not-applicable',
        'The cited source does not support this forecast-calibration formulation; an evidence-maturity label cannot repair the source mismatch.',
      ),
    ],
  },
  {
    recordId: 'urn:maha:record:legacy-mathematics-causal-inference',
    researchStatus: 'operator-researched-review-required',
    corrections: [
      sourceCorrection(
        'source-publication-date-missing:legacy-mathematics-nist-statistical-handbook', nistHandbook,
        chronology('living-document', 'NIST/SEMATECH e-Handbook; significant update April 2012; citation page updated 2022-04-27'),
        'NIST describes the e-Handbook as an evolving web reference and instructs readers to cite an access date.',
      ),
      sourceCorrection(
        'source-locator-missing:legacy-mathematics-nist-statistical-handbook', nistHandbook,
        'Glossary entry “randomization, scientific” and experimental-design chapters; no treatment located of counterfactual contrasts, causal graphs, or identification.',
        'The handbook discusses randomized experimental design but does not establish the imported causal-graph and counterfactual formulation.',
        'Glossary entry “randomization, scientific” and experimental-design chapters; no treatment located of counterfactual contrasts, causal graphs, or identification.',
      ),
      maturity(
        'urn:maha:record:legacy-mathematics-causal-inference',
        '01', nistHandbook, 'not-applicable',
        'The record is a methodological synthesis and the cited handbook does not support its complete formulation.',
      ),
    ],
  },
  {
    recordId: 'urn:maha:record:legacy-mathematics-formal-logic-and-rule-compilation',
    researchStatus: 'operator-researched-review-required',
    corrections: [
      sourceCorrection(
        'source-publication-date-missing:legacy-mathematics-nist-dads',
        'https://xlinux.nist.gov/dads/',
        chronology('living-document', 'NIST Dictionary of Algorithms and Data Structures; development began 1998; updated 2024-08-19'),
        'DADS is a maintained dictionary rather than a dated monograph, so the source is represented as a living document.',
      ),
      sourceCorrection(
        'source-locator-missing:legacy-mathematics-nist-dads',
        'https://xlinux.nist.gov/dads/',
        'Dictionary entries “formal methods”, “formal verification”, “boolean expression”, and “implication”; site scope statement under the title.',
        'The entries define adjacent formal-computing terms but do not establish Maha’s source-bounded rule compiler, provenance, or human-review requirements.',
        'Dictionary entries “formal methods”, “formal verification”, “boolean expression”, and “implication”; site scope statement under the title.',
      ),
      maturity(
        'urn:maha:record:legacy-mathematics-formal-logic-and-rule-compilation',
        '01', 'https://xlinux.nist.gov/dads/', 'not-applicable',
        'The record is a Maha methodological synthesis; dictionary definitions are not empirical evidence or a formal proof of the complete proposition.',
      ),
    ],
  },
  {
    recordId: 'urn:maha:record:legacy-astronomy-telescopes-detectors-and-angular-resolution',
    researchStatus: 'operator-researched-review-required',
    corrections: [
      sourceCorrection(
        'source-publication-date-missing:legacy-astronomy-nasa-spectrum',
        'https://science.nasa.gov/wp-content/uploads/2023/08/tour-of-the-ems-tagged-v7-0.pdf',
        '2016-07-12',
        'The date is retained from the NASA PDF document metadata rather than inferred from the current asset URL.',
      ),
      sourceCorrection(
        'source-locator-missing:legacy-astronomy-nasa-spectrum',
        'https://science.nasa.gov/wp-content/uploads/2023/08/tour-of-the-ems-tagged-v7-0.pdf',
        'PDF pp. 2, 4, 8, and 10–11: wavelength-specific instruments and detectors, detector-to-image process, radio wavelength, arrays, and resolution.',
        'These pages support wavelength-specific instrumentation and detector behavior. They only partially address the imported reconstruction and point-spread-function claims.',
        'PDF pp. 2, 4, 8, and 10–11: wavelength-specific instruments and detectors, detector-to-image process, radio wavelength, arrays, and resolution.',
      ),
      sourceCorrection(
        'source-publication-date-missing:legacy-astronomy-nasa-astrophysics',
        'https://science.nasa.gov/astrophysics/',
        chronology('living-document', 'NASA Astrophysics; page last updated 2025-11-18'),
        'The landing page is actively maintained and identifies a last-updated date rather than a stable edition.',
      ),
      sourceCorrection(
        'source-locator-missing:legacy-astronomy-nasa-astrophysics',
        'https://science.nasa.gov/astrophysics/',
        '“Current Missions — A Legacy of Discovery, A Future of Innovation” and “Astrophysics Research”.',
        'The page supports multi-wavelength observatories and observation-to-analysis generally, but not the complete PSF, sampling, background, or calibration propositions.',
        '“Current Missions — A Legacy of Discovery, A Future of Innovation” and “Astrophysics Research”.',
      ),
      maturity('urn:maha:record:legacy-astronomy-telescopes-detectors-and-angular-resolution', '01', 'https://science.nasa.gov/wp-content/uploads/2023/08/tour-of-the-ems-tagged-v7-0.pdf', 'not-applicable', 'NASA educational documentation supports the mechanism, but this imported statement is not itself an empirical study-level result.'),
      maturity('urn:maha:record:legacy-astronomy-telescopes-detectors-and-angular-resolution', '02', 'https://science.nasa.gov/astrophysics/', 'not-applicable', 'The cited explainers do not establish the complete image-reconstruction proposition; source-fidelity review must narrow or re-source it.'),
      maturity('urn:maha:record:legacy-astronomy-telescopes-detectors-and-angular-resolution', '03', 'https://science.nasa.gov/astrophysics/', 'not-applicable', 'The cited landing page does not directly establish this aperture tradeoff; evidence maturity cannot substitute for a matching source.'),
    ],
  },
  {
    recordId: 'urn:maha:record:legacy-astronomy-orbits-gravity-and-ephemerides',
    researchStatus: 'operator-researched-review-required',
    corrections: [
      sourceCorrection('source-publication-date-missing:legacy-astronomy-jpl-horizons', 'https://ssd.jpl.nasa.gov/horizons/manual.html', chronology('living-document', 'JPL Horizons manual 4.98d, 2025-11-21'), 'Horizons is current operational documentation with an explicit software/manual version.'),
      sourceCorrection('source-locator-missing:legacy-astronomy-jpl-horizons', 'https://ssd.jpl.nasa.gov/horizons/manual.html', 'Manual 4.98d: “Purpose and Scope”, “Overview of Usage”, “Reference Frames”, and “Statement of Ephemeris Limitations”.', 'The manual supports configurable target, center, time, frame, output, numerical integration, and object-specific uncertainty.', 'Manual 4.98d: “Purpose and Scope”, “Overview of Usage”, “Reference Frames”, and “Statement of Ephemeris Limitations”.'),
      sourceCorrection('source-publication-date-missing:legacy-astronomy-iau-sofa', 'https://www.iausofa.org/current-software', '2023-10-11', 'The SOFA current-software page identifies the issue date explicitly.'),
      sourceCorrection('source-locator-missing:legacy-astronomy-iau-sofa', 'https://www.iausofa.org/current-software', '“Standards of Fundamental Astronomy — Issue: 2023-10-11”; current release and IAU 2006/2000A precession-nutation model note.', 'SOFA supports standardized fundamental-astronomy transformations. It does not establish orbital fitting or object-specific ephemeris uncertainty.', '“Standards of Fundamental Astronomy — Issue: 2023-10-11”; current release and IAU 2006/2000A precession-nutation model note.'),
      maturity('urn:maha:record:legacy-astronomy-orbits-gravity-and-ephemerides', '01', 'https://ssd.jpl.nasa.gov/horizons/manual.html', 'not-applicable', 'This is a reproducible system-interface and calculation-method claim, not a study-level empirical result.'),
      maturity('urn:maha:record:legacy-astronomy-orbits-gravity-and-ephemerides', '02', 'https://ssd.jpl.nasa.gov/horizons/manual.html', 'not-applicable', 'JPL documentation supports numerical integration under current models; the SOFA citation does not support orbital fitting and must be reviewed as a partial mismatch.'),
      maturity('urn:maha:record:legacy-astronomy-orbits-gravity-and-ephemerides', '03', 'https://www.iausofa.org/current-software', 'not-applicable', 'SOFA does not establish object-specific ephemeris accuracy; a source-fidelity reviewer should request a replacement source.'),
    ],
  },
  {
    recordId: 'urn:maha:record:legacy-astronomy-exoplanet-detection-and-confirmation',
    researchStatus: 'operator-researched-review-required',
    corrections: [
      sourceCorrection('source-publication-date-missing:legacy-astronomy-nasa-exoplanet-archive', 'https://exoplanetarchive.ipac.caltech.edu/docs/intro.html', chronology('living-document', 'NASA Exoplanet Archive overview; last updated 2025-08-13'), 'The archive overview and holdings are maintained operational documentation.'),
      sourceCorrection('source-locator-missing:legacy-astronomy-nasa-exoplanet-archive', 'https://exoplanetarchive.ipac.caltech.edu/docs/intro.html', '“About the NASA Exoplanet Archive”, “Tools for Working With Exoplanet Data”, “Transit Survey Data”, and “Holdings”.', 'The overview supports separate catalog/data classes, stellar and planetary parameters, source literature, and changing operational holdings.', '“About the NASA Exoplanet Archive”, “Tools for Working With Exoplanet Data”, “Transit Survey Data”, and “Holdings”.'),
      sourceCorrection('source-publication-date-missing:legacy-astronomy-esa-gaia-science', 'https://www.cosmos.esa.int/web/gaia/science', chronology('living-document'), 'The Gaia science page is a maintained mission page without a stable edition in the imported record.'),
      sourceCorrection('source-locator-missing:legacy-astronomy-esa-gaia-science', 'https://www.cosmos.esa.int/web/gaia/science', 'Gaia Mission Science landing page; no supporting passage for the imported exoplanet radius, mass, orbit, disposition, or completeness claims was retrievable during this audit.', 'The imported Gaia source could not be matched to either claim. The explicit negative locator prevents a blank field from disguising that mismatch.', 'Gaia Mission Science landing page; no supporting passage for the imported exoplanet radius, mass, orbit, disposition, or completeness claims was retrievable during this audit.'),
      maturity('urn:maha:record:legacy-astronomy-exoplanet-detection-and-confirmation', '01', 'https://exoplanetarchive.ipac.caltech.edu/docs/intro.html', 'not-applicable', 'This is a living archive-scope claim rather than an empirical study result.'),
      maturity('urn:maha:record:legacy-astronomy-exoplanet-detection-and-confirmation', '02', 'https://exoplanetarchive.ipac.caltech.edu/docs/intro.html', 'not-applicable', 'The archive page supports parameter and fitting-tool availability but not the complete inferential proposition; Gaia is not a matching source here.'),
      maturity('urn:maha:record:legacy-astronomy-exoplanet-detection-and-confirmation', '03', 'https://www.cosmos.esa.int/web/gaia/science', 'not-applicable', 'The cited Gaia page does not establish changing catalog dispositions or cross-method detection completeness.'),
    ],
  },
  {
    recordId: 'urn:maha:record:legacy-astronomy-cosmic-microwave-background-and-lambda-cdm',
    researchStatus: 'operator-researched-review-required',
    corrections: [
      sourceCorrection('source-publication-date-missing:legacy-astronomy-esa-planck-cmb', 'https://www.esa.int/Science_Exploration/Space_Science/Planck/Planck_and_the_cosmic_microwave_background', chronology('undated'), 'The ESA explainer does not state a publication or update date, so access chronology is explicit.'),
      sourceCorrection('source-locator-missing:legacy-astronomy-esa-planck-cmb', 'https://www.esa.int/Science_Exploration/Space_Science/Planck/Planck_and_the_cosmic_microwave_background', '“What is the cosmic microwave background?”, “How many space missions have studied the CMB?”, “What does the CMB look like?”, and “What is the standard model of cosmology?”.', 'The named sections support the CMB measurement description, fluctuation scale, model conditionality, parameters, and open status of dark components.', '“What is the cosmic microwave background?”, “How many space missions have studied the CMB?”, “What does the CMB look like?”, and “What is the standard model of cosmology?”.'),
      sourceCorrection('source-publication-date-missing:legacy-astronomy-nasa-universe', 'https://science.nasa.gov/exoplanets/what-is-the-universe/', '2020-10-22', 'NASA page metadata identifies the original publication date; the page separately identifies its 2024-10-29 update.'),
      sourceCorrection('source-locator-missing:legacy-astronomy-nasa-universe', 'https://science.nasa.gov/exoplanets/what-is-the-universe/', '“What is the universe made of?” and “How has our view of the universe changed over time?”.', 'The sections explicitly describe dark matter and dark energy as not directly understood and distinguish present knowledge from open questions.', '“What is the universe made of?” and “How has our view of the universe changed over time?”.'),
      maturity('urn:maha:record:legacy-astronomy-cosmic-microwave-background-and-lambda-cdm', '01', 'https://www.esa.int/Science_Exploration/Space_Science/Planck/Planck_and_the_cosmic_microwave_background', 'not-applicable', 'This institutional synthesis describes established observations but does not encode a claim-level replication count.'),
      maturity('urn:maha:record:legacy-astronomy-cosmic-microwave-background-and-lambda-cdm', '02', 'https://www.esa.int/Science_Exploration/Space_Science/Planck/Planck_and_the_cosmic_microwave_background', 'not-applicable', 'This is a model-fitting method statement summarized by institutional explainers, not one bounded empirical study result.'),
      maturity('urn:maha:record:legacy-astronomy-cosmic-microwave-background-and-lambda-cdm', '03', 'https://science.nasa.gov/exoplanets/what-is-the-universe/', 'not-applicable', 'The statement records an open scientific question; study-level evidence maturity is not the applicable status.'),
    ],
  },
  {
    recordId: 'urn:maha:record:legacy-religion-textual-authority',
    researchStatus: 'operator-researched-review-required',
    corrections: [
      sourceCorrection('source-publication-date-missing:legacy-religion-tei-guidelines', tei, chronology('living-document', 'TEI P5 4.12.0, revision 113e933e2, 2026-07-28'), 'TEI publishes a versioned, continuously maintained edition.'),
      sourceCorrection('source-locator-missing:legacy-religion-tei-guidelines', tei, 'P5 4.12.0: ch. 12 “Representation of Primary Sources”, ch. 17 “Linking, Segmentation, and Alignment”, ch. 20 “Graphs, Networks, and Trees”, and ch. 22 “Certainty, Precision, and Responsibility”.', 'The chapters support documentary transcription, transmission, interpretation, uncertainty, and responsibility fields; they do not establish the full sociology of religious authority.', 'P5 4.12.0: ch. 12 “Representation of Primary Sources”, ch. 17 “Linking, Segmentation, and Alignment”, ch. 20 “Graphs, Networks, and Trees”, and ch. 22 “Certainty, Precision, and Responsibility”.'),
      sourceCorrection('source-publication-date-missing:legacy-religion-loc-primary-sources', loc, chronology('undated'), 'The Library of Congress guide page states no publication date.'),
      sourceCorrection('source-locator-missing:legacy-religion-loc-primary-sources', loc, '“Primary Source Analysis Tool for Students” and “Teacher’s Guides”; Observe, Reflect, and Question workflow.', 'The materials support disciplined primary-source observation and questioning, not the complete tradition-relative authority proposition.', '“Primary Source Analysis Tool for Students” and “Teacher’s Guides”; Observe, Reflect, and Question workflow.'),
      maturity('urn:maha:record:legacy-religion-textual-authority', '01', tei, 'not-applicable', 'This record is an explicitly bounded Maha comparative-method synthesis, not an empirical effect claim.'),
    ],
  },
  {
    recordId: 'urn:maha:record:legacy-religion-translation-and-semantic-range',
    researchStatus: 'operator-researched-review-required',
    corrections: [
      sourceCorrection('source-publication-date-missing:legacy-religion-unesco-multilingualism', 'https://www.unesco.org/en/multilingualism-linguistic-diversity', chronology('living-document'), 'The UNESCO program page is actively maintained and does not state a stable publication date.'),
      sourceCorrection('source-locator-missing:legacy-religion-unesco-multilingualism', 'https://www.unesco.org/en/multilingualism-linguistic-diversity', 'Introductory paragraphs on languages carrying information in sociocultural, political, and economic contexts; “2003 Recommendation” section.', 'The page supports contextual and multilingual diversity. It does not establish every claim about translator choices or one-to-one semantic equivalence.', 'Introductory paragraphs on languages carrying information in sociocultural, political, and economic contexts; “2003 Recommendation” section.'),
      sourceCorrection('source-publication-date-missing:legacy-religion-tei-guidelines', tei, chronology('living-document', 'TEI P5 4.12.0, revision 113e933e2, 2026-07-28'), 'TEI publishes a versioned, continuously maintained edition.'),
      sourceCorrection('source-locator-missing:legacy-religion-tei-guidelines', tei, 'P5 4.12.0: “Languages and Character Sets”, ch. 12 “Representation of Primary Sources”, ch. 17 “Alignment of Parallel Texts”, and ch. 22 “Certainty, Precision, and Responsibility”.', 'The chapters support preserving language, alignment, source wording, uncertainty, and responsibility metadata. Translation theory in the imported claim still requires a more direct source.', 'P5 4.12.0: “Languages and Character Sets”, ch. 12 “Representation of Primary Sources”, ch. 17 “Alignment of Parallel Texts”, and ch. 22 “Certainty, Precision, and Responsibility”.'),
      maturity('urn:maha:record:legacy-religion-translation-and-semantic-range', '01', tei, 'not-applicable', 'This record is a comparative-method synthesis about accountable representation, not an empirical effect claim.'),
    ],
  },
  {
    recordId: 'urn:maha:record:legacy-religion-historical-evidence',
    researchStatus: 'operator-researched-review-required',
    corrections: [
      sourceCorrection('source-publication-date-missing:legacy-religion-loc-primary-sources', loc, chronology('undated'), 'The Library of Congress guide page states no publication date.'),
      sourceCorrection('source-locator-missing:legacy-religion-loc-primary-sources', loc, '“Primary Source Analysis Tool for Students” and “Teacher’s Guides”; Observe, Reflect, and Question workflow.', 'The materials support source observation, reflection, questioning, and contextual inquiry but not every historiographic distinction in the imported claim.', '“Primary Source Analysis Tool for Students” and “Teacher’s Guides”; Observe, Reflect, and Question workflow.'),
      sourceCorrection('source-publication-date-missing:legacy-religion-icomos-charters', 'https://www.icomos.org/charters-and-doctrinal-texts/', chronology('living-document'), 'The ICOMOS index is maintained as new charters and language versions are added.'),
      sourceCorrection('source-locator-missing:legacy-religion-icomos-charters', 'https://www.icomos.org/charters-and-doctrinal-texts/', '“Charters and doctrinal texts”; “Heritage documentation”; and “Interpretation and presentation”, including the 1996 recording principles and 2008 interpretation charter.', 'The index establishes dated documentary and interpretation standards and their licensed versions, but not the full imported historical-inference proposition.', '“Charters and doctrinal texts”; “Heritage documentation”; and “Interpretation and presentation”, including the 1996 recording principles and 2008 interpretation charter.'),
      maturity('urn:maha:record:legacy-religion-historical-evidence', '01', loc, 'not-applicable', 'This is a methodological synthesis about historical reasoning; the cited source indexes and teaching tools do not constitute empirical replication evidence.'),
    ],
  },
  {
    recordId: 'urn:maha:record:legacy-religion-empirical-claims-and-study-design',
    researchStatus: 'operator-researched-review-required',
    corrections: [
      sourceCorrection('source-publication-date-missing:legacy-religion-nccih-meditation', 'https://www.nccih.nih.gov/health/meditation-and-mindfulness-effectiveness-and-safety', chronology('living-document', 'NCCIH publication last updated June 2022'), 'The NCCIH page reports only a month-level update, so no day is invented.'),
      sourceCorrection('source-locator-missing:legacy-religion-nccih-meditation', 'https://www.nccih.nih.gov/health/meditation-and-mindfulness-effectiveness-and-safety', '“What are meditation and mindfulness?”, “What are the health benefits?”, “Are meditation and mindfulness practices safe?”, and cited study/review lists.', 'The page demonstrates operational heterogeneity, comparator-dependent findings, risk-of-bias limits, and safety monitoring. It does not by itself specify every study-design field in the imported claim.', '“What are meditation and mindfulness?”, “What are the health benefits?”, “Are meditation and mindfulness practices safe?”, and cited study/review lists.'),
      sourceCorrection('source-publication-date-missing:legacy-religion-prisma-2020', 'https://www.prisma-statement.org/prisma-2020', chronology('living-document', 'PRISMA 2020 statement and reporting checklists'), 'The website is maintained around the 2020 statement and linked reporting artifacts; the landing page itself has no stable publication date.'),
      sourceCorrection('source-locator-missing:legacy-religion-prisma-2020', 'https://www.prisma-statement.org/prisma-2020', '“PRISMA 2020”; statement paper, explanation and elaboration paper, checklist, and flow-diagram links.', 'PRISMA supports transparent systematic-review reporting. It is not a general experimental-design standard and only partially supports the imported proposition.', '“PRISMA 2020”; statement paper, explanation and elaboration paper, checklist, and flow-diagram links.'),
      maturity('urn:maha:record:legacy-religion-empirical-claims-and-study-design', '01', 'https://www.prisma-statement.org/prisma-2020', 'not-applicable', 'The record is a methodological synthesis. NCCIH summarizes multiple studies, while PRISMA governs reporting, but neither is a bounded study testing this complete proposition.'),
    ],
  },
] as const

export const EPISTEMIC_PHASE4_SOURCE_PACKAGE_BOUNDARY = 'Operator source research fills typed chronology, locator, and evidence-status fields while preserving source mismatches. It is not an expert review, approval, empirical validation, or publication authorization.'

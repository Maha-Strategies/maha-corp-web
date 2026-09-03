/**
 * Supplier profiles name the processes they serve as `process-*` identifiers,
 * which are a different naming scheme from the process articles' own slugs.
 *
 * The generator once pasted the identifier straight into a route, so sixteen
 * supplier pages linked to `/knowledge/processes/process-plasma-etch` and
 * similar, none of which exist. Only two of the eighteen happened to line up.
 *
 * The correspondence is an identity between two names for the same process, not
 * a claim about either. An identifier with no article resolves to no link
 * rather than to a guess, and a test asserts every slug here still exists.
 */
export const PROCESS_ID_TO_SLUG: Readonly<Record<string, string>> = {
  'process-photolithography': 'photolithography',
  'process-thin-film-deposition': 'thin-film-deposition',
  'process-plasma-etch': 'plasma-etch-and-pattern-transfer',
  'process-ion-implantation-annealing': 'ion-implantation-and-annealing',
  'process-copper-interconnect-cmp': 'copper-interconnects-and-cmp',
  'process-advanced-packaging': 'advanced-packaging-and-heterogeneous-integration',
  'process-ic-design-tapeout': 'ic-design-to-tapeout',
  'process-rtl-to-physical-design': 'rtl-verification-synthesis-physical-design',
  'process-mask-data-reticle-fabrication': 'mask-data-preparation-and-reticle-fabrication',
  'process-silicon-wafer-preparation': 'silicon-crystal-growth-and-wafer-preparation',
  'process-wafer-cleaning-surface-preparation': 'wafer-cleaning-and-surface-preparation',
  'process-thermal-oxidation-diffusion': 'thermal-oxidation-diffusion-and-furnace-processing',
  'process-wafer-sort': 'wafer-acceptance-test-and-wafer-sort',
  'process-wafer-thinning-dicing': 'wafer-thinning-dicing-and-die-handling',
  'process-package-substrates-rdl': 'package-substrates-and-redistribution-layers',
  'process-wire-bond-flip-chip': 'wire-bonding-and-flip-chip-interconnect',
  'process-encapsulation-underfill-molding': 'underfill-molding-and-package-encapsulation',
  'process-final-burn-in-system-test': 'final-test-burn-in-and-system-level-test',
}

/** Resolve one declared process identifier to a route, or to nothing. */
export function processRoute(processId: string): string[] {
  const slug = PROCESS_ID_TO_SLUG[processId]
  return slug ? [`/knowledge/processes/${slug}`] : []
}

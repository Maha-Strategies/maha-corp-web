/** Owner-authorized five-product publication. Never infer a release from configuration. */
export const RELEASED_MICRO_IDS = [
  'citation-binding-check',
  'revision-lineage-check',
  'audit-export-normalizer',
  'unit-uncertainty-conversion',
  'divine-name-disambiguation',
] as const

export function isReleasedMicro(id: string): boolean {
  return (RELEASED_MICRO_IDS as readonly string[]).includes(id)
}

export function microExecutionAllowed(id: string, environment: string | undefined): boolean {
  if (environment === 'test' || environment === 'development') return true
  return (environment === 'preview' || environment === 'production') && isReleasedMicro(id)
}

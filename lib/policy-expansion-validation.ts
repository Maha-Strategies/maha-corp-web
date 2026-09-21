import type { PolicyDraft } from './policy-expansion-types.ts'
import { policySource } from './policy-expansion-sources.ts'

// This validates provenance structure, not the truth or sufficiency of a policy claim.
export function validatePolicyDraft(d: PolicyDraft) {
  if (!['draft option', 'undecided'].includes(d.status)) throw new Error('unapproved-position')
  if (d.costs.status !== 'uncosted') throw new Error('missing-cost-review')
  for (const claim of d.baseline) {
    if (['current-law', 'empirical-evidence', 'source-description', 'forecast'].includes(claim.kind) && !claim.sources.length) throw new Error('unsupported-baseline')
    for (const id of claim.sources) {
      policySource(id)
      if (!d.sources.includes(id)) throw new Error('unrendered-source')
    }
  }
  for (const actor of d.authority) {
    if (actor.status === 'source-bounded' && !actor.sources.length) throw new Error('unsupported-authority')
    for (const id of actor.sources) {
      policySource(id)
      if (!d.sources.includes(id)) throw new Error('unrendered-authority-source')
    }
  }
  for (const id of d.sources) {
    const s = policySource(id)
    if (!s.locator || !s.rights || !s.limitation || s.depth !== 'section') throw new Error('incomplete-source-packet')
  }
  if (!d.gaps.length || !d.reconsider.length || !d.outcomes.length || !d.authority.length) throw new Error('incomplete-options-brief')
  return true
}

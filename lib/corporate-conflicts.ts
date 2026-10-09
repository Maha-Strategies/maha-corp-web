type Module = { ruleId: string; layer: string; state: 'included' | 'excluded'; paragraph: string | null; disagreements: string[]; conflictsWith?: string[] }
/** Organize admitted evidence only. Never turn disagreement into a net score. */
export function synthesizeCorporateEvidence(entries: readonly Module[]) {
  const included = entries.filter(e => e.state === 'included' && e.paragraph)
  const conflicts = included.flatMap(a => (a.conflictsWith ?? []).flatMap(id => {
    const b = included.find(e => e.ruleId === id)
    return b ? [{ ruleIds: [a.ruleId, b.ruleId].sort(), status: 'unresolved', explanation: 'Both exact rules apply and declare a conflict. Neither cancels the other; no combined outcome is emitted.' }] : []
  }))
  return {
    status: 'evidence-preserving-index',
    groups: (['traditional', 'maha-reflective'] as const).map(layer => ({ layer, includedRuleIds: included.filter(m => m.layer === layer).map(m => m.ruleId), qualifications: included.filter(m => m.layer === layer).flatMap(m => m.disagreements) })),
    conflicts: [...new Map(conflicts.map(c => [c.ruleIds.join('|'), c])).values()],
    explanation: 'Different categories and reflective prompts remain separate. Declared conflicts stay unresolved. No strength voting, favorable/unfavorable net score or event prediction is inferred. An absent or excluded module cannot contribute to synthesis.',
  }
}

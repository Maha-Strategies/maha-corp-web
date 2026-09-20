export type PolicySearchEntry = { title: string; description: string; href: string; area: string; label: string }
export function filterPolicyEntries(entries: PolicySearchEntry[], query: string, area: string) {
  const normalize = (s: string) => s.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  const words = normalize(query.trim()).split(/\s+/).filter(Boolean)
  return entries.filter(entry => (area === 'all' || entry.area === area)
    && words.every(word => normalize(`${entry.title} ${entry.description} ${entry.label}`).includes(word)))
}

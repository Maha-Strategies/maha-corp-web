export function transitShortcutDate(baseDate: string, shortcut: 'today' | '30days' | '6months' | 'feb2027') {
  const date = new Date(`${baseDate}T12:00:00.000Z`)
  if (!Number.isFinite(date.getTime())) throw new Error('invalid_date')
  if (shortcut==='feb2027') return '2027-02-01'
  if (shortcut==='30days') date.setUTCDate(date.getUTCDate()+30)
  if (shortcut==='6months') {
    const day=date.getUTCDate();date.setUTCDate(1);date.setUTCMonth(date.getUTCMonth()+6)
    const end=new Date(Date.UTC(date.getUTCFullYear(),date.getUTCMonth()+1,0)).getUTCDate();date.setUTCDate(Math.min(day,end))
  }
  return date.toISOString().slice(0,10)
}

/**
 * Wall-clock time in a named zone → UTC instant.
 *
 * Birth data is given as a local wall time, and the offset that applied at that
 * date is a historical fact, not a constant: it moves with daylight saving and
 * with legislative changes. Getting it wrong shifts the instant by an hour or
 * more, which is enough to change the nakshatra, so the conversion is done
 * against the platform time-zone database rather than by asking for an offset.
 *
 * Two edge cases are surfaced rather than resolved silently:
 *
 *   ambiguous — the wall time occurs twice (clocks went back)
 *   nonexistent — the wall time never occurs (clocks went forward)
 */

export type CivilTimeFold = 'unambiguous' | 'earlier-offset' | 'later-offset'

export interface ZonedResolution {
  instant: Date
  /** Offset actually applied, in signed HH:MM form. */
  utcOffset: string
  fold: CivilTimeFold
  /** Set when the wall time does not exist in the zone; the instant is then the post-transition reading. */
  nonexistent: boolean
}

export class ZonedTimeError extends Error {}

/** Offset of a zone at a given instant, in minutes east of UTC. */
function offsetMinutesAt(instant: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(instant)

  const field = (type: string) => Number(parts.find((part) => part.type === type)?.value)
  // Intl renders hour 24 for midnight under hour12:false in some engines.
  const hour = field('hour') % 24
  const asUtc = Date.UTC(field('year'), field('month') - 1, field('day'), hour, field('minute'), field('second'))
  return Math.round((asUtc - instant.getTime()) / 60_000)
}

function formatOffset(minutes: number): string {
  const sign = minutes < 0 ? '-' : '+'
  const absolute = Math.abs(minutes)
  return `${sign}${String(Math.floor(absolute / 60)).padStart(2, '0')}:${String(absolute % 60).padStart(2, '0')}`
}

export function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone })
    return true
  } catch {
    return false
  }
}

/**
 * @param date `YYYY-MM-DD`
 * @param time `HH:MM`24-hour
 */
export function zonedWallTimeToUtc(date: string, time: string, timeZone: string): ZonedResolution {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new ZonedTimeError('Date must be YYYY-MM-DD.')
  if (!/^\d{2}:\d{2}$/.test(time)) throw new ZonedTimeError('Time must be HH:MM on a 24-hour clock.')
  if (!isValidTimeZone(timeZone)) throw new ZonedTimeError(`Unknown time zone: ${timeZone}`)

  const [year, month, day] = date.split('-').map(Number)
  const [hour, minute] = time.split(':').map(Number)
  if (month < 1 || month > 12 || day < 1 || day > 31 || hour > 23 || minute > 59) throw new ZonedTimeError('Date or time is out of range.')

  const wallAsUtc = Date.UTC(year, month - 1, day, hour, minute)

  // Both offsets around a transition can map to this wall time (clocks back),
  // or neither can (clocks forward). Probe a day either side and keep whichever
  // offsets actually read back as the requested wall time.
  const before = offsetMinutesAt(new Date(wallAsUtc - 86_400_000), timeZone)
  const after = offsetMinutesAt(new Date(wallAsUtc + 86_400_000), timeZone)

  const readsBack = (offset: number) => {
    const instant = new Date(wallAsUtc - offset * 60_000)
    return offsetMinutesAt(instant, timeZone) === offset
  }

  const valid = [...new Set([before, after])].filter(readsBack).sort((a, b) => b - a)

  if (valid.length === 0) {
    // Nonexistent wall time: the clocks jumped over it. Report the instant the
    // post-transition offset yields, and say so.
    const offset = Math.max(before, after)
    return { instant: new Date(wallAsUtc - offset * 60_000), utcOffset: formatOffset(offset), fold: 'unambiguous', nonexistent: true }
  }

  if (valid.length > 1) {
    // Ambiguous: default to the earlier occurrence, which is the larger offset.
    const offset = valid[0]
    return { instant: new Date(wallAsUtc - offset * 60_000), utcOffset: formatOffset(offset), fold: 'earlier-offset', nonexistent: false }
  }

  const offset = valid[0]
  return { instant: new Date(wallAsUtc - offset * 60_000), utcOffset: formatOffset(offset), fold: 'unambiguous', nonexistent: false }
}

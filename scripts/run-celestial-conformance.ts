import { CONFORMANCE_LIMITS, loadCelestialConformanceCorpus, summarizeCelestialConformance } from '../lib/celestial-conformance.ts'

async function main() {
  const summary = summarizeCelestialConformance(await loadCelestialConformanceCorpus())
  const failures = [
    summary.maxima.planetLongitudeErrorDegrees > CONFORMANCE_LIMITS.planetLongitudeDegrees ? 'planet longitude' : null,
    summary.maxima.sunLongitudeErrorDegrees > CONFORMANCE_LIMITS.sunLongitudeDegrees ? 'Sun longitude' : null,
    summary.maxima.moonLongitudeErrorDegrees > CONFORMANCE_LIMITS.moonLongitudeDegrees ? 'Moon longitude' : null,
    summary.maxima.ayanamsaErrorDegrees > CONFORMANCE_LIMITS.ayanamsaDegrees ? 'Lahiri ayanamsa' : null,
    summary.maxima.ascendantErrorDegrees > CONFORMANCE_LIMITS.ascendantDegrees ? 'ascendant' : null,
    summary.maxima.sunriseErrorMinutes > CONFORMANCE_LIMITS.solarEventMinutes ? 'sunrise' : null,
    summary.maxima.sunsetErrorMinutes > CONFORMANCE_LIMITS.solarEventMinutes ? 'sunset' : null,
    summary.disagreements.length ? 'stable classifications' : null,
  ].filter((value): value is string => value !== null)
  if (process.argv.includes('--json')) console.log(JSON.stringify({ ...summary, passed: failures.length === 0, failures }, null, 2))
  else {
    console.log(`Celestial conformance ${summary.corpusVersion}: ${summary.caseCount} independently generated cases`)
    console.log(`Planet longitude max: ${summary.maxima.planetLongitudeErrorDegrees.toFixed(6)}°`)
    console.log(`Sun / Moon max: ${summary.maxima.sunLongitudeErrorDegrees.toFixed(6)}° / ${summary.maxima.moonLongitudeErrorDegrees.toFixed(6)}°`)
    console.log(`Lahiri / ascendant max: ${summary.maxima.ayanamsaErrorDegrees.toFixed(6)}° / ${summary.maxima.ascendantErrorDegrees.toFixed(6)}°`)
    console.log(`Sunrise / sunset max: ${summary.maxima.sunriseErrorMinutes.toFixed(3)} / ${summary.maxima.sunsetErrorMinutes.toFixed(3)} minutes`)
    console.log(failures.length ? `FAIL: ${failures.join(', ')}` : 'PASS')
  }
  if (failures.length) process.exitCode = 1
}

if (process.argv[1]?.endsWith('run-celestial-conformance.ts')) main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})

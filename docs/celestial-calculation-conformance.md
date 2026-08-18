# Celestial calculation conformance

This suite tests Maha's calculations against a frozen, independently generated corpus. It validates arithmetic and declared conventions; it does not validate astrological interpretation or predictive claims.

## Coverage

The 180 cases include:

| Family | Cases | Purpose |
| --- | ---: | --- |
| Global baseline | 64 | Eight dates from 1600–2099 at eight northern/southern and eastern/western locations |
| DST folds and gaps | 16 | UTC instants bracketing four civil-time transition patterns, including Lord Howe's 30-minute transitions |
| Polar solar events | 16 | Summer and winter geometry at eight high-latitude locations |
| New and full moons | 24 | Exact Sun–Moon longitude crossings across 1900–2099 |
| Planetary stations | 20 | Four zero-speed crossings for each of Mercury, Venus, Mars, Jupiter, and Saturn |
| Sidereal ascendant boundaries | 20 | Exact Lahiri sign crossings at five global locations |
| Nakshatra boundaries | 10 | Exact Swiss Lahiri lunar-division crossings |
| Tithi boundaries | 10 | Exact 12-degree elongation crossings |

The checked-in fixture is `test/fixtures/celestial-conformance-v1.json`. Its manifest retains engine and binding versions, source URLs, and SHA-256 hashes for every data file. The generator refuses the reference engine's silent Moshier fallback. Two 2026 phase cases are also tied to the independent US Naval Observatory phase API, whose values are published to minute precision.

Run the offline suite with:

```sh
npm run celestial:conformance
```

Regeneration is an editorial release operation, not an install or CI step. It requires Python, the exactly pinned `pyswisseph==2.10.3.2`, and the four files whose digests are frozen in the manifest:

```sh
python scripts/generate-celestial-conformance-corpus.py --ephemeris-dir /path/to/ephe
```

## Frozen result

For corpus version `2026-08-17.1`, Astronomy Engine 2.1.19 produced these maximum differences:

| Quantity | Maximum difference | Release envelope |
| --- | ---: | ---: |
| Any classical longitude | 0.018021° | 0.020° |
| Sun longitude | 0.001361° | 0.005° |
| Moon longitude | 0.018021° | 0.020° |
| Lahiri ayanamsa | 0.004123° | 0.010° |
| Tropical ascendant | 0.016104° | 0.020° |
| Sunrise | 0.246 minutes | 10 minutes |
| Sunset | 0.246 minutes | 10 minutes |

The test found and fixed a polar ascendant branch defect: four cases had selected the western antipode and were almost exactly 180° wrong. Those cases remain frozen regressions.

## Convention-related differences

These are expected methodological differences, not evidence that either implementation is numerically defective:

- Maha's Lahiri value is an explicit J2000 anchor advanced with an IAU 2006 precession polynomial. The reference uses `SIDM_LAHIRI`; their zero-point implementations differ by up to 0.004123° in this corpus. Tithi and karana are unaffected because ayanamsa cancels from Sun–Moon elongation.
- Maha labels motion from a forward 24-hour longitude difference and calls values below 0.01°/day stationary. The reference stores instantaneous longitude speed. Station cases therefore do not require label agreement; ordinary cases do.
- New moons, full moons, tithis, nakshatras, and ascendants exactly on boundaries do not have a stable discrete classification. Boundary fixtures compare continuous geometry and deliberately make the floor-based label non-normative.
- The reference rise/set calculation uses standard apparent upper-limb events at 15°C and inferred sea-level pressure. Astronomy Engine has its own refraction and solar-disc model. Event times are compared with a declared ten-minute envelope, while circumpolar null/non-null behavior must agree exactly.
- The largest lunar difference occurs near the corpus time-range extremes and reflects different ephemeris/time-scale models. It is retained as a 0.020° uncertainty envelope rather than hidden by printed precision.
- DST gaps do not correspond to an instant, and folds correspond to two. The corpus stores unambiguous UTC instants around those transitions; timezone parsing must be tested separately against a pinned IANA tzdb release.
- Swiss house cusp systems can fail inside the polar circles even though the ecliptic–horizon intersections remain calculable. The generator requests whole-sign mode only to obtain the ascendant; it does not compare Placidus cusps.

No disagreement is waived merely because it changes an astrological category. Values outside the release envelopes fail CI and require either a calculation fix, a new independently justified convention, or a versioned corpus update.

## Licensing boundary

Swiss Ephemeris uses AGPL/commercial dual licensing. Its package and data files are not application dependencies, are not bundled, and are not called by production or CI. The frozen fixture remains internal test material. Publishing or commercializing that reference output requires licensing review; a public benchmark should instead be regenerated directly from appropriately licensed/public-domain JPL and USNO data or covered by a professional license. Maha's production calculation path remains Astronomy Engine under the MIT license.

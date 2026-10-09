#let d = json(sys.inputs.at("data", default: "data.json"))
#set page(paper: "a4", margin: (x: 20mm, y: 19mm), footer: context [#text(size: 8pt, fill: rgb("776a59"))[MAHA STRATEGIES · PRIVATE DOSSIER #h(1fr) #counter(page).display("1 / 1", both: true)]])
#set text(font: ("Georgia", "DejaVu Serif"), size: 10pt, fill: rgb("242b31"))
#set par(leading: 0.55em)
#set heading(numbering: none)
#show heading.where(level: 1): it => block(above: 12pt, below: 16pt)[#text(size: 25pt, fill: rgb("756043"))[#it.body]]
#show heading.where(level: 2): it => block(above: 12pt, below: 7pt)[#text(size: 15pt)[#it.body]]
#let val(x) = if x == none { "—" } else { str(x) }
#let tbl(headers, rows, sizes: auto, small: 8.2pt) = {
  set text(size: small, font: ("Arial", "DejaVu Sans"))
  table(columns: if sizes == auto { headers.len() } else { sizes }, inset: 4pt, stroke: (bottom: 0.4pt + rgb("d8d0c3")), fill: (x, y) => if y == 0 { rgb("eae4da") } else { none }, table.header(..headers.map(h => text(weight: "bold", h))), ..rows.flatten().map(x => text(val(x))))
}
#let title(n, t) = [#text(size: 8pt, tracking: 1pt)[MAHA JYOTISHA / EXECUTIVE #n] #line(length: 100%, stroke: 0.6pt + rgb("ab9575")) #heading(t)]
#let date(x) = x.slice(0, 10)
#title("01", "Strategic Epistemic Jyotisha")
#v(35mm)
#text(size: 37pt)[Geometry with provenance.]
#v(12mm)
A private executive dossier for a declared chart moment. Astronomical coordinates are computed; traditional formulations are identified; operational suggestions remain optional and evidence-dependent.
#v(12mm)
#tbl(("Declared birth instant", "Evaluation instant"), ((d.instantUtc, d.reference),))
#v(8mm)
#text(size: 9pt)[#d.boundary]
#v(1fr)
#text(size: 8pt)[VERSION #d.version \ RECEIPT #d.receipt]
#pagebreak()
#title("02", "Astronomical baseline")
#tbl(("Quantity", "Value"), (("Latitude", d.latitude), ("Longitude", d.longitude), ("Time uncertainty ± minutes", d.uncertainty), ("GMST degrees", d.baseline.gmstDegrees), ("Apparent sidereal degrees", d.baseline.apparentSiderealDegrees), ("RAMC degrees", d.baseline.ramcDegrees), ("Lahiri ayanamsa degrees", d.baseline.ayanamsaDegrees)))
#heading(level: 2)[Calculation profile]
Lahiri sidereal zodiac; whole-sign houses; mean lunar nodes; apparent geocentric ecliptic coordinates from the existing astronomy-engine implementation. The degrees are reproducible outputs under declared conventions, not independently observed precision guarantees.
#d.baseline.note
#heading(level: 2)[Verification digest]
#text(size: 8pt)[#d.receipt]
This receipt identifies the calculation payload. It is not a digital practitioner approval, a proof of predictive performance, or a guarantee about any future event.
#pagebreak()
#title("03", "Panchanga derivation checks")
#let p = d.baseline.panchanga
#tbl(("Limb", "Calculated value", "Derivation"), (("Tithi", p.tithi.name, "floor(normalized Moon − Sun / 12°) + 1"), ("Nakshatra", p.nakshatra.name, "floor(sidereal Moon / (360°/27)) + 1"), ("Yoga", p.yoga.name, "floor(normalized sidereal Sun + Moon / (360°/27)) + 1"), ("Karana", p.karana.name, "6° half-tithi with declared name mapping"), ("Vara", p.vara.name, "Declared sunrise-based weekday convention")))
#heading(level: 2)[Angles used]
#tbl(("Angle", "Degrees"), (("Tropical Sun", p.sunLongitudeTropical), ("Tropical Moon", p.moonLongitudeTropical), ("Sidereal Sun", p.sunLongitudeSidereal), ("Sidereal Moon", p.moonLongitudeSidereal), ("Elongation", p.elongation)))
#heading(level: 2)[Boundary sensitivity]
#p.ayanamsa.accuracyNote
#text()[Uncertain limbs: #if p.uncertainLimbs.len() == 0 { [none flagged at nominal instant] } else { p.uncertainLimbs.join(", ") }]
These are calendrical derivations. Auspiciousness, suitability and outcome are not limb proofs.
#pagebreak()
#title("04", "D1 sidereal placements")
#tbl(("Point", "Sign", "Degree", "House", "Nakshatra", "Motion"), d.d1.map(p => (p.name, p.sign, p.degree, p.house, p.nakshatra, p.motion)))
#align(center, image(bytes(d.d1Wheel), format: "svg", width: 85mm, alt: "D1 wheel with whole-sign house boundaries"))
#heading(level: 2)[Reading the table]
Wheel labels are separated for legibility; leader dots mark exact longitudes. House positions use the sign of the ascendant as the entire first house. A sign assignment is distinct from a quadrant cusp. Modern outer planets remain outside the classical formation engine.
#pagebreak()
#title("05", "D9 coordinate mapping")
#tbl(("Point", "D9 sign", "Degree", "D9 house"), d.d9.map(p => (p.name, p.sign, calc.round(p.degreeInSign, digits: 4), p.house)))
#align(center, image(bytes(d.d9Wheel), format: "svg", width: 85mm, alt: "D9 wheel with divisional whole-sign house boundaries"))
#heading(level: 2)[Declared convention]
Wheel labels are separated for legibility; leader dots mark exact divisional longitudes. Each sidereal longitude is multiplied by nine modulo 360 degrees. D9 houses are counted from the D9 ascendant sign. These are divisional coordinates, not a second observed sky. D1 house meanings do not automatically transfer to D9, and this table predicts no marriage or capability.
#pagebreak()
#title("06", "Whole-sign houses and lordships")
#tbl(("House", "Sign", "Lord", "Lord house", "Lord sign"), d.lordships.map(h => (h.house, h.sign, h.lord, h.lordPlacementHouse, h.lordSign)))
#heading(level: 2)[House boundaries]
Each house spans its entire sidereal sign, from 0 to 30 degrees within that sign. The ascendant’s exact degree is retained separately; no unequal-house cusp is manufactured here.
#pagebreak()
#title("07", "Relational aspect vectors")
#tbl(("Source", "From H", "Count", "Target H / sign", "Occupants"), d.aspects.map(a => (a.sourcePlanet, a.sourceHouse, a.aspectDegree, str(a.targetHouse) + " / " + a.targetSign, a.targetPlanets.join(", "))), small: 7.8pt)
#text(size: 8pt)[Counts are inclusive whole-sign distances. Nodal 5/7/9 aspects use a disputed requested convention. No degree-strength scale or physical influence is inferred.]
#pagebreak()
#title("08", "Yoga formation matrix I")
#let half = calc.ceil(d.yogas.len() / 2)
#let yoga-table(rows) = tbl(("Formation", "Bodies", "Screen", "Criteria"), rows.map(y => (y.name, y.planets.join(" / "), if y.detected { "MATCH" } else { "not matched" }, y.criteria)), sizes: (1.4fr, 0.8fr, 0.7fr, 2.5fr))
#yoga-table(d.yogas.slice(0, half))
#text(size: 8pt)[Matched criteria are geometric candidates. No formation in this matrix is activated as a reviewed interpretation.]
#pagebreak()
#title("09", "Yoga formation matrix II")
#yoga-table(d.yogas.slice(half))
#heading(level: 2)[Strength and exceptions]
No Shadbala score is estimated. Gaja-Kesari is preliminary geometry: benefic association, combustion and inimical-sign exclusions are not certified. Dhana uses the requested broad lord-association screen. Mahapurusha and Viparita exact source formalizations remain pending; exclusivity and cancellation rules are not silently assumed.
#pagebreak()
#title("10", "Five-year period schedule I")
#let timeline-half = calc.ceil(d.periods.rows.len() / 2)
#let period-table(rows) = tbl(("Maha", "Bhukti", "Pratyantar", "From UTC", "To UTC"), rows.map(r => (r.maha, r.bhukti, r.pratyantar, date(r.startUtc), date(r.endUtc))), small: 7.7pt)
#period-table(d.periods.rows.slice(0, timeline-half))
#text(size: 8pt)[Calendar dates are display abbreviations; machine-readable report records retain UTC timestamps.]
#pagebreak()
#title("11", "Five-year period schedule II")
#period-table(d.periods.rows.slice(timeline-half))
#text(size: 8pt)[#d.periods.boundary \ Full five-year coverage: #d.periods.completeHorizon. Birth balance uses actual lunar nakshatra stay time; subdivisions use the 120-year proportional convention and 365.2425-day years.]
#pagebreak()
#title("12", "Slow-planet ingress timeline")
#tbl(("Planet", "From sign", "To sign", "UTC boundary estimate"), d.ingresses.map(i => (i.planet, i.from, i.to, i.instantUtc)))
#heading(level: 2)[Method and correlation]
Jupiter, Saturn and the mean-node axis are sampled daily, with sign changes refined to a bracket no wider than one minute. Retrograde returns are retained. This is a slow-planet boundary search, not a full all-planet event catalog or an interval proof of every possible crossing. Compare these dates with the period schedule as two declared timing layers; coincidence establishes no event probability.
#pagebreak()
#title("13", "Founder and entity structure")
#if d.synastry == none {
  [No secondary chart was included. This section records the absence rather than inventing a corporate or partner profile.]
} else {
  [#text(weight: "bold")[#d.synastry.label] \ #d.synastry.boundary]
  heading(level: 2)[House alignment]
  tbl(("Secondary H", "Sign", "Founder H"), d.synastry.houseAlignment.map(r => (r.secondaryHouse, r.secondarySign, r.founderHouse)))
  grid(columns: (1fr, 1fr), gutter: 8pt,
    [#heading(level: 2)[Secondary → founder] #tbl(("Body", "Sign", "From H", "To H"), d.synastry.secondaryInFounder.map(r => (r.planet, r.sourceSign, r.sourceHouse, r.targetHouse)), small: 7pt)],
    [#heading(level: 2)[Founder → secondary] #tbl(("Body", "Sign", "From H", "To H"), d.synastry.founderInSecondary.map(r => (r.planet, r.sourceSign, r.sourceHouse, r.targetHouse)), small: 7pt)],
  )
  [Lagna relation: #d.synastry.lagna.configuration. Moon distance counts: #d.synastry.moons.forwardCount / #d.synastry.moons.reverseCount. No harmony score is activated.]
}
#pagebreak()
#title("14", "Executive planning directives")
#for directive in d.directives { heading(level: 2, directive.title); text(directive.text); v(9pt) }
#heading(level: 2)[A review protocol]
Define the decision → collect independent evidence → choose a reversible experiment → set a stop rule → review the observed result. A symbolic timing lens may organize the discussion; evidence and responsibility govern the decision.
#pagebreak()
#title("15", "Source trace and limits")
#for source in d.sources { block(above: 8pt)[#text(weight: "bold", size: 9pt)[#source.title] \ #text(size: 8pt)[#source.locator] \ #text(size: 7pt)[#source.url]] }
#heading(level: 2)[Formation source qualifications]
#text(size: 8pt)[Rāja association: Chapter 41, verse 28 (sign-level screening adaptation). Gaja-Kesari: Chapter 36, verses 3–4 (additional conditions not certified). Dhana broad 1/2/5/9/11 association: exact generic pair rule not verified. Mahapurusha and named Viparita: exact edition passages and exceptions pending verification.]
#heading(level: 2)[Registry boundary]
Calculation-convention references are not cleared source passages or practitioner approvals. The formation matrix exposes requested screens and missing qualifications. No unsupported classical outcome is republished as an active rule.
#heading(level: 2)[Responsibility and privacy]
#d.boundary
The dossier contains private chart data. Keep the downloaded file secure. Paid vault snapshots are encrypted at rest and retrieved through account authorization, never published to a public dossier directory.

#!/usr/bin/env python3
"""Generate the frozen celestial conformance corpus from Swiss Ephemeris.

This is an editorial/release tool, not a runtime dependency. It deliberately
refuses Swiss Ephemeris' silent Moshier fallback so the checked-in values have
the data-file provenance declared in the corpus manifest.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import math
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Callable

import swisseph as swe

UTC = timezone.utc
FLAGS = swe.FLG_SWIEPH | swe.FLG_SPEED
BODIES = {
    "Sun": swe.SUN,
    "Moon": swe.MOON,
    "Mercury": swe.MERCURY,
    "Venus": swe.VENUS,
    "Mars": swe.MARS,
    "Jupiter": swe.JUPITER,
    "Saturn": swe.SATURN,
}
DATA_FILES = ("sepl_12.se1", "semo_12.se1", "sepl_18.se1", "semo_18.se1")
LOCATIONS = (
    ("greenwich", 51.4779, 0.0),
    ("chennai", 13.0827, 80.2707),
    ("colombo", 6.9271, 79.8612),
    ("international-falls", 48.601, -93.411),
    ("quito", -0.1807, -78.4678),
    ("sydney", -33.8688, 151.2093),
    ("cape-town", -33.9249, 18.4241),
    ("reykjavik", 64.1466, -21.9426),
)


def iso(dt: datetime) -> str:
    return dt.astimezone(UTC).isoformat(timespec="milliseconds").replace("+00:00", "Z")


def jd(dt: datetime) -> float:
    value = dt.astimezone(UTC)
    hour = value.hour + value.minute / 60 + value.second / 3600 + value.microsecond / 3_600_000_000
    return swe.julday(value.year, value.month, value.day, hour, swe.GREG_CAL)


def from_jd(value: float) -> datetime:
    year, month, day, hour = swe.revjul(value, swe.GREG_CAL)
    base = datetime(year, month, day, tzinfo=UTC)
    return base + timedelta(hours=hour)


def norm(value: float) -> float:
    return value % 360


def angle_delta(first: float, second: float) -> float:
    return (first - second + 180) % 360 - 180


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def position(body: int, moment_jd: float) -> tuple[float, float]:
    values, returned = swe.calc_ut(moment_jd, body, FLAGS)
    if not returned & swe.FLG_SWIEPH or returned & swe.FLG_MOSEPH:
        raise RuntimeError(f"Swiss Ephemeris data-file calculation required; flags were {returned}")
    return values[0], values[3]


def ayanamsa(moment_jd: float) -> float:
    swe.set_sid_mode(swe.SIDM_LAHIRI)
    return swe.get_ayanamsa_ut(moment_jd)


def next_rise_or_set(moment_jd: float, longitude: float, latitude: float, mode: int) -> float | None:
    result, times = swe.rise_trans(moment_jd, swe.SUN, mode, (longitude, latitude, 0.0), 0.0, 15.0, swe.FLG_SWIEPH)
    return times[0] if result == 0 else None


def previous_sunrise(moment_jd: float, longitude: float, latitude: float) -> float | None:
    candidate = next_rise_or_set(moment_jd - 2.0, longitude, latitude, swe.CALC_RISE)
    latest = None
    while candidate is not None and candidate <= moment_jd:
        latest = candidate
        candidate = next_rise_or_set(candidate + 1 / 86_400, longitude, latitude, swe.CALC_RISE)
    return latest


def next_sunset(moment_jd: float, longitude: float, latitude: float) -> float | None:
    return next_rise_or_set(moment_jd, longitude, latitude, swe.CALC_SET)


def bisect_crossing(fn: Callable[[float], float], left: float, right: float, target: float) -> float:
    left_value = angle_delta(fn(left), target)
    for _ in range(60):
        middle = (left + right) / 2
        middle_value = angle_delta(fn(middle), target)
        if abs(middle_value) < 1e-10:
            return middle
        if left_value * middle_value <= 0:
            right = middle
        else:
            left, left_value = middle, middle_value
    return (left + right) / 2


def next_angle_crossing(fn: Callable[[float], float], start: float, target: float, limit_days: float, step: float) -> float:
    left = start
    left_value = angle_delta(fn(left), target)
    count = math.ceil(limit_days / step)
    for _ in range(count):
        right = left + step
        right_value = angle_delta(fn(right), target)
        if left_value <= 0 < right_value and right_value - left_value < 90:
            return bisect_crossing(fn, left, right, target)
        left, left_value = right, right_value
    raise RuntimeError(f"No {target} degree crossing found after JD {start}")


def bisection_scalar(fn: Callable[[float], float], left: float, right: float) -> float:
    left_value = fn(left)
    for _ in range(60):
        middle = (left + right) / 2
        middle_value = fn(middle)
        if abs(middle_value) < 1e-12:
            return middle
        if left_value * middle_value <= 0:
            right = middle
        else:
            left, left_value = middle, middle_value
    return (left + right) / 2


def ascendant(moment_jd: float, latitude: float, longitude: float) -> float:
    # The ascendant is independent of house-system cusp division. Whole-sign
    # mode avoids Placidus' expected failure inside the polar circles.
    return swe.houses_ex(moment_jd, latitude, longitude, b"W", 0)[1][0]


def reference(moment: datetime, location: tuple[str, float, float]) -> dict[str, Any]:
    location_id, latitude, longitude = location
    moment_jd = jd(moment)
    positions = {}
    for name, body in BODIES.items():
        longitude_value, speed = position(body, moment_jd)
        positions[name] = {"longitudeDegrees": round(longitude_value, 9), "speedDegreesPerDay": round(speed, 9)}
    lahiri = ayanamsa(moment_jd)
    moon = positions["Moon"]["longitudeDegrees"]
    sun = positions["Sun"]["longitudeDegrees"]
    elongation = norm(moon - sun)
    moon_sidereal = norm(moon - lahiri)
    rise = previous_sunrise(moment_jd, longitude, latitude)
    sunset = next_sunset(moment_jd, longitude, latitude)
    return {
        "julianDayUt": round(moment_jd, 9),
        "ayanamsaLahiriDegrees": round(lahiri, 9),
        "ascendantTropicalDegrees": round(ascendant(moment_jd, latitude, longitude), 9),
        "positions": positions,
        "derived": {
            "elongationDegrees": round(elongation, 9),
            "tithiAbsoluteIndex": math.floor(elongation / 12) + 1,
            "nakshatraIndex": math.floor(moon_sidereal / (360 / 27)) + 1,
        },
        "solarEvents": {
            "previousSunriseUtc": iso(from_jd(rise)) if rise is not None else None,
            "nextSunsetUtc": iso(from_jd(sunset)) if sunset is not None else None,
            "model": "Swiss Ephemeris standard apparent upper-limb rise/set; pressure inferred from altitude=0m; 15C",
        },
        "locationId": location_id,
    }


def make_case(case_id: str, tags: list[str], moment: datetime, location: tuple[str, float, float], note: str) -> dict[str, Any]:
    return {
        "id": case_id,
        "tags": tags,
        "instantUtc": iso(moment),
        "observer": {"latitudeDegrees": location[1], "longitudeDegrees": location[2], "elevationMeters": 0},
        "note": note,
        "reference": reference(moment, location),
    }


def build_cases() -> list[dict[str, Any]]:
    cases: list[dict[str, Any]] = []
    baseline_dates = (
        datetime(1600, 3, 20, 12, tzinfo=UTC), datetime(1752, 9, 14, 12, tzinfo=UTC),
        datetime(1800, 1, 1, 0, tzinfo=UTC), datetime(1900, 1, 1, 0, tzinfo=UTC),
        datetime(1950, 6, 21, 12, tzinfo=UTC), datetime(2000, 1, 1, 12, tzinfo=UTC),
        datetime(2026, 8, 17, 6, tzinfo=UTC), datetime(2099, 12, 31, 18, tzinfo=UTC),
    )
    for date_index, moment in enumerate(baseline_dates):
        for location in LOCATIONS:
            cases.append(make_case(
                f"baseline-{date_index + 1:02d}-{location[0]}", ["baseline", "historical" if moment.year < 1950 else "modern", "global"],
                moment, location, "Regular geometry sample across era, latitude, longitude, and hemisphere.",
            ))

    dst_samples = (
        ("new-york-gap-before", "2024-03-10T06:59:00Z", 40.7128, -74.0060),
        ("new-york-gap-after", "2024-03-10T07:01:00Z", 40.7128, -74.0060),
        ("new-york-fold-first", "2024-11-03T05:30:00Z", 40.7128, -74.0060),
        ("new-york-fold-second", "2024-11-03T06:30:00Z", 40.7128, -74.0060),
        ("london-gap-before", "2024-03-31T00:59:00Z", 51.5074, -0.1278),
        ("london-gap-after", "2024-03-31T01:01:00Z", 51.5074, -0.1278),
        ("london-fold-first", "2024-10-27T00:30:00Z", 51.5074, -0.1278),
        ("london-fold-second", "2024-10-27T01:30:00Z", 51.5074, -0.1278),
        ("sydney-fold-first", "2024-04-06T15:30:00Z", -33.8688, 151.2093),
        ("sydney-fold-second", "2024-04-06T16:30:00Z", -33.8688, 151.2093),
        ("sydney-gap-before", "2024-10-05T15:59:00Z", -33.8688, 151.2093),
        ("sydney-gap-after", "2024-10-05T16:01:00Z", -33.8688, 151.2093),
        ("lord-howe-fold-first", "2024-04-06T14:45:00Z", -31.5553, 159.0820),
        ("lord-howe-fold-second", "2024-04-06T15:15:00Z", -31.5553, 159.0820),
        ("lord-howe-gap-before", "2024-10-05T15:29:00Z", -31.5553, 159.0820),
        ("lord-howe-gap-after", "2024-10-05T15:31:00Z", -31.5553, 159.0820),
    )
    for name, value, latitude, longitude in dst_samples:
        location = (name.split("-")[0], latitude, longitude)
        cases.append(make_case(f"dst-{name}", ["dst", "fold" if "fold" in name else "gap"], datetime.fromisoformat(value.replace("Z", "+00:00")), location, "UTC instant adjacent to an IANA civil-time fold or gap; no ambiguous local time is accepted as input."))

    polar_locations = (("longyearbyen", 78.2232, 15.6469), ("tromso", 69.6492, 18.9553), ("utqiagvik", 71.2906, -156.7887), ("murmansk", 68.9585, 33.0827), ("mcmurdo", -77.8419, 166.6863), ("ushuaia", -54.8019, -68.3030), ("rovaniemi", 66.5039, 25.7294), ("inuvik", 68.3607, -133.7230))
    for location in polar_locations:
        for season, moment in (("june", datetime(2026, 6, 21, 12, tzinfo=UTC)), ("december", datetime(2026, 12, 21, 12, tzinfo=UTC))):
            cases.append(make_case(f"polar-{location[0]}-{season}", ["polar-sunrise", "polar-day-or-night"], moment, location, "High-latitude rise/set case; null is a valid circumpolar result."))

    def elongation_at(value: float) -> float:
        return norm(position(swe.MOON, value)[0] - position(swe.SUN, value)[0])

    phase_starts = [datetime(year, month, 1, tzinfo=UTC) for year, month in ((1900, 1), (1925, 6), (1950, 1), (1975, 6), (2000, 1), (2010, 6), (2020, 1), (2024, 6), (2026, 1), (2030, 6), (2050, 1), (2099, 6))]
    for index, start in enumerate(phase_starts):
        for name, target in (("new", 0.0), ("full", 180.0)):
            crossing = next_angle_crossing(elongation_at, jd(start), target, 35, 0.25)
            cases.append(make_case(f"phase-{index + 1:02d}-{name}", ["lunar-phase", f"{name}-moon", "tithi-boundary"], from_jd(crossing), LOCATIONS[1], "Swiss-derived exact geocentric ecliptic phase boundary; classification at the boundary is intentionally non-normative."))

    station_bodies = (("Mercury", swe.MERCURY), ("Venus", swe.VENUS), ("Mars", swe.MARS), ("Jupiter", swe.JUPITER), ("Saturn", swe.SATURN))
    for name, body in station_bodies:
        found = 0
        left = jd(datetime(2018, 1, 1, tzinfo=UTC))
        left_speed = position(body, left)[1]
        while found < 4:
            right = left + 1
            right_speed = position(body, right)[1]
            if left_speed * right_speed < 0:
                crossing = bisection_scalar(lambda value: position(body, value)[1], left, right)
                cases.append(make_case(f"station-{name.lower()}-{found + 1:02d}", ["planetary-station", "retrograde-boundary", name.lower()], from_jd(crossing), LOCATIONS[0], "Instantaneous Swiss longitude speed is zero; Maha uses a forward 24-hour finite difference, so the stationary label may legitimately differ."))
                found += 1
            left, left_speed = right, right_speed
            if left > jd(datetime(2032, 1, 1, tzinfo=UTC)):
                raise RuntimeError(f"Could not find four stations for {name}")

    asc_locations = (LOCATIONS[0], LOCATIONS[1], LOCATIONS[3], LOCATIONS[4], LOCATIONS[5])
    for index in range(20):
        location = asc_locations[index % len(asc_locations)]
        start = jd(datetime(2026, 1 + index % 12, 1 + index % 20, index % 24, tzinfo=UTC))
        latitude, longitude = location[1], location[2]
        left = start
        left_sign = math.floor(norm(ascendant(left, latitude, longitude) - ayanamsa(left)) / 30)
        while True:
            right = left + 1 / 720
            right_sign = math.floor(norm(ascendant(right, latitude, longitude) - ayanamsa(right)) / 30)
            if right_sign != left_sign:
                for _ in range(50):
                    middle = (left + right) / 2
                    middle_sign = math.floor(norm(ascendant(middle, latitude, longitude) - ayanamsa(middle)) / 30)
                    if middle_sign == left_sign:
                        left = middle
                    else:
                        right = middle
                crossing = (left + right) / 2
                break
            left, left_sign = right, right_sign
        cases.append(make_case(f"ascendant-boundary-{index + 1:02d}", ["ascendant-boundary", "sidereal-sign-boundary"], from_jd(crossing), location, "Lahiri-sidereal ascendant lies on a sign boundary; sign classification is intentionally non-normative."))

    for index in range(10):
        start = jd(datetime(2026, 1 + index, 1, tzinfo=UTC))
        target = (index * 3 % 27) * (360 / 27)
        crossing = next_angle_crossing(lambda value: norm(position(swe.MOON, value)[0] - ayanamsa(value)), start, target, 30, 0.05)
        cases.append(make_case(f"nakshatra-boundary-{index + 1:02d}", ["nakshatra-boundary", "sidereal-limb-boundary"], from_jd(crossing), LOCATIONS[1], "Swiss Lahiri Moon lies on a nakshatra boundary; index classification is intentionally non-normative."))
    for index in range(10):
        start = jd(datetime(2027, 1 + index, 1, tzinfo=UTC))
        target = (index * 3 % 30) * 12
        crossing = next_angle_crossing(elongation_at, start, target, 35, 0.1)
        cases.append(make_case(f"tithi-boundary-{index + 1:02d}", ["tithi-boundary", "lunar-elongation-boundary"], from_jd(crossing), LOCATIONS[1], "Sun-Moon elongation lies on a tithi boundary; index classification is intentionally non-normative."))

    if len(cases) != 180:
        raise RuntimeError(f"Expected 180 cases, generated {len(cases)}")
    return cases


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--ephemeris-dir", required=True, type=Path)
    parser.add_argument("--output", default="test/fixtures/celestial-conformance-v1.json", type=Path)
    args = parser.parse_args()
    missing = [name for name in DATA_FILES if not (args.ephemeris_dir / name).is_file()]
    if missing:
        raise SystemExit(f"Missing Swiss Ephemeris data files: {', '.join(missing)}")
    swe.set_ephe_path(str(args.ephemeris_dir))
    swe.set_sid_mode(swe.SIDM_LAHIRI)
    cases = build_cases()
    payload = {
        "schemaVersion": "celestial-conformance/1.0",
        "corpusVersion": "2026-08-17.1",
        "generatedAt": "2026-08-17T00:00:00.000Z",
        "caseCount": len(cases),
        "reference": {
            "engine": "Swiss Ephemeris",
            "engineVersion": swe.version,
            "pythonBinding": "pyswisseph 2.10.3.2",
            "calculation": "apparent geocentric tropical ecliptic longitude of date; instantaneous longitude speed",
            "ayanamsa": "Swiss Ephemeris SIDM_LAHIRI",
            "dataFiles": [{"name": name, "sha256": sha256(args.ephemeris_dir / name)} for name in DATA_FILES],
            "sourceUrls": [
                "https://www.astro.com/swisseph-download/ephe/",
                "https://github.com/aloistr/swisseph/tree/master/ephe",
                "https://www.astro.com/swisseph-download/doc/swisseph.pdf",
            ],
            "licensingBoundary": "Reference values are frozen output. Swiss Ephemeris code and data are not bundled or used at runtime.",
        },
        "externalAnchors": [
            {
                "authority": "US Naval Observatory Astronomical Applications Department",
                "apiVersion": "4.0.1",
                "sourceUrl": "https://aa.usno.navy.mil/api/moon/phases/year?year=2026",
                "linkedCaseId": "phase-09-full",
                "event": "Full Moon",
                "utcMinute": "2026-01-03T10:03Z",
            },
            {
                "authority": "US Naval Observatory Astronomical Applications Department",
                "apiVersion": "4.0.1",
                "sourceUrl": "https://aa.usno.navy.mil/api/moon/phases/year?year=2026",
                "linkedCaseId": "phase-09-new",
                "event": "New Moon",
                "utcMinute": "2026-01-18T19:52Z",
            },
        ],
        "cases": cases,
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n")
    print(f"Wrote {len(cases)} cases to {args.output}")


if __name__ == "__main__":
    main()

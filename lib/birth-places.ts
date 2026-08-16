/**
 * Convenience presets that fill coordinates and zone together.
 *
 * Not a geocoder and not exhaustive. Looking a birth place up against a
 * third-party geocoding service would send the place off to someone else, which
 * is the opposite of how this form treats birth data — so the presets are a
 * local table and the coordinate fields stay freely editable for anywhere not
 * listed.
 *
 * Coordinates are city-centre to about a hundredth of a degree, which is far
 * finer than any limb boundary in the pañcāṅga is sensitive to.
 */

export interface BirthPlace {
  name: string
  country: string
  latitude: number
  longitude: number
  timeZone: string
}

export const BIRTH_PLACES: BirthPlace[] = [
  { name: 'Chennai', country: 'India', latitude: 13.0827, longitude: 80.2707, timeZone: 'Asia/Kolkata' },
  { name: 'Mumbai', country: 'India', latitude: 19.076, longitude: 72.8777, timeZone: 'Asia/Kolkata' },
  { name: 'Delhi', country: 'India', latitude: 28.6139, longitude: 77.209, timeZone: 'Asia/Kolkata' },
  { name: 'Bengaluru', country: 'India', latitude: 12.9716, longitude: 77.5946, timeZone: 'Asia/Kolkata' },
  { name: 'Kolkata', country: 'India', latitude: 22.5726, longitude: 88.3639, timeZone: 'Asia/Kolkata' },
  { name: 'Hyderabad', country: 'India', latitude: 17.385, longitude: 78.4867, timeZone: 'Asia/Kolkata' },
  { name: 'Ujjain', country: 'India', latitude: 23.1765, longitude: 75.7885, timeZone: 'Asia/Kolkata' },
  { name: 'Colombo', country: 'Sri Lanka', latitude: 6.9271, longitude: 79.8612, timeZone: 'Asia/Colombo' },
  { name: 'Kathmandu', country: 'Nepal', latitude: 27.7172, longitude: 85.324, timeZone: 'Asia/Kathmandu' },
  { name: 'Dhaka', country: 'Bangladesh', latitude: 23.8103, longitude: 90.4125, timeZone: 'Asia/Dhaka' },
  { name: 'Karachi', country: 'Pakistan', latitude: 24.8607, longitude: 67.0011, timeZone: 'Asia/Karachi' },
  { name: 'Dubai', country: 'United Arab Emirates', latitude: 25.2048, longitude: 55.2708, timeZone: 'Asia/Dubai' },
  { name: 'Riyadh', country: 'Saudi Arabia', latitude: 24.7136, longitude: 46.6753, timeZone: 'Asia/Riyadh' },
  { name: 'Tehran', country: 'Iran', latitude: 35.6892, longitude: 51.389, timeZone: 'Asia/Tehran' },
  { name: 'Tel Aviv', country: 'Israel', latitude: 32.0853, longitude: 34.7818, timeZone: 'Asia/Jerusalem' },
  { name: 'Singapore', country: 'Singapore', latitude: 1.3521, longitude: 103.8198, timeZone: 'Asia/Singapore' },
  { name: 'Hong Kong', country: 'Hong Kong', latitude: 22.3193, longitude: 114.1694, timeZone: 'Asia/Hong_Kong' },
  { name: 'Shanghai', country: 'China', latitude: 31.2304, longitude: 121.4737, timeZone: 'Asia/Shanghai' },
  { name: 'Beijing', country: 'China', latitude: 39.9042, longitude: 116.4074, timeZone: 'Asia/Shanghai' },
  { name: 'Tokyo', country: 'Japan', latitude: 35.6762, longitude: 139.6503, timeZone: 'Asia/Tokyo' },
  { name: 'Seoul', country: 'South Korea', latitude: 37.5665, longitude: 126.978, timeZone: 'Asia/Seoul' },
  { name: 'Bangkok', country: 'Thailand', latitude: 13.7563, longitude: 100.5018, timeZone: 'Asia/Bangkok' },
  { name: 'Jakarta', country: 'Indonesia', latitude: -6.2088, longitude: 106.8456, timeZone: 'Asia/Jakarta' },
  { name: 'Manila', country: 'Philippines', latitude: 14.5995, longitude: 120.9842, timeZone: 'Asia/Manila' },
  { name: 'London', country: 'United Kingdom', latitude: 51.5074, longitude: -0.1278, timeZone: 'Europe/London' },
  { name: 'Dublin', country: 'Ireland', latitude: 53.3498, longitude: -6.2603, timeZone: 'Europe/Dublin' },
  { name: 'Paris', country: 'France', latitude: 48.8566, longitude: 2.3522, timeZone: 'Europe/Paris' },
  { name: 'Berlin', country: 'Germany', latitude: 52.52, longitude: 13.405, timeZone: 'Europe/Berlin' },
  { name: 'Amsterdam', country: 'Netherlands', latitude: 52.3676, longitude: 4.9041, timeZone: 'Europe/Amsterdam' },
  { name: 'Madrid', country: 'Spain', latitude: 40.4168, longitude: -3.7038, timeZone: 'Europe/Madrid' },
  { name: 'Lisbon', country: 'Portugal', latitude: 38.7223, longitude: -9.1393, timeZone: 'Europe/Lisbon' },
  { name: 'Rome', country: 'Italy', latitude: 41.9028, longitude: 12.4964, timeZone: 'Europe/Rome' },
  { name: 'Athens', country: 'Greece', latitude: 37.9838, longitude: 23.7275, timeZone: 'Europe/Athens' },
  { name: 'Stockholm', country: 'Sweden', latitude: 59.3293, longitude: 18.0686, timeZone: 'Europe/Stockholm' },
  { name: 'Istanbul', country: 'Türkiye', latitude: 41.0082, longitude: 28.9784, timeZone: 'Europe/Istanbul' },
  { name: 'Moscow', country: 'Russia', latitude: 55.7558, longitude: 37.6173, timeZone: 'Europe/Moscow' },
  { name: 'New York', country: 'United States', latitude: 40.7128, longitude: -74.006, timeZone: 'America/New_York' },
  { name: 'Chicago', country: 'United States', latitude: 41.8781, longitude: -87.6298, timeZone: 'America/Chicago' },
  { name: 'Denver', country: 'United States', latitude: 39.7392, longitude: -104.9903, timeZone: 'America/Denver' },
  { name: 'Los Angeles', country: 'United States', latitude: 34.0522, longitude: -118.2437, timeZone: 'America/Los_Angeles' },
  { name: 'San Francisco', country: 'United States', latitude: 37.7749, longitude: -122.4194, timeZone: 'America/Los_Angeles' },
  { name: 'Toronto', country: 'Canada', latitude: 43.6532, longitude: -79.3832, timeZone: 'America/Toronto' },
  { name: 'Vancouver', country: 'Canada', latitude: 49.2827, longitude: -123.1207, timeZone: 'America/Vancouver' },
  { name: 'Mexico City', country: 'Mexico', latitude: 19.4326, longitude: -99.1332, timeZone: 'America/Mexico_City' },
  { name: 'Bogotá', country: 'Colombia', latitude: 4.711, longitude: -74.0721, timeZone: 'America/Bogota' },
  { name: 'Lima', country: 'Peru', latitude: -12.0464, longitude: -77.0428, timeZone: 'America/Lima' },
  { name: 'Santiago', country: 'Chile', latitude: -33.4489, longitude: -70.6693, timeZone: 'America/Santiago' },
  { name: 'São Paulo', country: 'Brazil', latitude: -23.5505, longitude: -46.6333, timeZone: 'America/Sao_Paulo' },
  { name: 'Buenos Aires', country: 'Argentina', latitude: -34.6037, longitude: -58.3816, timeZone: 'America/Argentina/Buenos_Aires' },
  { name: 'Lagos', country: 'Nigeria', latitude: 6.5244, longitude: 3.3792, timeZone: 'Africa/Lagos' },
  { name: 'Accra', country: 'Ghana', latitude: 5.6037, longitude: -0.187, timeZone: 'Africa/Accra' },
  { name: 'Cairo', country: 'Egypt', latitude: 30.0444, longitude: 31.2357, timeZone: 'Africa/Cairo' },
  { name: 'Nairobi', country: 'Kenya', latitude: -1.2921, longitude: 36.8219, timeZone: 'Africa/Nairobi' },
  { name: 'Johannesburg', country: 'South Africa', latitude: -26.2041, longitude: 28.0473, timeZone: 'Africa/Johannesburg' },
  { name: 'Sydney', country: 'Australia', latitude: -33.8688, longitude: 151.2093, timeZone: 'Australia/Sydney' },
  { name: 'Melbourne', country: 'Australia', latitude: -37.8136, longitude: 144.9631, timeZone: 'Australia/Melbourne' },
  { name: 'Perth', country: 'Australia', latitude: -31.9505, longitude: 115.8605, timeZone: 'Australia/Perth' },
  { name: 'Auckland', country: 'New Zealand', latitude: -36.8485, longitude: 174.7633, timeZone: 'Pacific/Auckland' },
]

export function birthPlaceKey(place: BirthPlace): string {
  return `${place.name}, ${place.country}`
}

export function findBirthPlace(key: string): BirthPlace | undefined {
  const normalized = key.trim().toLowerCase()
  return BIRTH_PLACES.find((place) => birthPlaceKey(place).toLowerCase() === normalized)
    ?? BIRTH_PLACES.find((place) => place.name.toLowerCase() === normalized)
}

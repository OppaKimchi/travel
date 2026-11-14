// Place search through OpenStreetMap's Nominatim service. Its usage policy
// allows at most one request a second and no search-as-you-type, so searches
// only run when you press Search.

export type PlaceResult = {
  name: string;
  address: string;
  lat: number;
  lng: number;
};

type NominatimResult = {
  name?: string;
  display_name: string;
  lat: string;
  lon: string;
};

let lastSearch = 0;

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function decodeName(raw: string): string {
  try {
    return decodeURIComponent(raw.replace(/\+/g, " "));
  } catch {
    return raw;
  }
}

// Reads coordinates out of a full Google Maps link, so a place saved in
// Google Maps can be pasted straight in. Short maps.app.goo.gl links can't
// be read from the browser.
export function parseMapsLink(text: string): PlaceResult | null {
  if (!/^https?:\/\//i.test(text.trim())) return null;
  const url = text.trim();
  const patterns = [
    /!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/,
    /@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/,
    /[?&](?:q|query|ll|destination)=(-?\d+(?:\.\d+)?)(?:,|%2C)(-?\d+(?:\.\d+)?)/i,
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (!match) continue;
    const lat = Number(match[1]);
    const lng = Number(match[2]);
    if (Math.abs(lat) > 90 || Math.abs(lng) > 180) continue;
    const place = url.match(/\/place\/([^/@?]+)/);
    const name = place ? decodeName(place[1]) : "Pinned place";
    return { name, address: `${lat.toFixed(5)}, ${lng.toFixed(5)}`, lat, lng };
  }
  return null;
}

export async function searchPlaces(query: string): Promise<PlaceResult[]> {
  const fromLink = parseMapsLink(query);
  if (fromLink) return [fromLink];
  if (/^https?:\/\//i.test(query.trim())) {
    throw new Error(
      "That link doesn't include a location. In Google Maps, open the place and copy the full link from the address bar.",
    );
  }

  const gap = Date.now() - lastSearch;
  if (gap < 1100) await wait(1100 - gap);
  lastSearch = Date.now();

  const params = new URLSearchParams({ q: query.trim(), format: "jsonv2", limit: "6" });
  const response = await fetch(`https://nominatim.openstreetmap.org/search?${params}`);
  if (!response.ok) throw new Error("Place search isn't responding. Try again in a minute.");
  const results = (await response.json()) as NominatimResult[];

  return results.map((r) => ({
    name: r.name || r.display_name.split(",")[0],
    address: r.display_name,
    lat: Number(r.lat),
    lng: Number(r.lon),
  }));
}

export function directionsUrl(lat: number, lng: number): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
}

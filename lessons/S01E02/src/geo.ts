import { mkdir } from "node:fs/promises";
import {
  CACHE_DIR,
  CLI_FORCE,
  formatLessonPath,
  GEOCODE_CACHE_PATH,
  requireEnv,
} from "./config.js";
import { log } from "./logger.js";
import type {
  Coordinates,
  GeocodedPlace,
  NearestMatch,
  ReferencePoint,
  SubjectPoints,
} from "./types.js";

const EARTH_RADIUS_KM = 6371;

type GeocodeCache = Record<string, Coordinates>;

type GeoapifyResponse = {
  features?: Array<{
    properties?: {
      lat?: number;
      lon?: number;
    };
  }>;
};

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/** Great-circle distance between two coordinates (Haversine), in km. */
export function haversineDistance(a: Coordinates, b: Coordinates): number {
  const dLat = toRadians(b.lat - a.lat);
  const dLon = toRadians(b.lon - a.lon);
  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;

  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}

/**
 * For each subject, find the nearest reference among all of their locations.
 * Returns matches sorted by distance (closest first).
 */
export function findNearestReferences(
  subjects: SubjectPoints[],
  references: ReferencePoint[],
): NearestMatch[] {
  if (references.length === 0) {
    throw new Error("No reference points provided");
  }

  const matches: NearestMatch[] = [];

  for (const subject of subjects) {
    let best: NearestMatch | null = null;

    for (const location of subject.locations) {
      for (const reference of references) {
        const distanceKm = haversineDistance(location, reference);

        if (!best || distanceKm < best.distanceKm) {
          best = {
            subjectId: subject.id,
            referenceId: reference.id,
            referenceName: reference.name,
            distanceKm,
          };
        }
      }
    }

    if (best) {
      matches.push(best);
    }
  }

  return matches.sort((a, b) => a.distanceKm - b.distanceKm);
}

async function readCache(): Promise<GeocodeCache> {
  if (CLI_FORCE) {
    return {};
  }

  const file = Bun.file(GEOCODE_CACHE_PATH);
  if (!(await file.exists())) {
    return {};
  }

  return (await file.json()) as GeocodeCache;
}

async function writeCache(cache: GeocodeCache): Promise<void> {
  await mkdir(CACHE_DIR, { recursive: true });
  await Bun.write(GEOCODE_CACHE_PATH, JSON.stringify(cache, null, 2));
  log.cache(`Saved geocode cache: ${formatLessonPath(GEOCODE_CACHE_PATH)}`);
}

async function geocodeOne(place: string, apiKey: string): Promise<Coordinates> {
  const url = new URL("https://api.geoapify.com/v1/geocode/search");
  url.searchParams.set("text", place);
  url.searchParams.set("limit", "1");
  url.searchParams.set("type", "city");
  url.searchParams.set("filter", "countrycode:pl");
  url.searchParams.set("apiKey", apiKey);

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(
      `Geocode failed for "${place}": ${response.status} ${response.statusText}`,
    );
  }

  const data = (await response.json()) as GeoapifyResponse;
  const props = data.features?.[0]?.properties;
  const lat = props?.lat;
  const lon = props?.lon;

  if (typeof lat !== "number" || typeof lon !== "number") {
    throw new Error(`No coordinates found for "${place}"`);
  }

  return { lat, lon };
}

/** Geocode place names sequentially (cached). Used by geocode_places tool. */
export async function geocodePlaces(places: string[]): Promise<GeocodedPlace[]> {
  const apiKey = requireEnv("GEOAPIFY_API_KEY");
  const cache = await readCache();
  let cacheUpdated = false;

  const results: GeocodedPlace[] = [];

  for (const place of places) {
    const cached = cache[place];
    if (cached) {
      log.cache(`Geocode cache hit: ${place}`);
      results.push({ name: place, ...cached });
      continue;
    }

    log.info(`Geocoding: ${place}`);
    const coords = await geocodeOne(place, apiKey);
    cache[place] = coords;
    cacheUpdated = true;
    results.push({ name: place, ...coords });
  }

  if (cacheUpdated) {
    await writeCache(cache);
  }

  return results;
}

import { requireEnv } from "./config.js";
import { log } from "./logger.js";
import type { Coordinates, SubjectLocations, SubjectRef } from "./types.js";

const LOCATION_URL = "https://hub.ag3nts.org/api/location";
const ACCESS_LEVEL_URL = "https://hub.ag3nts.org/api/accesslevel";

type HubLocationPoint = {
  latitude: number;
  longitude: number;
};

function parseHubLocations(data: unknown): Coordinates[] {
  if (!Array.isArray(data)) {
    throw new Error(
      `Expected location array from Hub, got: ${typeof data}`,
    );
  }

  return data.map((item, index) => {
    if (typeof item !== "object" || item === null) {
      throw new Error(`Invalid location entry at index ${index}`);
    }

    const { latitude, longitude } = item as Partial<HubLocationPoint>;

    if (typeof latitude !== "number" || typeof longitude !== "number") {
      throw new Error(
        `Location entry at index ${index} must have numeric latitude/longitude`,
      );
    }

    return { lat: latitude, lon: longitude };
  });
}

export async function fetchPersonLocations(
  name: string,
  surname: string,
): Promise<Coordinates[]> {
  const apikey = requireEnv("HUB_API_KEY");

  const response = await fetch(LOCATION_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ apikey, name, surname }),
  });

  const bodyText = await response.text();

  if (!response.ok) {
    throw new Error(
      `Location API failed for ${name} ${surname}: ${response.status} ${bodyText}`,
    );
  }

  const data = JSON.parse(bodyText) as unknown;
  const locations = parseHubLocations(data);

  if (locations.length === 0) {
    log.data(`No locations returned for ${name} ${surname}`);
  }

  return locations;
}

/** Fetch locations for many subjects (sequential). Used by fetch_subject_locations tool. */
export async function fetchSubjectLocations(
  subjects: SubjectRef[],
): Promise<SubjectLocations[]> {
  const results: SubjectLocations[] = [];

  for (const subject of subjects) {
    log.info(`Fetching locations: ${subject.name} ${subject.surname}`);
    const locations = await fetchPersonLocations(subject.name, subject.surname);
    log.data(
      `${subject.name} ${subject.surname}: ${locations.length} location(s)`,
    );
    results.push({ ...subject, locations });
  }

  return results;
}

/** Fetch access level for one subject. Used by get_access_level tool. */
export async function fetchAccessLevel(
  name: string,
  surname: string,
  birthYear: number,
): Promise<number> {
  const apikey = requireEnv("HUB_API_KEY");

  const response = await fetch(ACCESS_LEVEL_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ apikey, name, surname, birthYear }),
  });

  const bodyText = await response.text();

  if (!response.ok) {
    throw new Error(
      `Access level API failed for ${name} ${surname}: ${response.status} ${bodyText}`,
    );
  }

  const data = JSON.parse(bodyText) as { accessLevel?: unknown };

  if (typeof data.accessLevel !== "number") {
    throw new Error(
      `Unexpected access level response for ${name} ${surname}: ${bodyText.slice(0, 300)}`,
    );
  }

  return data.accessLevel;
}

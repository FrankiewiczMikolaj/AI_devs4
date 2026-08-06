import { findNearestReferences, geocodePlaces } from "../geo.js";
import { fetchAccessLevel, fetchSubjectLocations } from "../hub-data.js";
import type { ReferencePoint, SubjectPoints, SubjectRef } from "../types.js";

type GeocodePlacesArgs = {
  places: string[];
};

type FetchSubjectLocationsArgs = {
  subjects: SubjectRef[];
};

type FindNearestArgs = {
  subjects: SubjectPoints[];
  references: ReferencePoint[];
};

type GetAccessLevelArgs = {
  name: string;
  surname: string;
  birthYear: number;
};

export const handlers: Record<
  string,
  (args: Record<string, unknown>) => Promise<unknown>
> = {
  async geocode_places(args) {
    const { places } = args as GeocodePlacesArgs;
    return geocodePlaces(places);
  },

  async fetch_subject_locations(args) {
    const { subjects } = args as FetchSubjectLocationsArgs;
    return fetchSubjectLocations(subjects);
  },

  async find_nearest(args) {
    const { subjects, references } = args as FindNearestArgs;
    return findNearestReferences(subjects, references);
  },

  async get_access_level(args) {
    const { name, surname, birthYear } = args as GetAccessLevelArgs;
    const accessLevel = await fetchAccessLevel(name, surname, birthYear);
    return { accessLevel };
  },
};

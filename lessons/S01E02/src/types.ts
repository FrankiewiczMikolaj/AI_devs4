/** Suspect from data/suspects.json (S01E01 answer) */
export type Suspect = {
  name: string;
  surname: string;
  gender: string;
  born: number;
  city: string;
  tags: string[];
};

/** Geographic coordinates */
export type Coordinates = {
  lat: number;
  lon: number;
};

/** Single plant entry inside findhim_locations.json */
export type PowerPlantRaw = {
  is_active: boolean;
  power: string;
  code: string;
};

/** Root shape of findhim_locations.json */
export type LocationsFile = {
  power_plants: Record<string, PowerPlantRaw>;
};

/** Normalized power plant (city name = object key) */
export type PowerPlant = {
  name: string;
  code: string;
  isActive: boolean;
  power: string;
};

/** Answer payload for /verify (task: findhim) */
export type FindHimAnswer = {
  name: string;
  surname: string;
  accessLevel: number;
  powerPlant: string;
};

/** Place name resolved to coordinates */
export type GeocodedPlace = {
  name: string;
  lat: number;
  lon: number;
};

/** Subject identity for Hub location / access APIs */
export type SubjectRef = {
  id: number;
  name: string;
  surname: string;
};

/** Subject with sighting coordinates from /api/location */
export type SubjectLocations = SubjectRef & {
  locations: Coordinates[];
};

/** Minimal subject input for nearest-reference matching */
export type SubjectPoints = {
  id: number;
  locations: Coordinates[];
};

/** Reference point used for distance comparisons */
export type ReferencePoint = {
  id: string;
  name: string;
  lat: number;
  lon: number;
};

/** Nearest reference match for one subject */
export type NearestMatch = {
  subjectId: number;
  referenceId: string;
  referenceName: string;
  distanceKm: number;
};

type AiOutputTextPart = {
  type: string;
  text?: string;
};

type AiOutputMessage = {
  type: "message";
  content?: AiOutputTextPart[];
};

export type AiFunctionCall = {
  type: "function_call";
  call_id: string;
  name: string;
  arguments: string;
};

/** AI Responses API response shape (tool-calling) */
export type AiResponse = {
  output_text?: string;
  output?: Array<AiOutputMessage | AiFunctionCall | { type: string }>;
  error?: {
    message: string;
  };
};

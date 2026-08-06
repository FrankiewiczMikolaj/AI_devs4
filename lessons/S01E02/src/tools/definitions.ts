/** OpenAI Responses API tool definitions (universal names). */
export const tools = [
  {
    type: "function",
    name: "geocode_places",
    description:
      "Resolve place names (e.g. cities) to geographic coordinates (lat/lon).",
    parameters: {
      type: "object",
      properties: {
        places: {
          type: "array",
          items: { type: "string" },
          description: "List of place names to geocode",
        },
      },
      required: ["places"],
      additionalProperties: false,
    },
    strict: true,
  },
  {
    type: "function",
    name: "fetch_subject_locations",
    description:
      "Fetch known sighting coordinates for one or more tracked subjects from the Hub location API.",
    parameters: {
      type: "object",
      properties: {
        subjects: {
          type: "array",
          items: {
            type: "object",
            properties: {
              id: { type: "number", description: "Local subject id" },
              name: { type: "string" },
              surname: { type: "string" },
            },
            required: ["id", "name", "surname"],
            additionalProperties: false,
          },
          description: "Subjects to look up",
        },
      },
      required: ["subjects"],
      additionalProperties: false,
    },
    strict: true,
  },
  {
    type: "function",
    name: "find_nearest",
    description:
      "For each subject, find the nearest reference point among all of their locations. Returns matches sorted by distance (closest first).",
    parameters: {
      type: "object",
      properties: {
        subjects: {
          type: "array",
          items: {
            type: "object",
            properties: {
              id: { type: "number" },
              locations: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    lat: { type: "number" },
                    lon: { type: "number" },
                  },
                  required: ["lat", "lon"],
                  additionalProperties: false,
                },
              },
            },
            required: ["id", "locations"],
            additionalProperties: false,
          },
        },
        references: {
          type: "array",
          items: {
            type: "object",
            properties: {
              id: {
                type: "string",
                description: "Reference id (e.g. power plant code)",
              },
              name: { type: "string" },
              lat: { type: "number" },
              lon: { type: "number" },
            },
            required: ["id", "name", "lat", "lon"],
            additionalProperties: false,
          },
        },
      },
      required: ["subjects", "references"],
      additionalProperties: false,
    },
    strict: true,
  },
  {
    type: "function",
    name: "get_access_level",
    description:
      "Fetch the system access level for a subject (requires birth year).",
    parameters: {
      type: "object",
      properties: {
        name: { type: "string" },
        surname: { type: "string" },
        birthYear: { type: "number" },
      },
      required: ["name", "surname", "birthYear"],
      additionalProperties: false,
    },
    strict: true,
  },
] as const;

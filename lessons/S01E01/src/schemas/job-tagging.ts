import { JOB_TAGS } from "./job-tags.js";

export const jobTaggingSchema = {
  type: "json_schema",
  name: "job_tagging",
  strict: true,
  schema: {
    type: "object",
    description: "Job descriptions tagged with allowed categories.",
    properties: {
      suspects: {
        type: "array",
        description: "One entry per suspect from the input list.",
        items: {
          type: "object",
          properties: {
            id: {
              type: "integer",
              description: "Suspect ID from the input list.",
            },
            tags: {
              type: "array",
              description: "One or more job categories that match the job description.",
              items: {
                type: "string",
                enum: JOB_TAGS,
              },
              minItems: 1,
            },
          },
          required: ["id", "tags"],
          additionalProperties: false,
        },
      },
    },
    required: ["suspects"],
    additionalProperties: false,
  },
};
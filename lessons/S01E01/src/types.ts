import type { JobTag } from "./schemas/job-tags.js";

/** Raw person row from people.csv */
export type Person = {
  name: string;
  surname: string;
  gender: string;
  birthDate: string;
  birthPlace: string;
  birthCountry: string;
  job: string;
};

/** Filtered suspect with a local numeric id */
export type Suspect = Person & {
  id: number;
};

/** Minimal payload sent to AI for job tagging */
export type SuspectInput = {
  id: number;
  job: string;
};

/** Single tagged suspect returned by AI */
export type TaggedSuspect = {
  id: number;
  tags: JobTag[];
};

/** Full structured output from AI job tagging */
export type JobTaggingResult = {
  suspects: TaggedSuspect[];
};

/** Final person payload for hub submission */
export type TaggedPerson = {
  name: string;
  surname: string;
  gender: string;
  born: number;
  city: string;
  tags: JobTag[];
};

type AiOutputTextPart = {
  type: string;
  text?: string;
};

type AiOutputMessage = {
  type: string;
  content?: AiOutputTextPart[];
};

/** AI Responses API response shape */
export type AiResponse = {
  output_text?: string;
  output?: AiOutputMessage[];
  error?: {
    message: string;
  };
};

export type { JobTag } from "./schemas/job-tags.js";

import type { SuspectInput } from "../types.js";
import { JOB_TAGS } from "../schemas/job-tags.js";

export const JOB_TAGGING_GUIDELINES = `You classify job descriptions into one or more categories.

Allowed tags (use exact spelling):
${JOB_TAGS.map((tag) => `- ${tag}`).join("\n")}

Rules:
- Assign tags based ONLY on the job description text.
- One person can have multiple tags.
- Use at least one tag per person.
- Do not invent tags outside the allowed list.
- Do not guess personal details that are not in the job description.
- Return exactly one result object per input suspect id.
- Keep the same ids as in the input.`;

export const buildJobTaggingPrompt = (suspects: SuspectInput[]): string =>
  `Tag each suspect based only on their job description.
Return JSON only, matching the schema.

<guidelines>
${JOB_TAGGING_GUIDELINES}
</guidelines>

Input suspects:
${JSON.stringify(suspects, null, 2)}`;

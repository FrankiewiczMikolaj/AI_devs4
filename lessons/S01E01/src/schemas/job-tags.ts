export const JOB_TAGS = [
  "IT",
  "transport",
  "edukacja",
  "medycyna",
  "praca z ludźmi",
  "praca z pojazdami",
  "praca fizyczna",
] as const;

export type JobTag = (typeof JOB_TAGS)[number];

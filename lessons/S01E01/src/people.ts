import { access, mkdir } from "node:fs/promises";
import { constants } from "node:fs";
import { parse } from "csv-parse/sync";
import {
  CSV_PATH,
  DATA_DIR,
  formatLessonPath,
  MAX_BIRTH_YEAR,
  MIN_BIRTH_YEAR,
  OUTPUT_DIR,
  REQUIRED_TAG,
  requireEnv,
  SUBMITTED_SUSPECTS_PATH,
  TARGET_CITY,
  TARGET_GENDER,
} from "./config.js";
import { log } from "./logger.js";
import type { JobTaggingResult, Person, Suspect, TaggedPerson } from "./types.js";

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

function getBirthYear(birthDate: string): number {
  return Number(birthDate.slice(0, 4));
}

export async function downloadPeopleCsv(): Promise<string> {
  const hubApiKey = requireEnv("HUB_API_KEY");

  if (await fileExists(CSV_PATH)) {
    log.data(`Using existing file: ${formatLessonPath(CSV_PATH)}`);
    return CSV_PATH;
  }

  const url = `https://hub.ag3nts.org/data/${encodeURIComponent(hubApiKey)}/people.csv`;
  log.info("Downloading people.csv from hub");

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download CSV: ${response.status} ${response.statusText}`);
  }

  await mkdir(DATA_DIR, { recursive: true });
  await Bun.write(CSV_PATH, response);

  log.data(`Saved: ${formatLessonPath(CSV_PATH)}`);
  return CSV_PATH;
}

export async function loadPeople(csvPath: string): Promise<Person[]> {
  return parse(await Bun.file(csvPath).text(), {
    columns: true,
    skip_empty_lines: true,
  }) as Person[];
}

export function filterSuspects(people: Person[]): Suspect[] {
  return people
    .filter((person) => {
      const birthYear = getBirthYear(person.birthDate);
      return (
        person.gender === TARGET_GENDER &&
        person.birthPlace === TARGET_CITY &&
        birthYear >= MIN_BIRTH_YEAR &&
        birthYear <= MAX_BIRTH_YEAR
      );
    })
    .map((person, index) => ({
      ...person,
      id: index + 1,
    }));
}

export function toTaggedPeople(
  suspects: Suspect[],
  taggingResult: JobTaggingResult,
): TaggedPerson[] {
  const tagsById = new Map(
    taggingResult.suspects.map((item) => [item.id, item.tags]),
  );

  return suspects.map((suspect) => ({
    name: suspect.name,
    surname: suspect.surname,
    gender: suspect.gender,
    born: getBirthYear(suspect.birthDate),
    city: suspect.birthPlace,
    tags: tagsById.get(suspect.id) ?? [],
  }));
}

export function filterByRequiredTag(people: TaggedPerson[]): TaggedPerson[] {
  return people.filter((person) => person.tags.includes(REQUIRED_TAG));
}

export async function saveSubmittedSuspects(suspects: TaggedPerson[]): Promise<void> {
  await mkdir(OUTPUT_DIR, { recursive: true });
  await Bun.write(SUBMITTED_SUSPECTS_PATH, JSON.stringify(suspects, null, 2));
  log.output(`Saved ${suspects.length} suspects to ${formatLessonPath(SUBMITTED_SUSPECTS_PATH)}`);
}

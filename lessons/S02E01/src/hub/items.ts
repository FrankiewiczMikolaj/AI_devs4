import { parse } from "csv-parse/sync";
import type { CsvItems } from "./types.js";

const ID_COLUMNS = ["code", "id"];
const DESCRIPTION_COLUMNS = ["description", "opis"];

function findColumn(columns: string[], candidates: string[]): string | null {
  const lookup = new Map(columns.map((name) => [name.toLowerCase(), name]));
  for (const candidate of candidates) {
    const match = lookup.get(candidate);
    if (match) {
      return match;
    }
  }
  return null;
}

/**
 * Maps `categorize.csv` onto items. An unexpected column layout is a hard error:
 * silently guessing would send meaningless prompts and burn the hub budget.
 */
export function parseItemsCsv(text: string): CsvItems {
  const rows = parse(text, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  }) as Array<Record<string, string>>;

  const firstRow = rows[0];
  if (!firstRow) {
    throw new Error("categorize.csv is empty");
  }

  const columns = Object.keys(firstRow);
  const idColumn = findColumn(columns, ID_COLUMNS);
  const descriptionColumn = findColumn(columns, DESCRIPTION_COLUMNS);

  if (!idColumn || !descriptionColumn) {
    throw new Error(
      `categorize.csv has unexpected columns: ${columns.join(", ")} ` +
        `(need one of ${ID_COLUMNS.join("/")} and one of ${DESCRIPTION_COLUMNS.join("/")})`,
    );
  }

  return {
    columns,
    items: rows.map((row) => ({
      id: (row[idColumn] ?? "").trim(),
      description: (row[descriptionColumn] ?? "").trim(),
    })),
  };
}

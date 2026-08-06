import { mkdir } from "node:fs/promises";
import {
  CLI_FORCE,
  DATA_DIR,
  formatLessonPath,
  LOCATIONS_PATH,
  requireEnv,
} from "./config.js";
import { log } from "./logger.js";
import type { LocationsFile, PowerPlant } from "./types.js";

export async function downloadPowerPlants(): Promise<string> {
  const file = Bun.file(LOCATIONS_PATH);

  if (!CLI_FORCE && (await file.exists())) {
    log.data(`Using existing file: ${formatLessonPath(LOCATIONS_PATH)}`);
    return LOCATIONS_PATH;
  }

  if (CLI_FORCE) {
    log.cache("Skipping locations cache (--force)");
  }

  const hubApiKey = requireEnv("HUB_API_KEY");
  const url = `https://hub.ag3nts.org/data/${encodeURIComponent(hubApiKey)}/findhim_locations.json`;

  log.info("Downloading findhim_locations.json from hub");

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(
      `Failed to download locations: ${response.status} ${response.statusText}`,
    );
  }

  await mkdir(DATA_DIR, { recursive: true });
  await Bun.write(LOCATIONS_PATH, response);

  log.data(`Saved: ${formatLessonPath(LOCATIONS_PATH)}`);
  return LOCATIONS_PATH;
}

export async function loadPowerPlants(): Promise<PowerPlant[]> {
  const path = await downloadPowerPlants();
  const data = (await Bun.file(path).json()) as LocationsFile;

  const plants = Object.entries(data.power_plants).map(([name, plant]) => ({
    name,
    code: plant.code,
    isActive: plant.is_active,
    power: plant.power,
  }));

  log.data(`Loaded ${plants.length} power plants from ${formatLessonPath(path)}`);
  return plants;
}

import type { PowerPlant, Suspect } from "../types.js";

export function buildAgentInstructions(): string {
  return [
    "You are an investigation agent. Use the available tools to solve the task.",
    "Decide which tools to call and in what order based on the data and the goal.",
    "Do not invent coordinates, distances, or access levels — obtain them via tools.",
    "When finished, reply with ONLY a JSON object (no markdown, no commentary) in this shape:",
    '{"name":"...","surname":"...","accessLevel":0,"powerPlant":"PWR0000PL"}',
    "powerPlant must be the plant code (e.g. PWR2758PL), not the city name.",
  ].join("\n");
}

export function buildAgentUserMessage(input: {
  suspects: Suspect[];
  plants: PowerPlant[];
}): string {
  const subjects = input.suspects.map((suspect, index) => ({
    id: index + 1,
    name: suspect.name,
    surname: suspect.surname,
    born: suspect.born,
  }));

  const sites = input.plants.map((plant) => ({
    name: plant.name,
    code: plant.code,
    isActive: plant.isActive,
    power: plant.power,
  }));

  return [
    "Task: findhim",
    "",
    "Find which tracked subject was nearest to one of the listed power plant sites.",
    "Also obtain that subject's accessLevel.",
    "Return name, surname, accessLevel, and the site code as powerPlant.",
    "Consider all provided sites when measuring proximity.",
    "",
    "Subjects:",
    JSON.stringify(subjects, null, 2),
    "",
    "Power plant sites (names are places; codes identify them):",
    JSON.stringify(sites, null, 2),
  ].join("\n");
}

import {
  ENGINEER_MODEL,
  MAX_ENGINEER_ROUNDS,
  MAX_ROOT_ROUNDS,
  ROOT_MODEL,
} from "../config.js";
import type { CategorizeItem } from "../hub/types.js";
import { engineerInstructions, engineerTask } from "../prompts/engineer.js";
import type { EngineerBrief } from "../prompts/engineer.js";
import { rootInstructions, rootTask } from "../prompts/root.js";
import type { PromptVersion } from "../prompts/types.js";
import { toolsFor } from "../tools/registry.js";
import type { AgentRole } from "./types.js";

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : null;
}

function readString(value: unknown, key: string): string | null {
  const field = asRecord(value)?.[key];
  return typeof field === "string" && field ? field : null;
}

/** Orchestrator: finished as soon as a tool result carries the hub flag. */
export function rootRole(input: {
  items: CategorizeItem[];
  versions: PromptVersion[];
}): AgentRole {
  return {
    id: "root",
    model: ROOT_MODEL,
    instructions: rootInstructions(),
    task: rootTask(input),
    tools: toolsFor("root"),
    maxRounds: MAX_ROOT_ROUNDS,
    completion(_toolName, result) {
      const flag = readString(result, "flag");
      return flag ? { ok: true, summary: flag, flag } : null;
    },
  };
}

/** Specialist: finished once it has stored a template that passes validation. */
export function engineerRole(brief: EngineerBrief): AgentRole {
  return {
    id: "engineer",
    model: ENGINEER_MODEL,
    instructions: engineerInstructions(),
    task: engineerTask(brief),
    tools: toolsFor("engineer"),
    maxRounds: MAX_ENGINEER_ROUNDS,
    completion(toolName, result) {
      if (toolName !== "save_template" || asRecord(result)?.ok !== true) {
        return null;
      }

      const version = readString(result, "version");
      return version
        ? { ok: true, summary: `saved template ${version}`, version }
        : null;
    },
  };
}

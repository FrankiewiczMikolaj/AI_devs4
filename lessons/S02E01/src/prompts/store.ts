import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { HubRunRecord, PromptTokenStats, PromptVersion } from "./types.js";

type Index = {
  versions: string[];
  latest: string | null;
};

export type PromptStore = {
  list(): Promise<PromptVersion[]>;
  get(version: string): Promise<PromptVersion | null>;
  latest(): Promise<PromptVersion | null>;
  save(input: {
    template: string;
    sessionId: string;
    parentVersion: string | null;
    tokenStats: PromptTokenStats;
  }): Promise<PromptVersion>;
  appendHubRun(version: string, run: HubRunRecord): Promise<void>;
};

function nextVersion(latest: string | null): string {
  const current = latest ? Number(/^v(\d+)$/.exec(latest)?.[1] ?? 0) : 0;
  return `v${String(current + 1).padStart(3, "0")}`;
}

async function writeJson(filePath: string, value: unknown): Promise<void> {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

export function createPromptStore(rootDir: string): PromptStore {
  const indexPath = path.join(rootDir, "index.json");
  const versionDir = (version: string) => path.join(rootDir, version);
  const metaPath = (version: string) =>
    path.join(versionDir(version), "meta.json");

  const loadIndex = async (): Promise<Index> => {
    try {
      const parsed = JSON.parse(await readFile(indexPath, "utf8")) as Index;
      return {
        versions: Array.isArray(parsed.versions) ? parsed.versions : [],
        latest: typeof parsed.latest === "string" ? parsed.latest : null,
      };
    } catch {
      return { versions: [], latest: null };
    }
  };

  const store: PromptStore = {
    async get(version) {
      try {
        return JSON.parse(
          await readFile(metaPath(version), "utf8"),
        ) as PromptVersion;
      } catch {
        return null;
      }
    },

    async list() {
      const index = await loadIndex();
      const versions = await Promise.all(
        index.versions.map((version) => store.get(version)),
      );
      return versions.filter((version): version is PromptVersion =>
        Boolean(version),
      );
    },

    async latest() {
      const index = await loadIndex();
      return index.latest ? store.get(index.latest) : null;
    },

    async save(input) {
      const index = await loadIndex();
      const version = nextVersion(index.latest);
      const meta: PromptVersion = {
        version,
        createdAt: new Date().toISOString(),
        sessionId: input.sessionId,
        parentVersion: input.parentVersion ?? index.latest,
        template: input.template,
        tokenStats: input.tokenStats,
        hubRuns: [],
      };

      await mkdir(versionDir(version), { recursive: true });
      await writeFile(
        path.join(versionDir(version), "template.txt"),
        `${input.template}\n`,
        "utf8",
      );
      await writeJson(metaPath(version), meta);
      await writeJson(indexPath, {
        versions: [...index.versions, version],
        latest: version,
      } satisfies Index);

      return meta;
    },

    async appendHubRun(version, run) {
      const meta = await store.get(version);
      if (!meta) {
        return;
      }
      meta.hubRuns.push(run);
      await writeJson(metaPath(version), meta);
    },
  };

  return store;
}

import { access } from "node:fs/promises";
import { spawn } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = join(dirname(fileURLToPath(import.meta.url)), "..");
const filesMcpDir = join(rootDir, "mcp", "files-mcp");

const exists = async (path) => {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
};

const run = (command, args, label) =>
  new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: rootDir, stdio: "inherit" });

    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        resolve(undefined);
        return;
      }

      reject(new Error(`${label} failed (exit code ${code ?? "unknown"}).`));
    });
  });

/** Reuses the package manager that invoked this script, so npm and bun stay interchangeable. */
const installDependencies = () => {
  const label = "files-mcp dependency install";

  if (process.env.npm_execpath) {
    return run(
      process.execPath,
      [process.env.npm_execpath, "install", "--prefix", filesMcpDir],
      label,
    );
  }

  return run(
    process.platform === "win32" ? "npm.cmd" : "npm",
    ["install", "--prefix", filesMcpDir],
    label,
  );
};

if (!(await exists(join(filesMcpDir, "node_modules")))) {
  console.log("[ensure-files-mcp] Installing mcp/files-mcp dependencies...");
  await installDependencies();
}

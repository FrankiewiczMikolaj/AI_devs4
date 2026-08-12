const dim = (s: string) => `\x1b[2m${s}\x1b[0m`;
const bold = (s: string) => `\x1b[1m${s}\x1b[0m`;

/** Short label for long Hub session IDs (last 6 chars). */
export function shortSession(sessionID: string): string {
  if (sessionID.length <= 6) {
    return sessionID;
  }
  return sessionID.slice(-6);
}

function tag(sessionID: string): string {
  return `[${shortSession(sessionID)}]`;
}

function pretty(value: unknown): string {
  return JSON.stringify(value, null, 2)
    .split("\n")
    .map((line) => `      ${line}`)
    .join("\n");
}

export const chatLog = {
  boot(message: string) {
    console.log(message);
  },

  health() {
    console.log("🩺  GET /");
    console.log();
  },

  user(sessionID: string, msg: string) {
    console.log(`${bold("👤")}  ${tag(sessionID)} ${msg}`);
  },

  assistant(sessionID: string, msg: string) {
    console.log(`${bold("🤖")}  ${tag(sessionID)} ${msg}`);
    console.log();
  },

  toolCall(sessionID: string, name: string, args: unknown) {
    console.log(`${bold("🔧")}  ${tag(sessionID)} ${name}`);
    console.log(dim(pretty(args)));
  },

  toolResult(sessionID: string, name: string, result: unknown) {
    console.log(`${bold("✅")}  ${tag(sessionID)} ${name}`);
    console.log(dim(pretty(result)));
  },

  toolError(sessionID: string, name: string, message: string) {
    console.log(`${bold("⚠️")}  ${tag(sessionID)} ${name}: ${message}`);
  },

  flag(flag: string) {
    console.log();
    console.log(`${bold("🚩")}  ${flag}`);
    console.log();
  },

  error(sessionID: string, message: string) {
    console.error(`${bold("⚠️")}  ${tag(sessionID)} ${message}`);
    console.log();
  },
};

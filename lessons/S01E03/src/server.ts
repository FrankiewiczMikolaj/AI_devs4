import type { AgentMcpContext } from "./agent.js";
import { handleOperatorMessage } from "./agent.js";
import { chatLog } from "./chat-log.js";
import { PORT } from "./config.js";
import { captureFlags } from "./flag.js";
import type { ProxyRequestBody } from "./types.js";

type ServerOptions = {
  port?: number;
  mcp: AgentMcpContext;
};

async function parseJsonBody(req: Request): Promise<ProxyRequestBody | null> {
  try {
    return (await req.json()) as ProxyRequestBody;
  } catch {
    return null;
  }
}

function createFetchHandler(mcp: AgentMcpContext) {
  return async (req: Request): Promise<Response> => {
    if (req.method === "GET") {
      chatLog.health();
      return Response.json({ status: "ok" });
    }

    if (req.method === "POST") {
      const body = await parseJsonBody(req);
      if (!body) {
        return Response.json({ msg: "Invalid JSON body" }, { status: 400 });
      }

      const sessionID = body.sessionID?.trim();
      const msg = body.msg?.trim();

      if (!sessionID || !msg) {
        return Response.json(
          { msg: "sessionID and msg are required" },
          { status: 400 },
        );
      }

      chatLog.user(sessionID, msg);
      await captureFlags(msg);

      try {
        const reply = await handleOperatorMessage(sessionID, msg, mcp);
        chatLog.assistant(sessionID, reply);
        return Response.json({ msg: reply });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        chatLog.error(sessionID, message);
        return Response.json({ msg: "Internal error" }, { status: 500 });
      }
    }

    return new Response("Method Not Allowed", { status: 405 });
  };
}

/** Start the public proxy HTTP server. */
export function startServer(options: ServerOptions) {
  const port = options.port ?? PORT;

  const server = Bun.serve({
    port,
    fetch: createFetchHandler(options.mcp),
  });

  chatLog.boot(`Listening on http://localhost:${port}`);
  return server;
}

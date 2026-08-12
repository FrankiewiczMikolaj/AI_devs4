#!/usr/bin/env bun
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { checkPackage, redirectPackage } from "./packages-api.js";

const textResult = (data: unknown) => ({
  content: [{ type: "text" as const, text: JSON.stringify(data) }],
});

const server = new McpServer(
  { name: "packages-mcp", version: "1.0.0" },
  { capabilities: { tools: {} } },
);

server.registerTool(
  "check_package",
  {
    description: "Check package status and location by package ID",
    inputSchema: {
      packageid: z.string().describe("Package ID, e.g. PKG12345678"),
    },
  },
  async ({ packageid }) => textResult(await checkPackage(packageid)),
);

server.registerTool(
  "redirect_package",
  {
    description: "Redirect a package to a new destination using a security code",
    inputSchema: {
      packageid: z.string().describe("Package ID"),
      destination: z.string().describe("Destination code, e.g. PWR3847PL"),
      code: z.string().describe("Security code provided by the operator"),
    },
  },
  async ({ packageid, destination, code }) =>
    textResult(await redirectPackage({ packageid, destination, code })),
);

await server.connect(new StdioServerTransport());

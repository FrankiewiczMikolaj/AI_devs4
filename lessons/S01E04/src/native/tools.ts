import { DECLARATION_RELATIVE_PATH } from "../config.js";
import { log } from "../logger.js";
import type { OpenAiFunctionTool } from "../types.js";
import { submitDeclarationToHub } from "./hub.js";
import { readImageAsBase64, resolveMimeType } from "./image-file.js";
import { vision } from "./vision.js";

export const nativeTools: OpenAiFunctionTool[] = [
  {
    type: "function",
    name: "understand_image",
    description:
      "Answer a question about the content of an image file. Use it for material that is not machine-readable text, such as maps, diagrams, tables or scans.",
    parameters: {
      type: "object",
      properties: {
        image_path: {
          type: "string",
          description: "Path to the image, relative to the lesson root.",
        },
        question: {
          type: "string",
          description: "What to read or extract from the image.",
        },
      },
      required: ["image_path", "question"],
      additionalProperties: false,
    },
    strict: false,
  },
  {
    type: "function",
    name: "submit_declaration",
    description: `Send the current content of ${DECLARATION_RELATIVE_PATH} to the validator and return its verdict.`,
    parameters: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
    strict: false,
  },
];

const nativeHandlers = {
  async understand_image(args: Record<string, unknown>) {
    const imagePath = String(args.image_path ?? "");
    const question = String(args.question ?? "");
    const mimeType = resolveMimeType(imagePath);

    log.data(`vision ${imagePath}`);

    const imageBase64 = await readImageAsBase64(imagePath);
    const answer = await vision({ imageBase64, mimeType, question });

    return { image_path: imagePath, answer };
  },

  submit_declaration: submitDeclarationToHub,
};

export function isNativeTool(name: string): boolean {
  return name in nativeHandlers;
}

export async function executeNativeTool(
  name: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  const handler = nativeHandlers[name as keyof typeof nativeHandlers];

  if (!handler) {
    throw new Error(`Unknown native tool: ${name}`);
  }

  return handler(args);
}

import { resolveModelForProvider } from "../../../../config.js";
import { callResponsesApi, extractText } from "../api.js";
import { VISION_MODEL } from "../config.js";

export async function vision(input: {
  imageBase64: string;
  mimeType: string;
  question: string;
}): Promise<string> {
  const response = await callResponsesApi({
    model: resolveModelForProvider(VISION_MODEL),
    input: [
      {
        role: "user",
        content: [
          { type: "input_text", text: input.question },
          {
            type: "input_image",
            image_url: `data:${input.mimeType};base64,${input.imageBase64}`,
          },
        ],
      },
    ],
  });

  return extractText(response) ?? "No response";
}

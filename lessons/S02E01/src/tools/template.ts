import {
  DESCRIPTION_PLACEHOLDER,
  ID_PLACEHOLDER,
} from "../prompts/tokenizer.js";

export type TemplateProblem =
  | "missing-id-placeholder"
  | "missing-description-placeholder";


export function validateTemplate(template: string): TemplateProblem | null {
  if (!template.includes(ID_PLACEHOLDER)) {
    return "missing-id-placeholder";
  }
  if (!template.includes(DESCRIPTION_PLACEHOLDER)) {
    return "missing-description-placeholder";
  }
  return null;
}

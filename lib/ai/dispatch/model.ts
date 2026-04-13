import { openai } from "@ai-sdk/openai";

export function getDispatchModel() {
  return openai(process.env.OPENAI_MODEL?.trim() || "gpt-5.4-nano");
}

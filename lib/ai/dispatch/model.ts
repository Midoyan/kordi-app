import { openai } from "@ai-sdk/openai";
import { DEFAULT_PREVIEW_OPENAI_MODEL } from "@/lib/preview-ai-settings";

export function getDispatchModel(modelOverride?: string | null) {
  const normalizedOverride = modelOverride?.trim();
  return openai(normalizedOverride || process.env.OPENAI_MODEL?.trim() || DEFAULT_PREVIEW_OPENAI_MODEL);
}

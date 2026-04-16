export const PREVIEW_OPENAI_KEY_STORAGE_KEY = "kordi.preview.openai-key";
export const PREVIEW_OPENAI_MODEL_STORAGE_KEY = "kordi.preview.openai-model";
export const DEFAULT_PREVIEW_OPENAI_MODEL = "gpt-5.4-nano";

export function normalizePreviewModel(value: string | null | undefined) {
  const trimmedValue = value?.trim();
  return trimmedValue || DEFAULT_PREVIEW_OPENAI_MODEL;
}

export function readStoredPreviewOpenAiKey() {
  if (typeof window === "undefined") {
    return "";
  }

  return window.localStorage.getItem(PREVIEW_OPENAI_KEY_STORAGE_KEY) ?? "";
}

export function hasStoredPreviewOpenAiKey() {
  return readStoredPreviewOpenAiKey().trim().length > 0;
}

export function readStoredPreviewOpenAiModel() {
  if (typeof window === "undefined") {
    return DEFAULT_PREVIEW_OPENAI_MODEL;
  }

  return normalizePreviewModel(window.localStorage.getItem(PREVIEW_OPENAI_MODEL_STORAGE_KEY));
}

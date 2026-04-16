"use client";

import * as React from "react";

import { Cpu, KeyRound, LogOut, Save } from "lucide-react";

import { LogoutButton } from "@/components/auth/logout-button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  DEFAULT_PREVIEW_OPENAI_MODEL,
  PREVIEW_OPENAI_KEY_STORAGE_KEY,
  PREVIEW_OPENAI_MODEL_STORAGE_KEY,
  normalizePreviewModel,
  readStoredPreviewOpenAiKey,
  readStoredPreviewOpenAiModel,
} from "@/lib/preview-ai-settings";

export function PreviewSettings() {
  const [draftKey, setDraftKey] = React.useState("");
  const [savedKey, setSavedKey] = React.useState("");
  const [draftModel, setDraftModel] = React.useState(DEFAULT_PREVIEW_OPENAI_MODEL);
  const [savedModel, setSavedModel] = React.useState(DEFAULT_PREVIEW_OPENAI_MODEL);
  const [keySaveMessage, setKeySaveMessage] = React.useState("");
  const [modelSaveMessage, setModelSaveMessage] = React.useState("");
  const hasCustomKey = savedKey.trim().length > 0;

  React.useEffect(() => {
    const storedKey = readStoredPreviewOpenAiKey();
    const storedModel = readStoredPreviewOpenAiModel();
    setDraftKey(storedKey);
    setSavedKey(storedKey);
    setDraftModel(storedModel);
    setSavedModel(storedModel);

    const handleStorage = (event: StorageEvent) => {
      if (event.storageArea !== window.localStorage) {
        return;
      }

      if (event.key === PREVIEW_OPENAI_KEY_STORAGE_KEY) {
        const nextValue = event.newValue ?? "";
        setDraftKey(nextValue);
        setSavedKey(nextValue);
        setKeySaveMessage("Updated from another tab.");
      }

      if (event.key === PREVIEW_OPENAI_MODEL_STORAGE_KEY) {
        const nextValue = normalizePreviewModel(event.newValue);
        setDraftModel(nextValue);
        setSavedModel(nextValue);
        setModelSaveMessage("Updated from another tab.");
      }
    };

    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  const handleSave = () => {
    const trimmedKey = draftKey.trim();

    if (trimmedKey) {
      window.localStorage.setItem(PREVIEW_OPENAI_KEY_STORAGE_KEY, trimmedKey);
    } else {
      window.localStorage.removeItem(PREVIEW_OPENAI_KEY_STORAGE_KEY);
    }

    setDraftKey(trimmedKey);
    setSavedKey(trimmedKey);
    setKeySaveMessage(trimmedKey ? "Saved locally on this browser." : "Removed from this browser.");
  };

  const handleModelSave = () => {
    const normalizedModel = normalizePreviewModel(draftModel);

    window.localStorage.setItem(PREVIEW_OPENAI_MODEL_STORAGE_KEY, normalizedModel);
    setDraftModel(normalizedModel);
    setSavedModel(normalizedModel);
    setModelSaveMessage("Saved locally on this browser.");
  };

  return (
    <div className="mx-auto grid w-full max-w-3xl gap-4">
      <Card className="border border-[#e3e3df] bg-white py-0 shadow-[0_12px_30px_-26px_rgba(15,23,42,0.45)]">
        <CardHeader className="border-b border-[#ecece8] px-5 py-5">
          <div className="flex items-start gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-[14px] bg-[#f4f0e6] text-[#6f4f05]">
              <KeyRound className="size-4" />
            </div>
            <div>
              <CardTitle className="text-[17px] text-[#1d1d1b]">Customise Agentic experience</CardTitle>
              <CardDescription className="mt-1 text-[13px] leading-6 text-[#6b6b67]">
               Be default we use <code>{DEFAULT_PREVIEW_OPENAI_MODEL}</code>. Add your own OpenAI key to use any model you preffer.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="px-5 py-5">
          <div className="grid gap-4 md:grid-cols-2">
            <section className="rounded-[18px] border border-[#ecece8] bg-[#fcfcfa] p-4">
              <div className="flex items-start gap-3">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-[12px] bg-[#f4f0e6] text-[#6f4f05]">
                  <KeyRound className="size-4" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-[15px] font-semibold text-[#1d1d1b]">Add your own OpenAI Key</h3>
                  <p className="mt-1 text-[13px] leading-6 text-[#6b6b67]">
                    Stored locally in your browser and never sent to our servers. You can get a key from{" "}
                    <a
                      href="https://platform.openai.com/account/api-keys"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline"
                    >
                      OpenAI&apos;s website
                    </a>
                    .
                  </p>
                </div>
              </div>
              <div className="mt-4 space-y-4">
                <Input
                  type="password"
                  value={draftKey}
                  onChange={(event) => {
                    setDraftKey(event.target.value);
                    setKeySaveMessage("");
                  }}
                  placeholder="sk-..."
                  autoComplete="off"
                  spellCheck={false}
                  className="h-11 border-[#d9d8d2] bg-white"
                />
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-[12px] text-[#6b6b67]">
                    {keySaveMessage ||
                      (savedKey ? "A key is already stored locally." : "No key saved yet.")}
                  </p>
                  <Button
                    type="button"
                    onClick={handleSave}
                    disabled={draftKey.trim() === savedKey}
                    className="h-10 rounded-[10px] bg-[#1f1f1d] px-4 text-[13px] text-white hover:bg-[#343431]"
                  >
                    <Save className="size-4" />
                    Save key
                  </Button>
                </div>
              </div>
            </section>

            <section className="rounded-[18px] border border-[#ecece8] bg-[#fcfcfa] p-4">
              <div className="flex items-start gap-3">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-[12px] bg-[#edf2f7] text-[#3c536d]">
                  <Cpu className="size-4" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-[15px] font-semibold text-[#1d1d1b]">Custom model</h3>
                  <p className="mt-1 text-[13px] leading-6 text-[#6b6b67]">
                    This only applies when a custom key is saved. Otherwise the app keeps using{" "}
                    <code>{DEFAULT_PREVIEW_OPENAI_MODEL}</code>.
                  </p>
                </div>
              </div>
              <div className="mt-4 space-y-4">
                <Input
                  type="text"
                  value={draftModel}
                  onChange={(event) => {
                    setDraftModel(event.target.value);
                    setModelSaveMessage("");
                  }}
                  placeholder={DEFAULT_PREVIEW_OPENAI_MODEL}
                  autoComplete="off"
                  spellCheck={false}
                  disabled={!hasCustomKey}
                  className="h-11 border-[#d9d8d2] bg-white"
                />
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-[12px] text-[#6b6b67]">
                    {hasCustomKey
                      ? modelSaveMessage || `Current custom model: ${savedModel}.`
                      : ``}
                  </p>
                  <Button
                    type="button"
                    onClick={handleModelSave}
                    disabled={!hasCustomKey || normalizePreviewModel(draftModel) === savedModel}
                    className="h-10 rounded-[10px] bg-[#1f1f1d] px-4 text-[13px] text-white hover:bg-[#343431]"
                  >
                    <Save className="size-4" />
                    Save model
                  </Button>
                </div>
              </div>
            </section>
          </div>
        </CardContent>
      </Card>

      <Card className="border border-[#e3e3df] bg-white py-0 shadow-[0_12px_30px_-26px_rgba(15,23,42,0.45)]">
        <CardHeader className="border-b border-[#ecece8] px-5 py-5">
          <div className="flex items-start gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-[14px] bg-[#f7ebe8] text-[#9a3427]">
              <LogOut className="size-4" />
            </div>
            <div>
              <CardTitle className="text-[17px] text-[#1d1d1b]">Logout</CardTitle>
              <CardDescription className="mt-1 text-[13px] leading-6 text-[#6b6b67]">
                End the current session and return to the login screen.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="px-5 py-5">
          <LogoutButton />
        </CardContent>
      </Card>
    </div>
  );
}

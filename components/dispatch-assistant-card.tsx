"use client";

import { useState } from "react";
import { Loader2, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { DispatchAssistantQuestionResponse } from "@/lib/dispatch-assistant-types";
import { upsertPersonInPeopleCache } from "@/lib/people";
import { primeTransportPlanCache } from "@/lib/transport-plan-client-cache";

const starterQuestions = [
  "Summarize today's schedule.",
  "Find a crew member named Alex.",
  "Explain transport conflicts right now.",
];

export function DispatchAssistantCard() {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [action, setAction] = useState<DispatchAssistantQuestionResponse["action"]>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isApplyingAction, setIsApplyingAction] = useState(false);
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  const submitQuestion = async (nextQuestion: string) => {
    const trimmedQuestion = nextQuestion.trim();

    if (!trimmedQuestion) {
      return;
    }

    setQuestion(trimmedQuestion);
    setIsLoading(true);
    setError(null);
    setActionNotice(null);

    try {
      const response = await fetch("/api/ai/dispatch", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          question: trimmedQuestion,
        }),
      });
      const payload = (await response.json().catch(() => null)) as
        | (DispatchAssistantQuestionResponse & { error?: string })
        | null;

      if (!response.ok || !payload?.answer) {
        throw new Error(payload?.error ?? "The assistant could not answer that question.");
      }

      setAnswer(payload.answer);
      setAction(payload.action ?? null);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "The assistant could not answer that question.");
      setAction(null);
    } finally {
      setIsLoading(false);
    }
  };

  const applyAction = async () => {
    if (!action || action.type !== "apply-pickup-suggestion") {
      return;
    }

    setIsApplyingAction(true);
    setError(null);
    setActionNotice(null);

    try {
      const response = await fetch("/api/ai/pickup-suggestion", {
        method: "PUT",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          draft: action.draft,
          suggestion: action.suggestion,
        }),
      });
      const payload = (await response.json().catch(() => null)) as
        | {
            person?: import("@/lib/people").PersonRecord;
            transportPlan?: import("@/lib/drive-plan").TransportPlan;
            error?: string;
          }
        | null;

      if (!response.ok || !payload?.person || !payload.transportPlan) {
        throw new Error(payload?.error ?? "Unable to apply this suggestion.");
      }

      upsertPersonInPeopleCache(payload.person);
      primeTransportPlanCache(payload.transportPlan);
      setActionNotice(`Applied the suggestion for ${payload.person.name}.`);
      setAction(null);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Unable to apply this suggestion.");
    } finally {
      setIsApplyingAction(false);
    }
  };

  return (
    <section className="rounded-xl border border-[#e5dcc8] bg-[linear-gradient(180deg,rgba(255,251,242,0.98)_0%,rgba(249,243,230,0.98)_100%)] p-5 shadow-[0_18px_50px_-34px_rgba(69,49,13,0.28)]">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#ead8ad] bg-white/75 px-3 py-1 text-[11px] font-semibold tracking-[0.16em] text-[#7a5d20] uppercase">
            <Sparkles className="size-3.5" />
            Dispatch Assistant
          </div>
          <h2 className="mt-3 text-[18px] font-semibold tracking-tight text-[#2e2616]">
            Ask the live ops plan a question
          </h2>
          <p className="mt-1 text-[13px] leading-6 text-[#6d5a31]">
            This assistant can read the current roster, transport plan, and route conflicts before it answers.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {starterQuestions.map((starterQuestion) => (
            <Button
              key={starterQuestion}
              type="button"
              variant="outline"
              size="sm"
              className="border-[#dccb9e] bg-white/80 text-[#5f4a1d] hover:bg-[#fff8ea]"
              disabled={isLoading}
              onClick={() => {
                void submitQuestion(starterQuestion);
              }}
            >
              {starterQuestion}
            </Button>
          ))}
        </div>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
        <form
          className="rounded-xl border border-[#eadfbe] bg-white/86 p-4"
          onSubmit={(event) => {
            event.preventDefault();
            void submitQuestion(question);
          }}
        >
          <label className="text-[12px] font-medium text-[#6d5a31]" htmlFor="dispatch-assistant-question">
            Question
          </label>
          <Textarea
            id="dispatch-assistant-question"
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            placeholder="Ask about routes, crew, conflicts, or where a new rider should go."
            className="mt-2 min-h-28 border-[#ded4bc] bg-[#fffdf8] text-[13px] shadow-none"
          />
          <div className="mt-3 flex items-center justify-between gap-3">
            <p className="text-[11px] leading-5 text-[#8b7342]">
              The answer is grounded in the current app data, not a static FAQ.
            </p>
            <Button type="submit" disabled={isLoading || !question.trim()}>
              {isLoading ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
              Ask
            </Button>
          </div>
        </form>

        <div className="rounded-xl border border-[#eadfbe] bg-white/86 p-4">
          <p className="text-[12px] font-medium text-[#6d5a31]">Answer</p>
          {error ? (
            <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2.5 text-[13px] text-rose-800">
              {error}
            </div>
          ) : null}
          {actionNotice ? (
            <div className="mt-3 rounded-lg border border-[#d8e2ff] bg-[#f5f8ff] px-3 py-2.5 text-[13px] text-[#3556a8]">
              {actionNotice}
            </div>
          ) : null}
          <div className="mt-3 min-h-28 rounded-lg border border-dashed border-[#eadfbe] bg-[#fffdf8] px-4 py-3">
            {isLoading ? (
              <p className="text-[13px] text-[#7d6a41]">Reading the current workspace context…</p>
            ) : answer ? (
              <div className="space-y-4">
                <p className="whitespace-pre-wrap text-[13px] leading-6 text-[#3e3420]">{answer}</p>

                {action?.type === "apply-pickup-suggestion" ? (
                  <div className="rounded-lg border border-[#eadfbe] bg-white/80 px-3 py-3">
                    <p className="text-[12px] leading-5 text-[#6d5a31]">
                      Do you want me to apply this for you?
                    </p>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <Button type="button" disabled={isApplyingAction} onClick={() => void applyAction()}>
                        {isApplyingAction ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : (
                          <Sparkles className="size-4" />
                        )}
                        {action.label}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        className="border-[#dbdbd6] bg-white text-[#1d1d1b] hover:bg-[#f3f3ef]"
                        disabled={isApplyingAction}
                        onClick={() => setAction(null)}
                      >
                        Not now
                      </Button>
                    </div>
                  </div>
                ) : null}
              </div>
            ) : (
              <p className="text-[13px] leading-6 text-[#8b7342]">
                Try one of the starter prompts or ask a specific ops question.
              </p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, Loader2, Sparkles } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { DispatchAssistantQuestionResponse } from "@/lib/ai/dispatch/types";
import { upsertPersonInPeopleCache } from "@/lib/people";
import { primeTransportPlanCache } from "@/lib/transport-plan-client-cache";
import { cn } from "@/lib/utils";

const starterQuestions = [
  "Summarize today's schedule.",
  "Explain transport conflicts right now.",
];

function AssistantMarkdown({ content }: { content: string }) {
  return (
    <div className="space-y-4 text-[13px] leading-6 text-[#3e3420]">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ className, ...props }) => (
            <h1 className={cn("text-base font-semibold tracking-tight text-[#2e2616]", className)} {...props} />
          ),
          h2: ({ className, ...props }) => (
            <h2 className={cn("text-[15px] font-semibold tracking-tight text-[#2e2616]", className)} {...props} />
          ),
          h3: ({ className, ...props }) => (
            <h3 className={cn("text-[14px] font-semibold text-[#2e2616]", className)} {...props} />
          ),
          p: ({ className, ...props }) => (
            <p className={cn("whitespace-pre-wrap text-[13px] leading-6 text-[#3e3420]", className)} {...props} />
          ),
          ul: ({ className, ...props }) => (
            <ul className={cn("list-disc space-y-1 pl-5 marker:text-[#9d7a2c]", className)} {...props} />
          ),
          ol: ({ className, ...props }) => (
            <ol className={cn("list-decimal space-y-1 pl-5 marker:text-[#9d7a2c]", className)} {...props} />
          ),
          li: ({ className, ...props }) => <li className={cn("pl-1", className)} {...props} />,
          a: ({ className, ...props }) => (
            <a
              className={cn(
                "font-medium text-[#8a6615] underline decoration-[#d8c28b] underline-offset-3 hover:text-[#6f4f05]",
                className,
              )}
              target="_blank"
              rel="noreferrer"
              {...props}
            />
          ),
          code: ({ className, children, ...props }) => {
            const isBlock = Boolean(className?.includes("language-"));

            if (isBlock) {
              return (
                <code
                  className={cn(
                    "block overflow-x-auto rounded-lg bg-[#2a2418] px-3 py-2 font-mono text-[12px] leading-5 text-[#f8f3e7]",
                    className,
                  )}
                  {...props}
                >
                  {children}
                </code>
              );
            }

            return (
              <code
                className={cn(
                  "rounded bg-[#f5ebd3] px-1.5 py-0.5 font-mono text-[12px] text-[#6f4f05]",
                  className,
                )}
                {...props}
              >
                {children}
              </code>
            );
          },
          pre: ({ className, ...props }) => (
            <pre className={cn("overflow-x-auto rounded-lg bg-[#2a2418] p-0", className)} {...props} />
          ),
          blockquote: ({ className, ...props }) => (
            <blockquote
              className={cn("border-l-[3px] border-[#d8c28b] pl-4 text-[#6d5a31] italic", className)}
              {...props}
            />
          ),
          table: ({ className, ...props }) => (
            <div className="overflow-x-auto">
              <table className={cn("min-w-full border-collapse text-left text-[12px] leading-5", className)} {...props} />
            </div>
          ),
          thead: ({ className, ...props }) => <thead className={cn("bg-[#f8f1de]", className)} {...props} />,
          th: ({ className, ...props }) => (
            <th
              className={cn(
                "border border-[#eadfbe] px-2.5 py-2 font-semibold tracking-[0.08em] text-[#6d5a31] uppercase",
                className,
              )}
              {...props}
            />
          ),
          td: ({ className, ...props }) => (
            <td className={cn("border border-[#eadfbe] px-2.5 py-2 align-top text-[#3e3420]", className)} {...props} />
          ),
          hr: ({ className, ...props }) => <hr className={cn("border-[#eadfbe]", className)} {...props} />,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

export function DispatchAssistantCard() {
  const [isCollapsed, setIsCollapsed] = useState(true);
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

    return applyPickupSuggestionAction(action);
  };

  const applyPickupSuggestionAction = async (
    nextAction: Extract<DispatchAssistantQuestionResponse["action"], { type: "apply-pickup-suggestion" }>,
  ) => {
    if (!nextAction) {
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
          draft: nextAction.draft,
          constraints: nextAction.constraints,
          suggestion: nextAction.suggestion,
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
          <h2 className="mt-0 text-[18px] font-semibold tracking-tight text-[#2e2616]">
            Your planning assistant
          </h2>
          <p className="mt-1 text-[13px] leading-6 text-[#6d5a31]">
            It can read the current roster, transport plan, and route conflicts before it answers.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="border-[#dccb9e] bg-white/80 text-[#5f4a1d] hover:bg-[#fff8ea]"
          aria-expanded={!isCollapsed}
          aria-controls="dispatch-assistant-content"
          onClick={() => setIsCollapsed((currentValue) => !currentValue)}
        >
          {isCollapsed ? <ChevronDown className="size-4" /> : <ChevronUp className="size-4" />}
          {isCollapsed ? "Open" : "Minimize"}
        </Button>
      </div>

      {isCollapsed ? (
        question ? (
          <div
            id="dispatch-assistant-content"
            className="mt-4 rounded-xl border border-[#eadfbe] bg-white/70 px-4 py-3 text-[13px] text-[#6d5a31]"
          >
            <p className="truncate">
              Last question: <span className="font-medium text-[#3e3420]">{question}</span>
            </p>
          </div>
        ) : null
      ) : (
        <div id="dispatch-assistant-content" className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
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
            <div className="flex flex-wrap gap-2">
              {starterQuestions.map((starterQuestion) => (
                <Button
                  key={starterQuestion}
                  type="button"
                  variant="outline"
                  size="sm"
                  className="border-[#dccb9e] italic bg-white/80 text-[#5f4a1d] hover:bg-[#fff8ea]"
                  disabled={isLoading}
                  onClick={() => {
                    void submitQuestion(starterQuestion);
                  }}
                >
                  {starterQuestion}
                </Button>
              ))}
            </div>
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
                <AssistantMarkdown content={answer} />

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
                ) : action?.type === "choose-pickup-suggestion" ? (
                  <div className="rounded-lg border border-[#eadfbe] bg-white/80 px-3 py-3">
                    <p className="text-[12px] leading-5 text-[#6d5a31]">{action.prompt}</p>
                    <div className="mt-3 flex flex-col gap-2">
                      {action.options.map((option) => (
                        <div
                          key={option.id}
                          className="flex flex-col gap-2 rounded-lg border border-[#f0e4c8] bg-[#fffdf8] px-3 py-3 sm:flex-row sm:items-center sm:justify-between"
                        >
                          <div>
                            <p className="text-[13px] font-medium text-[#2e2616]">{option.label}</p>
                            <p className="text-[12px] leading-5 text-[#6d5a31]">{option.description}</p>
                          </div>
                          <Button
                            type="button"
                            disabled={isApplyingAction}
                            onClick={() =>
                              void applyPickupSuggestionAction({
                                type: "apply-pickup-suggestion",
                                label: `Apply ${option.label}`,
                                draft: option.draft,
                                constraints: option.constraints,
                                suggestion: option.suggestion,
                              })
                            }
                          >
                            {isApplyingAction ? (
                              <Loader2 className="size-4 animate-spin" />
                            ) : (
                              <Sparkles className="size-4" />
                            )}
                            {`Apply ${option.label}`}
                          </Button>
                        </div>
                      ))}
                    </div>
                    <div className="mt-3">
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
      )}
    </section>
  );
}

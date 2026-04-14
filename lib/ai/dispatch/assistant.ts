import "server-only";

import { generateText, stepCountIs } from "ai";

import { getCurrentUser } from "@/lib/auth";
import { getTransportPlan } from "@/lib/drive-plan";
import {
  dispatchDebugLog,
  summarizeAction,
  summarizeConstraints,
  summarizePickupDraft,
  summarizePickupSuggestion,
} from "@/lib/ai/dispatch/debug";
import {
  buildPickupSuggestionConstraintsFromIntent,
  buildPickupSuggestionDraftFromIntent,
  extractDispatchIntent,
  isStructuredPickupAssignmentIntent,
  normalizePickupSuggestionConstraints,
} from "@/lib/ai/dispatch/intents";
import { getDispatchModel } from "@/lib/ai/dispatch/model";
import {
  buildPickupSuggestionDraftFromPerson,
  buildPickupSuggestionDraftFromCrewMemberRow,
  canonicalizePickupSuggestionDraft,
  extractPickupSuggestionDraftFromQuestion,
  fetchPeopleRecords,
  isPickupAssignmentIntent,
  mapCrewMemberRowToAssignmentCandidatePerson,
  mapCrewMemberRowToCandidatePerson,
  pickBestPersonForAssignment,
  resolveExistingCrewMemberForDraft,
} from "@/lib/ai/dispatch/people";
import {
  buildPickupSuggestionAction,
  buildPickupSuggestionAnswer,
  buildPickupSuggestionChoiceAction,
  buildPickupSuggestionChoiceOptions,
  buildPickupSuggestionFallbackAnswer,
  buildPickupSuggestionNoValidDeadlineAnswer,
  buildPickupSuggestionOptionsAnswer,
  getPickupSuggestionLateArrivalMinutes,
  suggestPickupAssignment,
  suggestPickupAssignmentOptions,
} from "@/lib/ai/dispatch/pickups";
import { createDispatchTools } from "@/lib/ai/dispatch/tools";
import type {
  DispatchAssistantAction,
  PickupAssignmentSuggestion,
  PickupSuggestionConstraints,
} from "@/lib/ai/dispatch/types";
import { readString } from "@/lib/ai/dispatch/utils";

function createRequestId() {
  return `dispatch-${Math.random().toString(36).slice(2, 10)}`;
}

function summarizeToolResult(
  entry: {
    type: string;
    toolName?: string;
    input?: unknown;
    output?: unknown;
  },
) {
  if (entry.toolName === "suggest_pickup_assignment") {
    return {
      type: entry.type,
      toolName: entry.toolName,
      input: summarizePickupDraft(
        entry.input && typeof entry.input === "object"
          ? {
              personId: null,
              name: readString((entry.input as { name?: unknown }).name),
              address: readString((entry.input as { address?: unknown }).address),
              phone: readString((entry.input as { phone?: unknown }).phone),
              role: readString((entry.input as { role?: unknown }).role),
            }
          : null,
      ),
      constraints:
        entry.input && typeof entry.input === "object" && "constraints" in entry.input
          ? summarizeConstraints((entry.input as { constraints?: Partial<PickupSuggestionConstraints> }).constraints)
          : null,
      output: summarizePickupSuggestion(entry.output as PickupAssignmentSuggestion | null | undefined),
    };
  }

  return {
    type: entry.type,
    toolName: entry.toolName ?? "unknown",
    input: entry.input ?? null,
    output: entry.output ?? null,
  };
}

function mergePickupSuggestionDrafts(
  baseDraft: ReturnType<typeof buildPickupSuggestionDraftFromPerson>,
  overrideDraft?: ReturnType<typeof buildPickupSuggestionDraftFromIntent> | null,
) {
  if (!overrideDraft) {
    return baseDraft;
  }

  return {
    personId: baseDraft.personId,
    name: baseDraft.name,
    address: readString(overrideDraft.address) || baseDraft.address,
    phone: readString(overrideDraft.phone) || baseDraft.phone,
    role: readString(overrideDraft.role) || baseDraft.role,
  };
}

async function canonicalizeDraftIfExisting(draft: {
  personId?: string | null;
  name: string;
  address: string;
  phone: string;
  role: string;
}) {
  const existingCrewMember = await resolveExistingCrewMemberForDraft(draft).catch(() => null);
  return existingCrewMember ? canonicalizePickupSuggestionDraft(draft, existingCrewMember) : draft;
}

function buildRelaxedPickupConstraints(constraints: PickupSuggestionConstraints | null | undefined) {
  return normalizePickupSuggestionConstraints({
    ...constraints,
    latestArrivalIsRequired: false,
    requirePreferredVan: false,
  });
}

function needsRelaxedPickupFallback(constraints: PickupSuggestionConstraints | null | undefined) {
  const normalizedConstraints = normalizePickupSuggestionConstraints(constraints);
  return Boolean(normalizedConstraints.latestArrivalIsRequired || normalizedConstraints.requirePreferredVan);
}

function isPickupOptionsQuestion(question: string) {
  const normalizedQuestion = question.toLowerCase();

  return (
    /\bwhich vans?\b/.test(normalizedQuestion) ||
    /\bwhat vans?\b/.test(normalizedQuestion) ||
    (/\bvan\b/.test(normalizedQuestion) && /\bwould work\b/.test(normalizedQuestion)) ||
    (/\bvan\b/.test(normalizedQuestion) && /\boptions?\b/.test(normalizedQuestion))
  );
}

async function resolvePickupSuggestionWithFallbacks(
  draft: {
    personId?: string | null;
    name: string;
    address: string;
    phone: string;
    role: string;
  },
  requestedConstraints: PickupSuggestionConstraints | null | undefined,
) {
  const strictSuggestion = await suggestPickupAssignment(draft, requestedConstraints).catch(() => null);

  if (strictSuggestion) {
    const strictAction = buildPickupSuggestionAction(draft, strictSuggestion, requestedConstraints);
    return {
      answer: buildPickupSuggestionAnswer(draft, strictSuggestion, requestedConstraints),
      action: strictAction,
      usedRelaxedFallback: false,
    };
  }

  if (!needsRelaxedPickupFallback(requestedConstraints)) {
    return null;
  }

  const relaxedConstraints = buildRelaxedPickupConstraints(requestedConstraints);
  const relaxedSuggestion = await suggestPickupAssignment(draft, relaxedConstraints).catch(() => null);
  const preferredVanConstraints = normalizePickupSuggestionConstraints({
    ...requestedConstraints,
    latestArrivalIsRequired: false,
    requirePreferredVan: true,
  });
  const forcedPreferredVanSuggestion = preferredVanConstraints.preferredVan
    ? await suggestPickupAssignment(draft, preferredVanConstraints).catch(() => null)
    : null;

  if (
    normalizePickupSuggestionConstraints(requestedConstraints).latestArrivalIsRequired &&
    (!relaxedSuggestion || getPickupSuggestionLateArrivalMinutes(relaxedSuggestion, requestedConstraints) > 0)
  ) {
    return {
      answer: buildPickupSuggestionNoValidDeadlineAnswer(
        draft,
        requestedConstraints,
        relaxedSuggestion,
        forcedPreferredVanSuggestion,
      ),
      action: null,
      usedRelaxedFallback: true,
    };
  }

  if (!relaxedSuggestion) {
    return null;
  }

  const relaxedAction = buildPickupSuggestionAction(draft, relaxedSuggestion, relaxedConstraints);

  return {
    answer: buildPickupSuggestionFallbackAnswer(
      draft,
      requestedConstraints,
      relaxedSuggestion,
      forcedPreferredVanSuggestion,
    ),
    action: relaxedAction,
    usedRelaxedFallback: true,
  };
}

type PickupSuggestionResolution = Awaited<ReturnType<typeof resolvePickupSuggestionWithFallbacks>>;

export async function answerDispatchQuestion(question: string) {
  const requestId = createRequestId();
  const startedAt = Date.now();
  const trimmedQuestion = question.trim();

  if (!trimmedQuestion) {
    throw new Error("Ask a question for the dispatch assistant.");
  }

  if (!process.env.OPENAI_API_KEY) {
    throw new Error("Set OPENAI_API_KEY before using the dispatch assistant.");
  }

  const currentUser = await getCurrentUser().catch(() => null);
  const intentStartedAt = Date.now();
  const extractedIntent = await extractDispatchIntent(trimmedQuestion).catch(() => null);
  const intentDraft = buildPickupSuggestionDraftFromIntent(extractedIntent);
  const intentConstraints = buildPickupSuggestionConstraintsFromIntent(extractedIntent);
  const rawParsedDraftFromQuestion = intentDraft ?? extractPickupSuggestionDraftFromQuestion(trimmedQuestion);
  const parsedDraftFromQuestion = rawParsedDraftFromQuestion
    ? await canonicalizeDraftIfExisting(rawParsedDraftFromQuestion)
    : null;
  const pickupIntent =
    isStructuredPickupAssignmentIntent(extractedIntent) || isPickupAssignmentIntent(trimmedQuestion);
  const pickupOptionsIntent = pickupIntent && isPickupOptionsQuestion(trimmedQuestion);

  dispatchDebugLog("assistant.question.received", {
    requestId,
    question: trimmedQuestion,
    currentUser: currentUser?.name ?? null,
    intentDurationMs: Date.now() - intentStartedAt,
    extractedIntent,
    intentDraft: summarizePickupDraft(intentDraft),
    intentConstraints: summarizeConstraints(intentConstraints),
    parsedDraftFromQuestion: summarizePickupDraft(parsedDraftFromQuestion),
    pickupIntent,
    pickupOptionsIntent,
  });

  if (pickupIntent) {
    try {
      const directResolutionStartedAt = Date.now();
      const [directPeopleRows, transportPlan] = await Promise.all([fetchPeopleRecords(), getTransportPlan()]);
      const directPeople = directPeopleRows.map((row) =>
        mapCrewMemberRowToAssignmentCandidatePerson(row, transportPlan),
      );
      const directPerson = pickBestPersonForAssignment(
        [trimmedQuestion, extractedIntent?.personName, extractedIntent?.personAddress].filter(Boolean).join(" "),
        directPeople,
      );

      dispatchDebugLog("assistant.direct-match", {
        requestId,
        matchedPerson: directPerson
          ? {
              id: directPerson.id,
              name: directPerson.name,
              address: directPerson.address,
              pickupToLocation: directPerson.pickupToLocation,
            }
          : null,
        directPeopleCount: directPeople.length,
      });

      if (directPerson) {
        const directPersonRow = directPeopleRows.find((row) => row.id === directPerson.id) ?? null;
        const directDraft = mergePickupSuggestionDrafts(
          directPersonRow
            ? buildPickupSuggestionDraftFromCrewMemberRow(directPersonRow, transportPlan)
            : buildPickupSuggestionDraftFromPerson(directPerson),
          intentDraft,
        );

        if (!directDraft.address) {
          return {
            answer: `I found ${directDraft.name}, but I still need their address before I can create a pickup assignment. Could you share it?`,
            action: null,
          };
        }

        if (pickupOptionsIntent) {
          const directOptions = await suggestPickupAssignmentOptions(directDraft, intentConstraints, {
            limit: 3,
            distinctByVan: true,
          });

          if (directOptions.length > 1) {
            const choiceAction = buildPickupSuggestionChoiceAction(
              buildPickupSuggestionChoiceOptions(directDraft, directOptions, intentConstraints),
              "Choose which van to assign.",
            );

            if (choiceAction) {
              dispatchDebugLog("assistant.direct-options", {
                requestId,
                draft: summarizePickupDraft(directDraft),
                action: summarizeAction(choiceAction),
              });

              return {
                answer: buildPickupSuggestionOptionsAnswer(directDraft, directOptions, intentConstraints),
                action: choiceAction,
              };
            }
          }
        }

        const directResolution = await resolvePickupSuggestionWithFallbacks(directDraft, intentConstraints);

        if (directResolution) {
          dispatchDebugLog("assistant.direct-suggestion", {
            requestId,
            draft: summarizePickupDraft(directDraft),
            action: summarizeAction(directResolution.action),
            usedRelaxedFallback: directResolution.usedRelaxedFallback,
            durationMs: Date.now() - directResolutionStartedAt,
          });

          return {
            answer: directResolution.answer,
            action: directResolution.action,
          };
        }
      }

      if (parsedDraftFromQuestion?.address && parsedDraftFromQuestion.name) {
        if (pickupOptionsIntent) {
          const parsedOptions = await suggestPickupAssignmentOptions(parsedDraftFromQuestion, intentConstraints, {
            limit: 3,
            distinctByVan: true,
          });

          if (parsedOptions.length > 1) {
            const choiceAction = buildPickupSuggestionChoiceAction(
              buildPickupSuggestionChoiceOptions(parsedDraftFromQuestion, parsedOptions, intentConstraints),
              "Choose which van to assign.",
            );

            if (choiceAction) {
              dispatchDebugLog("assistant.parsed-draft-options", {
                requestId,
                draft: summarizePickupDraft(parsedDraftFromQuestion),
                action: summarizeAction(choiceAction),
              });

              return {
                answer: buildPickupSuggestionOptionsAnswer(
                  parsedDraftFromQuestion,
                  parsedOptions,
                  intentConstraints,
                ),
                action: choiceAction,
              };
            }
          }
        }

        const parsedResolution = await resolvePickupSuggestionWithFallbacks(parsedDraftFromQuestion, intentConstraints);

        if (parsedResolution) {
          dispatchDebugLog("assistant.parsed-draft-suggestion", {
            requestId,
            draft: summarizePickupDraft(parsedDraftFromQuestion),
            action: summarizeAction(parsedResolution.action),
            usedRelaxedFallback: parsedResolution.usedRelaxedFallback,
            durationMs: Date.now() - directResolutionStartedAt,
          });

          return {
            answer: parsedResolution.answer,
            action: parsedResolution.action,
          };
        }
      }
    } catch (error) {
      dispatchDebugLog("assistant.direct-resolution-error", {
        requestId,
        error,
        extractedIntent,
        parsedDraftFromQuestion: summarizePickupDraft(parsedDraftFromQuestion),
        durationMs: Date.now() - startedAt,
      });
    }
  }

  const modelStartedAt = Date.now();
  dispatchDebugLog("assistant.model-start", {
    requestId,
    pickupIntent,
    parsedDraftFromQuestion: summarizePickupDraft(parsedDraftFromQuestion),
    intentConstraints: summarizeConstraints(intentConstraints),
  });

  const result = await generateText({
    model: getDispatchModel(),
    system: [
      "You are the Kordi dispatch assistant.",
      "Answer using the app's live transport data.",
      "Use tools before making operational claims.",
      "When you recommend a concrete pickup assignment for a new rider, end with a short call to action asking whether you should apply it.",
      "Be concise, concrete, and action-oriented.",
      currentUser ? `Current signed-in user: ${currentUser.name}.` : null,
    ]
      .filter(Boolean)
      .join(" "),
    prompt: trimmedQuestion,
    stopWhen: stepCountIs(5),
    temperature: 0,
    tools: createDispatchTools(),
  });

  dispatchDebugLog("assistant.model-response", {
    requestId,
    durationMs: Date.now() - modelStartedAt,
    text: result.text,
    toolResults: result.toolResults.map((entry) =>
      summarizeToolResult(entry as { type: string; toolName?: string; input?: unknown; output?: unknown }),
    ),
  });

  const suggestionToolResult = result.toolResults.find(
    (entry) => entry.type === "tool-result" && entry.toolName === "suggest_pickup_assignment" && entry.output,
  );
  const action =
    suggestionToolResult &&
    suggestionToolResult.type === "tool-result" &&
    suggestionToolResult.toolName === "suggest_pickup_assignment" &&
    suggestionToolResult.output
      ? buildPickupSuggestionAction(
          await canonicalizeDraftIfExisting({
            personId: null,
            name: readString((suggestionToolResult.input as { name?: unknown }).name),
            address: readString((suggestionToolResult.input as { address?: unknown }).address),
            phone: readString((suggestionToolResult.input as { phone?: unknown }).phone),
            role: readString((suggestionToolResult.input as { role?: unknown }).role),
          }),
          suggestionToolResult.output as PickupAssignmentSuggestion,
          suggestionToolResult.input &&
            typeof suggestionToolResult.input === "object" &&
            "constraints" in suggestionToolResult.input
            ? normalizePickupSuggestionConstraints(
                (suggestionToolResult.input as { constraints?: Partial<PickupSuggestionConstraints> }).constraints,
              )
            : intentConstraints,
        )
      : null;
  const peopleFromToolResults = result.toolResults
    .filter((entry) => entry.type === "tool-result" && entry.toolName === "find_people")
    .flatMap((entry) => {
      const output = entry.output;
      return Array.isArray(output) ? output : [];
    });
  const personDraftFromToolResults =
    !action && pickupIntent ? pickBestPersonForAssignment(trimmedQuestion, peopleFromToolResults) : null;
  const peopleFromDatabase =
    !action && !personDraftFromToolResults && pickupIntent
      ? (await fetchPeopleRecords()).map(mapCrewMemberRowToCandidatePerson)
      : [];
  const personDraftFromDatabase =
    !action && !personDraftFromToolResults && peopleFromDatabase.length > 0
      ? pickBestPersonForAssignment(trimmedQuestion, peopleFromDatabase)
      : null;
  const fallbackResolution: PickupSuggestionResolution =
    !action && parsedDraftFromQuestion
      ? await resolvePickupSuggestionWithFallbacks(parsedDraftFromQuestion, intentConstraints)
          .then((result) => result ?? null)
          .catch(() => null)
      : null;
  const personFallbackResolution: PickupSuggestionResolution =
    !action && !fallbackResolution && personDraftFromToolResults
      ? await resolvePickupSuggestionWithFallbacks(
          buildPickupSuggestionDraftFromPerson(personDraftFromToolResults),
          intentConstraints,
        )
          .then((result) => result ?? null)
          .catch(() => null)
      : null;
  const directDatabaseFallbackResolution: PickupSuggestionResolution =
    !action && !fallbackResolution && !personFallbackResolution && personDraftFromDatabase
      ? await resolvePickupSuggestionWithFallbacks(
          buildPickupSuggestionDraftFromPerson(personDraftFromDatabase),
          intentConstraints,
        )
          .then((result) => result ?? null)
          .catch(() => null)
      : null;
  const fallbackResolutionResult =
    fallbackResolution ?? personFallbackResolution ?? directDatabaseFallbackResolution;
  const finalAction = action ?? fallbackResolutionResult?.action ?? null;
  const answer =
    !action && fallbackResolutionResult
      ? fallbackResolutionResult.answer
      : finalAction?.type === "apply-pickup-suggestion" && pickupIntent
      ? buildPickupSuggestionAnswer(finalAction.draft, finalAction.suggestion, finalAction.constraints)
      : finalAction?.type === "choose-pickup-suggestion"
      ? result.text.trim()
      : finalAction && !/apply this for you\??/i.test(result.text)
      ? `${result.text.trim()}\n\nDo you want me to apply this for you?`
      : result.text.trim();

  dispatchDebugLog("assistant.final", {
    requestId,
    totalDurationMs: Date.now() - startedAt,
    answer,
    action: summarizeAction(finalAction),
    usedToolAction: Boolean(action),
    usedFallbackAction: Boolean(!action && fallbackResolutionResult),
  });

  return {
    answer,
    action: finalAction as DispatchAssistantAction | null,
  };
}

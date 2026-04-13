import "server-only";

import { generateText, stepCountIs } from "ai";

import { getCurrentUser } from "@/lib/auth";
import { getDispatchModel } from "@/lib/ai/dispatch/model";
import {
  buildPickupSuggestionDraftFromPerson,
  extractPickupSuggestionDraftFromQuestion,
  fetchPeopleRecords,
  isPickupAssignmentIntent,
  mapCrewMemberRowToCandidatePerson,
  pickBestPersonForAssignment,
} from "@/lib/ai/dispatch/people";
import {
  buildPickupSuggestionAction,
  buildPickupSuggestionAnswer,
  suggestPickupAssignment,
} from "@/lib/ai/dispatch/pickups";
import { createDispatchTools } from "@/lib/ai/dispatch/tools";
import type {
  DispatchAssistantAction,
  PickupAssignmentSuggestion,
} from "@/lib/ai/dispatch/types";
import { readString } from "@/lib/ai/dispatch/utils";

export async function answerDispatchQuestion(question: string) {
  const trimmedQuestion = question.trim();

  if (!trimmedQuestion) {
    throw new Error("Ask a question for the dispatch assistant.");
  }

  if (!process.env.OPENAI_API_KEY) {
    throw new Error("Set OPENAI_API_KEY before using the dispatch assistant.");
  }

  const currentUser = await getCurrentUser().catch(() => null);
  const parsedDraftFromQuestion = extractPickupSuggestionDraftFromQuestion(trimmedQuestion);
  const pickupIntent = isPickupAssignmentIntent(trimmedQuestion);

  if (pickupIntent) {
    const directPeople = (await fetchPeopleRecords()).map(mapCrewMemberRowToCandidatePerson);
    const directPerson = pickBestPersonForAssignment(trimmedQuestion, directPeople);

    if (directPerson) {
      const directDraft = buildPickupSuggestionDraftFromPerson(directPerson);

      if (!directDraft.address) {
        return {
          answer: `I found ${directDraft.name}, but I still need their address before I can create a pickup assignment. Could you share it?`,
          action: null,
        };
      }

      const directSuggestion = await suggestPickupAssignment(directDraft).catch(() => null);

      if (directSuggestion) {
        return {
          answer: buildPickupSuggestionAnswer(directDraft, directSuggestion),
          action: buildPickupSuggestionAction(directDraft, directSuggestion),
        };
      }
    }

    if (parsedDraftFromQuestion?.address) {
      const directSuggestion = await suggestPickupAssignment(parsedDraftFromQuestion).catch(() => null);

      if (directSuggestion) {
        return {
          answer: buildPickupSuggestionAnswer(parsedDraftFromQuestion, directSuggestion),
          action: buildPickupSuggestionAction(parsedDraftFromQuestion, directSuggestion),
        };
      }
    }
  }

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
    temperature: 0.2,
    tools: createDispatchTools(),
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
          {
            name: readString((suggestionToolResult.input as { name?: unknown }).name),
            address: readString((suggestionToolResult.input as { address?: unknown }).address),
            phone: readString((suggestionToolResult.input as { phone?: unknown }).phone),
            role: readString((suggestionToolResult.input as { role?: unknown }).role),
          },
          suggestionToolResult.output as PickupAssignmentSuggestion,
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
  const fallbackAction =
    !action && parsedDraftFromQuestion
      ? await suggestPickupAssignment(parsedDraftFromQuestion)
          .then((suggestion) =>
            suggestion ? buildPickupSuggestionAction(parsedDraftFromQuestion, suggestion) : null,
          )
          .catch(() => null)
      : null;
  const personFallbackAction =
    !action && !fallbackAction && personDraftFromToolResults
      ? await suggestPickupAssignment(buildPickupSuggestionDraftFromPerson(personDraftFromToolResults))
          .then((suggestion) =>
            suggestion
              ? buildPickupSuggestionAction(
                  buildPickupSuggestionDraftFromPerson(personDraftFromToolResults),
                  suggestion,
                )
              : null,
          )
          .catch(() => null)
      : null;
  const directDatabaseFallbackAction =
    !action && !fallbackAction && !personFallbackAction && personDraftFromDatabase
      ? await suggestPickupAssignment(buildPickupSuggestionDraftFromPerson(personDraftFromDatabase))
          .then((suggestion) =>
            suggestion
              ? buildPickupSuggestionAction(
                  buildPickupSuggestionDraftFromPerson(personDraftFromDatabase),
                  suggestion,
                )
              : null,
          )
          .catch(() => null)
      : null;
  const finalAction = action ?? fallbackAction ?? personFallbackAction ?? directDatabaseFallbackAction;
  const answer =
    finalAction && !/apply this for you\??/i.test(result.text)
      ? `${result.text.trim()}\n\nDo you want me to apply this for you?`
      : result.text.trim();

  return {
    answer,
    action: finalAction as DispatchAssistantAction | null,
  };
}

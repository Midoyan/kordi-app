import { normalizePickupSuggestionConstraints } from "@/lib/ai/dispatch/intents";
import type {
  DispatchAssistantAction,
  PickupAssignmentSuggestion,
  PickupSuggestionChoice,
  PickupSuggestionConstraints,
  PickupSuggestionDraft,
} from "@/lib/ai/dispatch/types";

import { normalizePickupSuggestionDraft } from "@/lib/ai/dispatch/pickup-suggestions/shared";

export function buildPickupSuggestionAction(
  draft: PickupSuggestionDraft,
  suggestion: PickupAssignmentSuggestion,
  constraints?: PickupSuggestionConstraints | null,
): DispatchAssistantAction {
  return {
    type: "apply-pickup-suggestion",
    label: "Apply suggestion",
    draft: normalizePickupSuggestionDraft(draft),
    constraints: normalizePickupSuggestionConstraints(constraints),
    suggestion,
  };
}

export function buildPickupSuggestionChoiceAction(
  options: PickupSuggestionChoice[],
  prompt = "Choose which pickup option to apply.",
): DispatchAssistantAction | null {
  if (options.length === 0) {
    return null;
  }

  return {
    type: "choose-pickup-suggestion",
    label: "Apply one option",
    prompt,
    options,
  };
}

export function buildPickupSuggestionChoiceOptions(
  draftInput: PickupSuggestionDraft,
  suggestions: PickupAssignmentSuggestion[],
  constraintsInput?: PickupSuggestionConstraints | null,
) {
  const draft = normalizePickupSuggestionDraft(draftInput);
  const constraints = normalizePickupSuggestionConstraints(constraintsInput);

  return suggestions.map((suggestion) => ({
    id: suggestion.recommendationKey,
    label: `${suggestion.vanLabel} (${suggestion.arrivalTime})`,
    description: `Pickup ${suggestion.pickupTime} from ${suggestion.pickupAddress}`,
    draft,
    constraints,
    suggestion,
  })) satisfies PickupSuggestionChoice[];
}

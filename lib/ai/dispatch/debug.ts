import "server-only";

import type {
  DispatchAssistantAction,
  PickupAssignmentSuggestion,
  PickupSuggestionConstraints,
  PickupSuggestionDraft,
} from "@/lib/ai/dispatch/types";
import { readString } from "@/lib/ai/dispatch/utils";

function isDebugEnabled() {
  return process.env.DISPATCH_AI_DEBUG === "1" || process.env.NODE_ENV !== "production";
}

function truncateString(value: string, maxLength = 280) {
  return value.length > maxLength ? `${value.slice(0, maxLength)}...` : value;
}

function sanitizeValue(value: unknown, depth = 0): unknown {
  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      stack: value.stack,
    };
  }

  if (typeof value === "string") {
    return truncateString(value);
  }

  if (depth >= 4) {
    if (Array.isArray(value)) {
      return `[array(${value.length})]`;
    }

    if (value && typeof value === "object") {
      return "[object]";
    }
  }

  if (Array.isArray(value)) {
    return value.slice(0, 8).map((entry) => sanitizeValue(entry, depth + 1));
  }

  if (!value || typeof value !== "object") {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value)
      .slice(0, 20)
      .map(([key, entryValue]) => [key, sanitizeValue(entryValue, depth + 1)]),
  );
}

export function dispatchDebugLog(event: string, payload?: unknown) {
  if (!isDebugEnabled()) {
    return;
  }

  if (typeof payload === "undefined") {
    console.log(`[dispatch-ai] ${event}`);
    return;
  }

  console.log(`[dispatch-ai] ${event}`, sanitizeValue(payload));
}

export function summarizePickupDraft(draft?: Partial<PickupSuggestionDraft> | null) {
  if (!draft) {
    return null;
  }

  return {
    personId: readString(draft.personId),
    name: readString(draft.name),
    address: readString(draft.address),
    phone: readString(draft.phone),
    role: readString(draft.role),
  };
}

export function summarizeConstraints(constraints?: Partial<PickupSuggestionConstraints> | null) {
  if (!constraints) {
    return null;
  }

  return {
    destinationQuery: readString(constraints.destinationQuery),
    latestArrivalTime: readString(constraints.latestArrivalTime),
    latestArrivalTimeRaw: readString(constraints.latestArrivalTimeRaw),
    latestArrivalTimeIsAmbiguous: Boolean(constraints.latestArrivalTimeIsAmbiguous),
    latestArrivalIsRequired: Boolean(constraints.latestArrivalIsRequired),
    preferredVan: readString(constraints.preferredVan),
    requirePreferredVan: Boolean(constraints.requirePreferredVan),
  };
}

export function summarizePickupSuggestion(suggestion?: Partial<PickupAssignmentSuggestion> | null) {
  if (!suggestion) {
    return null;
  }

  return {
    recommendationKey: readString(suggestion.recommendationKey),
    assignmentType: suggestion.assignmentType ?? null,
    driveId: readString(suggestion.driveId),
    driveLabel: readString(suggestion.driveLabel),
    vanId: readString(suggestion.vanId),
    vanLabel: readString(suggestion.vanLabel),
    stopId: readString(suggestion.stopId),
    stopTitle: readString(suggestion.stopTitle),
    pickupAddress: readString(suggestion.pickupAddress),
    pickupTime: readString(suggestion.pickupTime),
    arrivalTime: readString(suggestion.arrivalTime),
    destinationAddress: readString(suggestion.destinationAddress),
    routeDeltaMinutes:
      typeof suggestion.routeDeltaMinutes === "number" ? suggestion.routeDeltaMinutes : null,
    currentPassengerCount:
      typeof suggestion.currentPassengerCount === "number" ? suggestion.currentPassengerCount : null,
    remainingSeatsBeforeAssignment:
      typeof suggestion.remainingSeatsBeforeAssignment === "number"
        ? suggestion.remainingSeatsBeforeAssignment
        : suggestion.remainingSeatsBeforeAssignment === null
          ? null
          : null,
    explanation: readString(suggestion.explanation),
    reasoningCount: Array.isArray(suggestion.reasoning) ? suggestion.reasoning.length : 0,
  };
}

export function summarizeAction(action?: DispatchAssistantAction | null) {
  if (!action) {
    return null;
  }

  return {
    type: action.type,
    label: action.label,
    draft: summarizePickupDraft(action.draft),
    constraints: summarizeConstraints(action.constraints),
    suggestion: summarizePickupSuggestion(action.suggestion),
  };
}

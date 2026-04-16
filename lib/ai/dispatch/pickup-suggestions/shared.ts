import type { PickupAssignmentSuggestion, PickupSuggestionDraft } from "@/lib/ai/dispatch/types";
import { readString } from "@/lib/ai/dispatch/utils";

export type CandidateEvaluation = {
  suggestion: PickupAssignmentSuggestion;
  score: number;
};

export type ExistingPickupAssignment = {
  driveId: string;
  stopId: string;
  stopDeleted: boolean;
  stopSnapshot: {
    id: string;
    driveId: string;
    pickupAddress: string;
    pickupTime: string | null;
    stopTitle: string;
    stopDurationSec: number | null;
    trafficBufferSec: number | null;
    notes: string | null;
  };
  remainingPassengerCount: number;
};

export function normalizePickupSuggestionDraft(draft: PickupSuggestionDraft): PickupSuggestionDraft {
  return {
    personId: typeof draft.personId === "string" && draft.personId.trim() ? draft.personId.trim() : null,
    name: readString(draft.name),
    address: readString(draft.address),
    phone: readString(draft.phone),
    role: readString(draft.role),
  };
}

export function validatePickupSuggestionDraft(draft: PickupSuggestionDraft) {
  if (!draft.name) {
    return "Name is required.";
  }

  if (!draft.address) {
    return "Address is required before the assistant can place this pickup.";
  }

  return null;
}

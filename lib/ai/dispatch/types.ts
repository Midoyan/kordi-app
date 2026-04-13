export type DispatchAssistantQuestionRequest = {
  question: string;
};

export type DispatchAssistantQuestionResponse = {
  answer: string;
  action?: DispatchAssistantAction | null;
};

export type DispatchAssistantAction =
  | {
      type: "apply-pickup-suggestion";
      label: string;
      draft: PickupSuggestionDraft;
      suggestion: PickupAssignmentSuggestion;
    };

export type PickupSuggestionDraft = {
  personId?: string | null;
  name: string;
  address: string;
  phone: string;
  role: string;
};

export type PickupPlanStop = {
  id: string | null;
  stopTitle: string;
  pickupAddress: string;
  pickupTime: string;
  isNew: boolean;
};

export type PickupAssignmentSuggestion = {
  recommendationKey: string;
  assignmentType: "existing-stop" | "new-stop";
  driveId: string;
  driveLabel: string;
  vanId: string | null;
  vanLabel: string;
  seatCapacity: number | null;
  currentPassengerCount: number;
  remainingSeatsBeforeAssignment: number | null;
  stopId: string | null;
  stopTitle: string;
  pickupAddress: string;
  pickupTime: string;
  destinationAddress: string;
  routeDeltaMinutes: number;
  reasoning: string[];
  explanation: string;
  stopPlan: PickupPlanStop[];
};

export type PickupSuggestionRequest = {
  draft: PickupSuggestionDraft;
};

export type PickupSuggestionResponse = {
  suggestion: PickupAssignmentSuggestion | null;
};

export type ApplyPickupSuggestionRequest = {
  draft: PickupSuggestionDraft;
  suggestion: PickupAssignmentSuggestion;
};

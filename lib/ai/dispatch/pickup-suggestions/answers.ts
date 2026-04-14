import { normalizePickupSuggestionConstraints } from "@/lib/ai/dispatch/intents";
import type {
  PickupAssignmentSuggestion,
  PickupSuggestionConstraints,
  PickupSuggestionDraft,
} from "@/lib/ai/dispatch/types";

import { getLateArrivalMinutes, suggestionMatchesPreferredVan } from "@/lib/ai/dispatch/pickup-suggestions/scoring";

export function buildPickupSuggestionAnswer(
  draft: PickupSuggestionDraft,
  suggestion: PickupAssignmentSuggestion,
  constraints?: PickupSuggestionConstraints | null,
) {
  const normalizedConstraints = normalizePickupSuggestionConstraints(constraints);
  const subject = draft.name || "This person";
  const lateArrivalMinutes = getLateArrivalMinutes(suggestion.arrivalTime, normalizedConstraints);
  const arrivalTargetLabel =
    normalizedConstraints.latestArrivalTimeIsAmbiguous && normalizedConstraints.latestArrivalTimeRaw
      ? `"${normalizedConstraints.latestArrivalTimeRaw}"`
      : normalizedConstraints.latestArrivalTime;
  const timingDetail = normalizedConstraints.latestArrivalTime
    ? lateArrivalMinutes > 0
      ? `${subject} would arrive at ${suggestion.arrivalTime || "the current drive time"}, which is ${lateArrivalMinutes} minute${lateArrivalMinutes === 1 ? "" : "s"} later than ${arrivalTargetLabel}.`
      : `${subject} would arrive at ${suggestion.arrivalTime || "the current drive time"}, which stays on or before ${arrivalTargetLabel}.`
    : "";
  const preferredVanMatched = suggestionMatchesPreferredVan(suggestion, normalizedConstraints);
  const seatDetail =
    suggestion.remainingSeatsBeforeAssignment !== null
      ? `${suggestion.remainingSeatsBeforeAssignment} seat${suggestion.remainingSeatsBeforeAssignment === 1 ? "" : "s"} remain before assignment`
      : "capacity looks open";
  const routeDetail =
    suggestion.routeDeltaMinutes > 0
      ? `adds ${suggestion.routeDeltaMinutes} extra minute${suggestion.routeDeltaMinutes === 1 ? "" : "s"}`
      : "keeps the route unchanged";
  const startShiftDetail =
    suggestion.firstPickupShiftMinutes > 0 && suggestion.updatedFirstPickupTime
      ? ` The first pickup on this van would move ${suggestion.firstPickupShiftMinutes} minute${suggestion.firstPickupShiftMinutes === 1 ? "" : "s"} earlier, to ${suggestion.updatedFirstPickupTime}.`
      : "";

  if (normalizedConstraints.preferredVan && !preferredVanMatched) {
    return `Not really. ${normalizedConstraints.preferredVan} is not the best fit for this request. Best live option is ${suggestion.vanLabel} on "${suggestion.driveLabel}", picking up ${subject} at ${suggestion.pickupTime} from ${suggestion.pickupAddress} and arriving at ${suggestion.arrivalTime}. This ${routeDetail}, and ${seatDetail}.${startShiftDetail}${timingDetail ? ` ${timingDetail}` : ""}\n\nDo you want me to apply this instead?`;
  }

  if (lateArrivalMinutes > 0 && normalizedConstraints.latestArrivalTime) {
    return `Maybe. I do not see a live pickup that gets ${subject} there by ${arrivalTargetLabel}. The closest fit is ${suggestion.vanLabel} on "${suggestion.driveLabel}", picking up at ${suggestion.pickupTime} from ${suggestion.pickupAddress} and arriving at ${suggestion.arrivalTime}. This ${routeDetail}, and ${seatDetail}.${startShiftDetail}${timingDetail ? ` ${timingDetail}` : ""}\n\nDo you want me to apply this closest option?`;
  }

  return `Yes. ${suggestion.vanLabel} can pick up ${subject} at ${suggestion.pickupTime} from ${suggestion.pickupAddress} on "${suggestion.driveLabel}" and arrive at ${suggestion.arrivalTime}. This ${routeDetail}, and ${seatDetail}.${startShiftDetail}${timingDetail ? ` ${timingDetail}` : ""}\n\nDo you want me to apply this?`;
}

export function buildPickupSuggestionFallbackAnswer(
  draft: PickupSuggestionDraft,
  requestedConstraints: PickupSuggestionConstraints | null | undefined,
  suggestion: PickupAssignmentSuggestion,
  forcedPreferredVanSuggestion?: PickupAssignmentSuggestion | null,
) {
  const normalizedRequestedConstraints = normalizePickupSuggestionConstraints(requestedConstraints);
  const subject = draft.name || "This person";
  const arrivalTargetLabel =
    normalizedRequestedConstraints.latestArrivalTimeIsAmbiguous &&
    normalizedRequestedConstraints.latestArrivalTimeRaw
      ? `"${normalizedRequestedConstraints.latestArrivalTimeRaw}"`
      : normalizedRequestedConstraints.latestArrivalTime;
  const preferredVanMatched = suggestionMatchesPreferredVan(suggestion, normalizedRequestedConstraints);
  const lateArrivalMinutes = getLateArrivalMinutes(suggestion.arrivalTime, normalizedRequestedConstraints);
  const alternativeSentence = `Best live option is ${suggestion.vanLabel} on "${suggestion.driveLabel}", picking up ${subject} at ${suggestion.pickupTime} from ${suggestion.pickupAddress} and arriving at ${suggestion.arrivalTime}.`;

  if (normalizedRequestedConstraints.preferredVan && !preferredVanMatched) {
    const forcedPreferredVanLateMinutes = forcedPreferredVanSuggestion
      ? getLateArrivalMinutes(forcedPreferredVanSuggestion.arrivalTime, normalizedRequestedConstraints)
      : 0;
    const forcedPreferredVanDetail = forcedPreferredVanSuggestion
      ? forcedPreferredVanLateMinutes > 0 && arrivalTargetLabel
        ? ` If we force ${normalizedRequestedConstraints.preferredVan} anyway, ${subject} would arrive at ${forcedPreferredVanSuggestion.arrivalTime}, which is ${forcedPreferredVanLateMinutes} minute${forcedPreferredVanLateMinutes === 1 ? "" : "s"} later than ${arrivalTargetLabel}.`
        : ` If we force ${normalizedRequestedConstraints.preferredVan} anyway, the best live slot I can see is "${forcedPreferredVanSuggestion.driveLabel}", arriving at ${forcedPreferredVanSuggestion.arrivalTime}.`
      : ` I do not see a workable live pickup slot on ${normalizedRequestedConstraints.preferredVan} from ${draft.address}.`;

    return `Not really. ${normalizedRequestedConstraints.preferredVan} is not the best fit for this request. ${alternativeSentence}${forcedPreferredVanDetail}\n\nDo you want me to apply the better alternative instead?`;
  }

  if (lateArrivalMinutes > 0 && arrivalTargetLabel) {
    return `Maybe. I do not see a live option that gets ${subject} there by ${arrivalTargetLabel}. ${alternativeSentence} That arrives ${lateArrivalMinutes} minute${lateArrivalMinutes === 1 ? "" : "s"} later than requested.\n\nDo you want me to apply this closest option instead?`;
  }

  return buildPickupSuggestionAnswer(draft, suggestion, normalizedRequestedConstraints);
}

export function buildPickupSuggestionNoValidDeadlineAnswer(
  draft: PickupSuggestionDraft,
  requestedConstraints: PickupSuggestionConstraints | null | undefined,
  closestSuggestion?: PickupAssignmentSuggestion | null,
  forcedPreferredVanSuggestion?: PickupAssignmentSuggestion | null,
) {
  const normalizedRequestedConstraints = normalizePickupSuggestionConstraints(requestedConstraints);
  const subject = draft.name || "This person";
  const arrivalTargetLabel =
    normalizedRequestedConstraints.latestArrivalTimeIsAmbiguous &&
    normalizedRequestedConstraints.latestArrivalTimeRaw
      ? `"${normalizedRequestedConstraints.latestArrivalTimeRaw}"`
      : normalizedRequestedConstraints.latestArrivalTime || "the requested time";

  const closestSuggestionDetail = closestSuggestion
    ? ` The closest live option is ${closestSuggestion.vanLabel} on "${closestSuggestion.driveLabel}", picking up ${subject} at ${closestSuggestion.pickupTime} from ${closestSuggestion.pickupAddress} and arriving at ${closestSuggestion.arrivalTime}.`
    : "";
  const closestLateArrivalMinutes = closestSuggestion
    ? getLateArrivalMinutes(closestSuggestion.arrivalTime, normalizedRequestedConstraints)
    : 0;
  const closestLateDetail =
    closestSuggestion && closestLateArrivalMinutes > 0
      ? ` That still misses the deadline by ${closestLateArrivalMinutes} minute${closestLateArrivalMinutes === 1 ? "" : "s"}.`
      : "";
  const forcedPreferredVanLateMinutes = forcedPreferredVanSuggestion
    ? getLateArrivalMinutes(forcedPreferredVanSuggestion.arrivalTime, normalizedRequestedConstraints)
    : 0;
  const preferredVanDetail =
    normalizedRequestedConstraints.preferredVan && forcedPreferredVanSuggestion
      ? forcedPreferredVanLateMinutes > 0
        ? ` If we force ${normalizedRequestedConstraints.preferredVan}, ${subject} would arrive at ${forcedPreferredVanSuggestion.arrivalTime}, which is ${forcedPreferredVanLateMinutes} minute${forcedPreferredVanLateMinutes === 1 ? "" : "s"} late.`
        : ` ${normalizedRequestedConstraints.preferredVan} does have a live slot, but it still needs a manual dispatch check before I would auto-apply it.`
      : normalizedRequestedConstraints.preferredVan
        ? ` I also do not see a live ${normalizedRequestedConstraints.preferredVan} slot that meets that deadline.`
        : "";

  return `No. I do not see a live pickup option that gets ${subject} to the destination by ${arrivalTargetLabel}.${closestSuggestionDetail}${closestLateDetail}${preferredVanDetail} To make that deadline work, we would need a manual reschedule of an earlier pickup run, or a separate taxi/new van.`;
}

export function buildPickupSuggestionOptionsAnswer(
  draft: PickupSuggestionDraft,
  suggestions: PickupAssignmentSuggestion[],
  constraintsInput?: PickupSuggestionConstraints | null,
) {
  const constraints = normalizePickupSuggestionConstraints(constraintsInput);
  const subject = draft.name || "This person";
  const routeLabel = suggestions[0]
    ? `${suggestions[0].pickupAddress} -> ${suggestions[0].destinationAddress}`
    : draft.address;
  const lines = suggestions.map(
    (suggestion) =>
      `- ${suggestion.vanLabel}: pickup ${suggestion.pickupTime}, arrive ${suggestion.arrivalTime}, ${Math.max(0, suggestion.routeDeltaMinutes)} extra minute${Math.abs(suggestion.routeDeltaMinutes) === 1 ? "" : "s"}${suggestion.firstPickupShiftMinutes > 0 ? `, first pickup moves ${suggestion.firstPickupShiftMinutes} minute${suggestion.firstPickupShiftMinutes === 1 ? "" : "s"} earlier` : ""}`,
  );
  const constraintLine = constraints.latestArrivalTime ? `Target arrival: ${constraints.latestArrivalTime}.` : "";

  return `For ${subject} (${routeLabel}), these live van options would work:\n${lines.join("\n")}${constraintLine ? `\n\n${constraintLine}` : ""}\n\nChoose one below and I’ll apply it.`;
}

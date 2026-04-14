import "server-only";

import { generateText, stepCountIs } from "ai";

import {
  dispatchDebugLog,
  summarizeConstraints,
  summarizePickupDraft,
  summarizePickupSuggestion,
} from "@/lib/ai/dispatch/debug";
import { getDrivePlan, getTransportPlan, type Drive } from "@/lib/drive-plan";
import {
  assertMapboxToken,
  getLegDurationSeconds,
  optimizeScheduleStops,
  recalculateScheduleStops,
  type CoordinateCache,
} from "@/lib/mapbox-schedule";
import {
  normalizePickupSuggestionConstraints,
} from "@/lib/ai/dispatch/intents";
import { getDispatchModel } from "@/lib/ai/dispatch/model";
import {
  canonicalizePickupSuggestionDraft,
  findExistingCrewMemberForDraft,
  mapCrewMemberRowToPerson,
  resolveExistingCrewMemberForDraft,
} from "@/lib/ai/dispatch/people";
import {
  buildScheduleInputs,
  countUniquePassengers,
  getDriveArrivalTime,
} from "@/lib/ai/dispatch/transport";
import type {
  DispatchAssistantAction,
  PickupAssignmentSuggestion,
  PickupSuggestionConstraints,
  PickupPlanStop,
  PickupSuggestionDraft,
} from "@/lib/ai/dispatch/types";
import {
  normalizeAddressKey,
  normalizeSearchText,
  parseTimeToMinutes,
  readString,
} from "@/lib/ai/dispatch/utils";
import type { ScheduleStopInput } from "@/lib/schedule-recalculation";
import { createClient } from "@/lib/server";

type CandidateEvaluation = {
  suggestion: PickupAssignmentSuggestion;
  score: number;
};

type ExistingPickupAssignment = {
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

function normalizeDraft(draft: PickupSuggestionDraft): PickupSuggestionDraft {
  return {
    personId: typeof draft.personId === "string" && draft.personId.trim() ? draft.personId.trim() : null,
    name: readString(draft.name),
    address: readString(draft.address),
    phone: readString(draft.phone),
    role: readString(draft.role),
  };
}

export function buildPickupSuggestionAction(
  draft: PickupSuggestionDraft,
  suggestion: PickupAssignmentSuggestion,
  constraints?: PickupSuggestionConstraints | null,
): DispatchAssistantAction {
  return {
    type: "apply-pickup-suggestion",
    label: "Apply suggestion",
    draft: normalizeDraft(draft),
    constraints: normalizePickupSuggestionConstraints(constraints),
    suggestion,
  };
}

function validateDraft(draft: PickupSuggestionDraft) {
  if (!draft.name) {
    return "Name is required.";
  }

  if (!draft.address) {
    return "Address is required before the assistant can place this pickup.";
  }

  return null;
}

function normalizeTimingSeconds(value: number | null | undefined) {
  if (typeof value !== "number" || Number.isNaN(value) || value <= 0) {
    return 0;
  }

  return Math.round(value);
}

async function getRouteDurationSeconds(
  stops: ScheduleStopInput[],
  cache: CoordinateCache,
  token: string,
) {
  if (stops.length === 0) {
    return 0;
  }

  let totalSeconds = 0;

  for (let index = 0; index < stops.length; index += 1) {
    const currentStop = stops[index];
    const destinationAddress =
      index === stops.length - 1 ? currentStop.endDestination.trim() : stops[index + 1].pickupAddress.trim();

    totalSeconds += await getLegDurationSeconds(
      currentStop.pickupAddress,
      destinationAddress,
      cache,
      token,
    );
    totalSeconds += normalizeTimingSeconds(currentStop.stopDurationSec);
    totalSeconds += normalizeTimingSeconds(currentStop.trafficBufferSec);
  }

  return totalSeconds;
}

function buildStopPlan(
  drive: Drive,
  plannedStops: Array<ScheduleStopInput & { pickupTime: string }>,
  recommendationId: string,
): PickupPlanStop[] {
  return plannedStops.map((stop) => {
    const currentStop = drive.stops.find((entry) => entry.id === stop.id);

    return {
      id: currentStop?.id ?? null,
      stopTitle:
        currentStop?.stopTitle ??
        (stop.id === recommendationId ? `Pickup · ${drive.location?.name || "New stop"}` : "New stop"),
      pickupAddress: stop.pickupAddress.trim(),
      pickupTime: stop.pickupTime.trim(),
      isNew: !currentStop,
    };
  });
}

function createDeterministicReasoningParts(suggestion: PickupAssignmentSuggestion) {
  const parts = [
    `${suggestion.vanLabel} is the best-fit vehicle in the current pickup plan.`,
    `This places the stop at ${suggestion.pickupTime || "an unscheduled time"} for ${suggestion.destinationAddress || "the current destination"}.`,
    `${Math.max(0, suggestion.routeDeltaMinutes)} extra route minute${Math.abs(suggestion.routeDeltaMinutes) === 1 ? "" : "s"} keeps the detour low while staying inside the active pickup run.`,
  ];

  if (suggestion.remainingSeatsBeforeAssignment !== null) {
    parts.push(
      `${suggestion.remainingSeatsBeforeAssignment} seat${suggestion.remainingSeatsBeforeAssignment === 1 ? "" : "s"} remain before adding this rider.`,
    );
  }

  return parts;
}

function getRecommendationKey(
  driveId: string,
  assignmentType: PickupAssignmentSuggestion["assignmentType"],
  stopId: string | null,
  pickupAddress: string,
) {
  return [driveId, assignmentType, stopId ?? "new", normalizeAddressKey(pickupAddress)].join("::");
}

function scoreQueryAgainstValue(value: string, query: string) {
  const normalizedValue = normalizeSearchText(value);
  const normalizedQuery = normalizeSearchText(query);

  if (!normalizedValue || !normalizedQuery) {
    return 0;
  }

  if (normalizedValue === normalizedQuery) {
    return 120;
  }

  if (normalizedValue.includes(normalizedQuery) || normalizedQuery.includes(normalizedValue)) {
    return 90;
  }

  const queryTokens = normalizedQuery.split(/\s+/).filter((token) => token.length > 1);

  if (queryTokens.length === 0) {
    return 0;
  }

  const matchedTokens = queryTokens.filter((token) => normalizedValue.includes(token)).length;

  if (matchedTokens === 0) {
    return 0;
  }

  return Math.round((matchedTokens / queryTokens.length) * 70);
}

function getDestinationConstraintScore(drive: Drive, constraints: PickupSuggestionConstraints) {
  if (!constraints.destinationQuery) {
    return 0;
  }

  const candidates = [
    drive.location?.name,
    drive.location?.address,
    drive.destinationAddress,
    drive.label,
  ].filter((value): value is string => Boolean(value && value.trim()));

  return candidates.reduce(
    (bestScore, value) => Math.max(bestScore, scoreQueryAgainstValue(value, constraints.destinationQuery)),
    0,
  );
}

function getPreferredVanMatchScore(drive: Drive, constraints: PickupSuggestionConstraints) {
  if (!constraints.preferredVan) {
    return 0;
  }

  const candidates = [
    drive.van?.label,
    drive.driver?.name,
    drive.label,
  ].filter((value): value is string => Boolean(value && value.trim()));

  return candidates.reduce(
    (bestScore, value) => Math.max(bestScore, scoreQueryAgainstValue(value, constraints.preferredVan)),
    0,
  );
}

function suggestionMatchesPreferredVan(
  suggestion: Pick<PickupAssignmentSuggestion, "vanLabel" | "driveLabel">,
  constraints: PickupSuggestionConstraints,
) {
  if (!constraints.preferredVan) {
    return false;
  }

  return (
    scoreQueryAgainstValue(suggestion.vanLabel, constraints.preferredVan) >= 60 ||
    scoreQueryAgainstValue(suggestion.driveLabel, constraints.preferredVan) >= 60
  );
}

function getLateArrivalMinutes(arrivalTime: string, constraints: PickupSuggestionConstraints) {
  if (!constraints.latestArrivalTime) {
    return 0;
  }

  const arrivalMinutes = parseTimeToMinutes(arrivalTime);
  const latestArrivalMinutes = parseTimeToMinutes(constraints.latestArrivalTime);

  if (arrivalMinutes === null || latestArrivalMinutes === null) {
    return 180;
  }

  return Math.max(0, arrivalMinutes - latestArrivalMinutes);
}

function formatClockMinutes(minutes: number) {
  const normalizedMinutes = ((minutes % (24 * 60)) + 24 * 60) % (24 * 60);
  const hours = Math.floor(normalizedMinutes / 60);
  const remainingMinutes = normalizedMinutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(remainingMinutes).padStart(2, "0")}`;
}

function getAmbiguousClockCandidates(value: string) {
  const trimmedValue = readString(value).toLowerCase().replace(/\./g, "").replace(/\s+/g, "");

  if (!trimmedValue) {
    return [];
  }

  if (/(am|pm)$/.test(trimmedValue)) {
    const explicitMinutes = parseTimeToMinutes(trimmedValue);
    return explicitMinutes === null ? [] : [explicitMinutes];
  }

  const match = trimmedValue.match(/^(\d{1,2})(?::(\d{2}))?$/);

  if (!match) {
    const parsedMinutes = parseTimeToMinutes(trimmedValue);
    return parsedMinutes === null ? [] : [parsedMinutes];
  }

  const hoursToken = match[1];
  const hours = Number(hoursToken);
  const minutes = Number(match[2] ?? "0");

  if (Number.isNaN(hours) || Number.isNaN(minutes) || minutes < 0 || minutes > 59) {
    return [];
  }

  if (hours > 12 || (hoursToken.length > 1 && hoursToken.startsWith("0"))) {
    const parsedMinutes = parseTimeToMinutes(trimmedValue);
    return parsedMinutes === null ? [] : [parsedMinutes];
  }

  if (hours < 1 || hours > 12) {
    return [];
  }

  const morningHours = hours === 12 ? 0 : hours;
  const eveningHours = hours === 12 ? 12 : hours + 12;
  return Array.from(new Set([morningHours * 60 + minutes, eveningHours * 60 + minutes]));
}

function scoreCandidateMinutesAgainstContext(candidateMinutes: number, contextMinutes: number[]) {
  if (contextMinutes.length === 0) {
    return {
      support: 0,
      nearestDistance: Number.POSITIVE_INFINITY,
    };
  }

  return contextMinutes.reduce(
    (summary, contextMinute) => {
      const distance = Math.abs(contextMinute - candidateMinutes);
      return {
        support: summary.support + Math.max(0, 360 - distance),
        nearestDistance: Math.min(summary.nearestDistance, distance),
      };
    },
    {
      support: 0,
      nearestDistance: Number.POSITIVE_INFINITY,
    },
  );
}

function resolveLatestArrivalTimeWithDriveContext(
  constraints: PickupSuggestionConstraints,
  drives: Drive[],
) {
  if (!constraints.latestArrivalTime || !constraints.latestArrivalTimeIsAmbiguous) {
    return constraints;
  }

  const rawTime = constraints.latestArrivalTimeRaw || constraints.latestArrivalTime;
  const candidates = getAmbiguousClockCandidates(rawTime);

  if (candidates.length < 2) {
    return constraints;
  }

  const pickupArrivalMinutes = drives
    .filter((drive) => drive.travelType === "pickup")
    .map((drive) => parseTimeToMinutes(getDriveArrivalTime(drive)))
    .filter((minutes): minutes is number => minutes !== null);

  const rankedCandidates = candidates
    .map((candidateMinutes) => ({
      candidateMinutes,
      ...scoreCandidateMinutesAgainstContext(candidateMinutes, pickupArrivalMinutes),
    }))
    .sort((first, second) => {
      if (first.support !== second.support) {
        return second.support - first.support;
      }

      if (first.nearestDistance !== second.nearestDistance) {
        return first.nearestDistance - second.nearestDistance;
      }

      return first.candidateMinutes - second.candidateMinutes;
    });

  const resolvedTime = formatClockMinutes(rankedCandidates[0]?.candidateMinutes ?? candidates[0]);
  const resolvedConstraints = {
    ...constraints,
    latestArrivalTime: resolvedTime,
  } satisfies PickupSuggestionConstraints;

  dispatchDebugLog("pickup.constraints.latest-arrival-resolved", {
    rawTime,
    normalizedTime: constraints.latestArrivalTime,
    resolvedTime,
    pickupArrivalTimes: pickupArrivalMinutes.map((minutes) => formatClockMinutes(minutes)),
    rankedCandidates: rankedCandidates.map((candidate) => ({
      time: formatClockMinutes(candidate.candidateMinutes),
      support: candidate.support,
      nearestDistanceMinutes:
        Number.isFinite(candidate.nearestDistance) ? candidate.nearestDistance : null,
    })),
  });

  return resolvedConstraints;
}

async function maybeGeneratePickupExplanation(
  suggestion: PickupAssignmentSuggestion,
  alternatives: PickupAssignmentSuggestion[],
) {
  if (!process.env.OPENAI_API_KEY) {
    return {
      explanation: suggestion.explanation,
      reasoning: suggestion.reasoning,
    };
  }

  try {
    const result = await generateText({
      model: getDispatchModel(),
      system:
        "You are an operations copilot for a transport scheduling app. Explain the single best pickup assignment in 2-3 short sentences and give exactly 3 concise bullet-style reasons separated by newline characters. Stay concrete and operational.",
      prompt: JSON.stringify({
        recommendation: suggestion,
        alternatives: alternatives.map((item) => ({
          driveLabel: item.driveLabel,
          vanLabel: item.vanLabel,
          pickupTime: item.pickupTime,
          routeDeltaMinutes: item.routeDeltaMinutes,
          assignmentType: item.assignmentType,
        })),
      }),
      stopWhen: stepCountIs(1),
      temperature: 0.2,
    });

    const lines = result.text
      .split("\n")
      .map((line) => line.replace(/^[\s*-]+/, "").trim())
      .filter(Boolean);

    return {
      explanation: lines[0] ?? suggestion.explanation,
      reasoning: lines.slice(1, 4).length > 0 ? lines.slice(1, 4) : suggestion.reasoning,
    };
  } catch {
    return {
      explanation: suggestion.explanation,
      reasoning: suggestion.reasoning,
    };
  }
}

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

  if (normalizedConstraints.preferredVan && !preferredVanMatched) {
    return `Not really. ${normalizedConstraints.preferredVan} is not the best fit for this request. Best live option is ${suggestion.vanLabel} on "${suggestion.driveLabel}", picking up ${subject} at ${suggestion.pickupTime} from ${suggestion.pickupAddress} and arriving at ${suggestion.arrivalTime}. This ${routeDetail}, and ${seatDetail}.${timingDetail ? ` ${timingDetail}` : ""}\n\nDo you want me to apply this instead?`;
  }

  if (lateArrivalMinutes > 0 && normalizedConstraints.latestArrivalTime) {
    return `Maybe. I do not see a live pickup that gets ${subject} there by ${arrivalTargetLabel}. The closest fit is ${suggestion.vanLabel} on "${suggestion.driveLabel}", picking up at ${suggestion.pickupTime} from ${suggestion.pickupAddress} and arriving at ${suggestion.arrivalTime}. This ${routeDetail}, and ${seatDetail}.${timingDetail ? ` ${timingDetail}` : ""}\n\nDo you want me to apply this closest option?`;
  }

  return `Yes. ${suggestion.vanLabel} can pick up ${subject} at ${suggestion.pickupTime} from ${suggestion.pickupAddress} on "${suggestion.driveLabel}" and arrive at ${suggestion.arrivalTime}. This ${routeDetail}, and ${seatDetail}.${timingDetail ? ` ${timingDetail}` : ""}\n\nDo you want me to apply this?`;
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

async function evaluateDriveCandidate(
  drive: Drive,
  draft: PickupSuggestionDraft,
  constraintsInput: PickupSuggestionConstraints | null | undefined,
  cache: CoordinateCache,
  token: string,
): Promise<CandidateEvaluation | null> {
  const constraints = normalizePickupSuggestionConstraints(constraintsInput);
  const candidateContext = {
    driveId: drive.id,
    driveLabel: drive.label,
    travelType: drive.travelType,
    destinationAddress: drive.destinationAddress.trim(),
    vanLabel: drive.van?.label?.trim() || drive.driver?.name || "Unlabeled van",
  };

  if (drive.travelType !== "pickup") {
    dispatchDebugLog("pickup.candidate.rejected", {
      ...candidateContext,
      reason: "not-pickup-drive",
    });
    return null;
  }

  const destinationAddress = drive.destinationAddress.trim();
  const arrivalTime = getDriveArrivalTime(drive);
  const destinationConstraintScore = getDestinationConstraintScore(drive, constraints);
  const preferredVanMatchScore = getPreferredVanMatchScore(drive, constraints);
  const lateArrivalMinutes = getLateArrivalMinutes(arrivalTime, constraints);

  if (!destinationAddress || !arrivalTime) {
    dispatchDebugLog("pickup.candidate.rejected", {
      ...candidateContext,
      reason: "missing-destination-or-arrival",
      arrivalTime,
    });
    return null;
  }

  if (constraints.destinationQuery && destinationConstraintScore < 60) {
    dispatchDebugLog("pickup.candidate.rejected", {
      ...candidateContext,
      reason: "destination-mismatch",
      constraints: summarizeConstraints(constraints),
      destinationConstraintScore,
      arrivalTime,
    });
    return null;
  }

  if (constraints.latestArrivalTime && constraints.latestArrivalIsRequired && lateArrivalMinutes > 0) {
    dispatchDebugLog("pickup.candidate.rejected", {
      ...candidateContext,
      reason: "required-arrival-missed",
      constraints: summarizeConstraints(constraints),
      arrivalTime,
      lateArrivalMinutes,
    });
    return null;
  }

  if (constraints.preferredVan && constraints.requirePreferredVan && preferredVanMatchScore < 60) {
    dispatchDebugLog("pickup.candidate.rejected", {
      ...candidateContext,
      reason: "required-van-mismatch",
      constraints: summarizeConstraints(constraints),
      preferredVanMatchScore,
      arrivalTime,
    });
    return null;
  }

  const currentPassengerCount = countUniquePassengers(drive);
  const seatCapacity = typeof drive.van?.seat_capacity === "number" ? drive.van.seat_capacity : null;
  const remainingSeatsBeforeAssignment =
    seatCapacity === null ? null : Math.max(0, seatCapacity - currentPassengerCount);

  if (remainingSeatsBeforeAssignment !== null && remainingSeatsBeforeAssignment < 1) {
    dispatchDebugLog("pickup.candidate.rejected", {
      ...candidateContext,
      reason: "no-capacity",
      currentPassengerCount,
      seatCapacity,
      arrivalTime,
    });
    return null;
  }

  const normalizedAddress = normalizeAddressKey(draft.address);
  const existingStop = drive.stops.find((stop) => normalizeAddressKey(stop.pickupAddress) === normalizedAddress);

  if (existingStop) {
    const recommendationKey = getRecommendationKey(
      drive.id,
      "existing-stop",
      existingStop.id,
      existingStop.pickupAddress,
    );

    return {
      suggestion: {
        recommendationKey,
        assignmentType: "existing-stop",
        driveId: drive.id,
        driveLabel: drive.label,
        vanId: drive.vanId,
        vanLabel: drive.van?.label?.trim() || drive.driver?.name || "Unlabeled van",
        seatCapacity,
        currentPassengerCount,
        remainingSeatsBeforeAssignment,
        stopId: existingStop.id,
        stopTitle: existingStop.stopTitle,
        pickupAddress: existingStop.pickupAddress.trim(),
        pickupTime: existingStop.pickupTimeLabel.trim(),
        arrivalTime,
        destinationAddress,
        routeDeltaMinutes: 0,
        reasoning: [
          "The address already exists in the current route.",
          "No extra stop needs to be inserted.",
          "This keeps the existing schedule intact.",
        ],
        explanation:
          "This rider can be attached to an existing stop at the same address, so the route stays unchanged.",
        stopPlan: drive.stops.map((stop) => ({
          id: stop.id,
          stopTitle: stop.stopTitle,
          pickupAddress: stop.pickupAddress.trim(),
          pickupTime: stop.pickupTimeLabel.trim(),
          isNew: false,
        })),
      },
      score:
        lateArrivalMinutes * (constraints.latestArrivalIsRequired ? 25 : 12) +
        (constraints.preferredVan && preferredVanMatchScore < 60 ? 180 : 0) -
        (preferredVanMatchScore >= 60 ? 140 : 0) -
        destinationConstraintScore,
    };
  }

  const currentStops = buildScheduleInputs(drive);

  if (currentStops.length >= 11) {
    dispatchDebugLog("pickup.candidate.rejected", {
      ...candidateContext,
      reason: "too-many-stops",
      stopCount: currentStops.length,
      arrivalTime,
    });
    return null;
  }

  const baselineDurationSeconds = await getRouteDurationSeconds(currentStops, cache, token);
  const insertedStopId = `suggested-stop:${drive.id}`;
  const candidateStops = [
    ...currentStops,
    {
      id: insertedStopId,
      pickupAddress: draft.address,
      endDestination: destinationAddress,
      stopDurationSec: null,
      trafficBufferSec: null,
    },
  ];
  const { orderedStops } = await optimizeScheduleStops(candidateStops, token);
  const recalculatedStops = await recalculateScheduleStops(orderedStops, arrivalTime, cache, token);
  const candidateDurationSeconds = await getRouteDurationSeconds(orderedStops, cache, token);
  const insertedStop = recalculatedStops.find((stop) => stop.id === insertedStopId);

  if (!insertedStop) {
    dispatchDebugLog("pickup.candidate.rejected", {
      ...candidateContext,
      reason: "inserted-stop-not-found",
      arrivalTime,
    });
    return null;
  }

  const routeDeltaMinutes = Math.max(0, Math.round((candidateDurationSeconds - baselineDurationSeconds) / 60));
  const vanLabel = drive.van?.label?.trim() || drive.driver?.name || "Unlabeled van";
  const recommendationKey = getRecommendationKey(drive.id, "new-stop", null, insertedStop.pickupAddress);
  const suggestion: PickupAssignmentSuggestion = {
    recommendationKey,
    assignmentType: "new-stop",
    driveId: drive.id,
    driveLabel: drive.label,
    vanId: drive.vanId,
    vanLabel,
    seatCapacity,
    currentPassengerCount,
    remainingSeatsBeforeAssignment,
    stopId: null,
    stopTitle: `Pickup · ${draft.name || "New rider"}`,
    pickupAddress: insertedStop.pickupAddress.trim(),
    pickupTime: insertedStop.pickupTime.trim(),
    arrivalTime,
    destinationAddress,
    routeDeltaMinutes,
    reasoning: createDeterministicReasoningParts({
      recommendationKey,
      assignmentType: "new-stop",
      driveId: drive.id,
      driveLabel: drive.label,
      vanId: drive.vanId,
      vanLabel,
      seatCapacity,
      currentPassengerCount,
      remainingSeatsBeforeAssignment,
      stopId: null,
      stopTitle: `Pickup · ${draft.name || "New rider"}`,
      pickupAddress: insertedStop.pickupAddress.trim(),
      pickupTime: insertedStop.pickupTime.trim(),
      arrivalTime,
      destinationAddress,
      routeDeltaMinutes,
      reasoning: [],
      explanation: "",
      stopPlan: [],
    }),
    explanation:
      "This drive adds the lowest route cost while keeping the passenger inside an active pickup run with available seats.",
    stopPlan: buildStopPlan(
      drive,
      recalculatedStops.map((stop) => ({
        ...stop,
        pickupTime: stop.pickupTime,
      })),
      insertedStopId,
    ),
  };
  const pickupMinutes = insertedStop.pickupTime
    .split(":")
    .slice(0, 2)
    .reduce((total, value, index) => total + Number(value || 0) * (index === 0 ? 60 : 1), 0);

  const candidateResult = {
    suggestion,
    score:
      routeDeltaMinutes * 100 +
      currentPassengerCount * 5 -
      (remainingSeatsBeforeAssignment ?? 0) * 2 -
      pickupMinutes / 60 +
      lateArrivalMinutes * (constraints.latestArrivalIsRequired ? 25 : 12) +
      (constraints.preferredVan && preferredVanMatchScore < 60 ? 180 : 0) -
      (preferredVanMatchScore >= 60 ? 140 : 0) -
      destinationConstraintScore,
  };

  dispatchDebugLog("pickup.candidate.accepted", {
    ...candidateContext,
    constraints: summarizeConstraints(constraints),
    pickupAddress: draft.address,
    currentPassengerCount,
    seatCapacity,
    remainingSeatsBeforeAssignment,
    arrivalTime,
    destinationConstraintScore,
    preferredVanMatchScore,
    lateArrivalMinutes,
    score: candidateResult.score,
    suggestion: summarizePickupSuggestion(candidateResult.suggestion),
  });

  return candidateResult;
}

function compareCandidates(first: CandidateEvaluation, second: CandidateEvaluation) {
  if (first.score !== second.score) {
    return first.score - second.score;
  }

  if (first.suggestion.routeDeltaMinutes !== second.suggestion.routeDeltaMinutes) {
    return first.suggestion.routeDeltaMinutes - second.suggestion.routeDeltaMinutes;
  }

  return first.suggestion.pickupTime.localeCompare(second.suggestion.pickupTime);
}

export async function suggestPickupAssignment(
  draftInput: PickupSuggestionDraft,
  constraintsInput?: PickupSuggestionConstraints | null,
) {
  const draft = normalizeDraft(draftInput);
  const resolvedCrewMember = await resolveExistingCrewMemberForDraft(draft).catch(() => null);
  const canonicalDraft = resolvedCrewMember ? canonicalizePickupSuggestionDraft(draft, resolvedCrewMember) : draft;
  const requestedConstraints = normalizePickupSuggestionConstraints(constraintsInput);
  const validationError = validateDraft(canonicalDraft);

  const drives = await getDrivePlan();
  const constraints = resolveLatestArrivalTimeWithDriveContext(requestedConstraints, drives);

  dispatchDebugLog("pickup.suggest.start", {
    draft: summarizePickupDraft(draft),
    canonicalDraft: summarizePickupDraft(canonicalDraft),
    matchedCrewMember: resolvedCrewMember
      ? {
          id: resolvedCrewMember.id,
          fullName: resolvedCrewMember.full_name,
          address: resolvedCrewMember.home_address,
        }
      : null,
    requestedConstraints: summarizeConstraints(requestedConstraints),
    constraints: summarizeConstraints(constraints),
  });

  if (validationError) {
    dispatchDebugLog("pickup.suggest.validation-error", {
      draft: summarizePickupDraft(canonicalDraft),
      error: validationError,
    });
    throw new Error(validationError);
  }

  const token = assertMapboxToken();
  const cache: CoordinateCache = new Map();
  const candidateResults = await Promise.all(
    drives.map((drive) => evaluateDriveCandidate(drive, canonicalDraft, constraints, cache, token).catch(() => null)),
  );
  const candidates = candidateResults.filter((entry): entry is CandidateEvaluation => Boolean(entry));

  if (candidates.length === 0) {
    dispatchDebugLog("pickup.suggest.no-candidates", {
      canonicalDraft: summarizePickupDraft(canonicalDraft),
      constraints: summarizeConstraints(constraints),
    });
    return null;
  }

  candidates.sort(compareCandidates);
  const bestSuggestion = candidates[0].suggestion;
  const explanation = await maybeGeneratePickupExplanation(
    bestSuggestion,
    candidates.slice(1, 4).map((candidate) => candidate.suggestion),
  );

  const finalizedSuggestion = {
    ...bestSuggestion,
    explanation: explanation.explanation,
    reasoning: explanation.reasoning,
  } satisfies PickupAssignmentSuggestion;

  dispatchDebugLog("pickup.suggest.selected", {
    canonicalDraft: summarizePickupDraft(canonicalDraft),
    constraints: summarizeConstraints(constraints),
    rankedCandidates: candidates.slice(0, 5).map((candidate) => ({
      score: candidate.score,
      suggestion: summarizePickupSuggestion(candidate.suggestion),
    })),
    selectedSuggestion: summarizePickupSuggestion(finalizedSuggestion),
  });

  return finalizedSuggestion;
}

async function attachPassengerToStop(
  supabase: Awaited<ReturnType<typeof createClient>>,
  stopId: string,
  crewMemberId: string,
) {
  const { data: existingPassengerLink, error: existingPassengerError } = await supabase
    .from("trip_passengers")
    .select("trip_id")
    .eq("trip_id", stopId)
    .eq("crew_member_id", crewMemberId)
    .maybeSingle();

  if (existingPassengerError) {
    throw new Error(existingPassengerError.message);
  }

  if (existingPassengerLink) {
    return false;
  }

  const { error: passengerError } = await supabase.from("trip_passengers").insert([
    {
      trip_id: stopId,
      crew_member_id: crewMemberId,
    },
  ]);

  if (passengerError) {
    throw new Error(passengerError.message);
  }

  return true;
}

function findExistingPickupAssignments(drives: Drive[], crewMemberId: string): ExistingPickupAssignment[] {
  return drives
    .filter((drive) => drive.travelType === "pickup")
    .flatMap((drive) =>
      drive.stops.flatMap((stop) => {
        const isAssigned = stop.stopPickupPassengers.some((passenger) => passenger.id === crewMemberId);

        if (!isAssigned) {
          return [];
        }

        return [
          {
            driveId: drive.id,
            stopId: stop.id,
            stopDeleted: false,
            stopSnapshot: {
              id: stop.id,
              driveId: drive.id,
              pickupAddress: stop.pickupAddress.trim(),
              pickupTime: stop.pickupTime,
              stopTitle: stop.stopTitle,
              stopDurationSec: stop.stopDurationSec,
              trafficBufferSec: stop.trafficBufferSec,
              notes: stop.notes,
            },
            remainingPassengerCount: stop.stopPickupPassengers.filter((passenger) => passenger.id !== crewMemberId)
              .length,
          },
        ];
      }),
    );
}

function captureOriginalStopTimes(drives: Drive[], driveIds: Iterable<string>) {
  const targetDriveIds = new Set(Array.from(driveIds));
  const originalStopTimeById = new Map<string, string | null>();

  for (const drive of drives) {
    if (!targetDriveIds.has(drive.id)) {
      continue;
    }

    for (const stop of drive.stops) {
      originalStopTimeById.set(stop.id, stop.pickupTime);
    }
  }

  return originalStopTimeById;
}

async function recalculateAffectedPickupDrives(
  supabase: Awaited<ReturnType<typeof createClient>>,
  driveIds: Iterable<string>,
) {
  const targetDriveIds = new Set(Array.from(driveIds));

  if (targetDriveIds.size === 0) {
    return;
  }

  const refreshedDrivePlan = await getDrivePlan();
  const token = assertMapboxToken();
  const cache: CoordinateCache = new Map();

  for (const drive of refreshedDrivePlan) {
    if (!targetDriveIds.has(drive.id) || drive.travelType !== "pickup") {
      continue;
    }

    const updatedStops = buildScheduleInputs(drive);

    if (updatedStops.length === 0) {
      continue;
    }

    const { orderedStops } = await optimizeScheduleStops(updatedStops, token);
    const recalculatedStops = await recalculateScheduleStops(
      orderedStops,
      getDriveArrivalTime(drive),
      cache,
      token,
    );
    const updateResults = await Promise.all(
      recalculatedStops.map((stop) =>
        supabase
          .from("trips")
          .update({ pickup_time: `${stop.pickupTime}:00` })
          .eq("id", stop.id),
      ),
    );
    const failedUpdate = updateResults.find((result) => result.error);

    if (failedUpdate?.error) {
      throw new Error(failedUpdate.error.message);
    }
  }
}

export async function applyPickupSuggestion(
  draftInput: PickupSuggestionDraft,
  constraintsInput: PickupSuggestionConstraints | null | undefined,
  suggestion: PickupAssignmentSuggestion,
) {
  const draft = normalizeDraft(draftInput);
  const constraints = normalizePickupSuggestionConstraints(constraintsInput);
  const resolvedCrewMember = await resolveExistingCrewMemberForDraft(draft).catch(() => null);
  const canonicalDraft = resolvedCrewMember ? canonicalizePickupSuggestionDraft(draft, resolvedCrewMember) : draft;
  const validationError = validateDraft(canonicalDraft);

  dispatchDebugLog("pickup.apply.start", {
    draft: summarizePickupDraft(draft),
    canonicalDraft: summarizePickupDraft(canonicalDraft),
    constraints: summarizeConstraints(constraints),
    requestedSuggestion: summarizePickupSuggestion(suggestion),
    matchedCrewMember: resolvedCrewMember
      ? {
          id: resolvedCrewMember.id,
          fullName: resolvedCrewMember.full_name,
          address: resolvedCrewMember.home_address,
        }
      : null,
  });

  if (validationError) {
    dispatchDebugLog("pickup.apply.validation-error", {
      draft: summarizePickupDraft(canonicalDraft),
      error: validationError,
    });
    throw new Error(validationError);
  }

  const freshSuggestion = await suggestPickupAssignment(canonicalDraft, constraints);

  if (!freshSuggestion) {
    dispatchDebugLog("pickup.apply.no-fresh-suggestion", {
      draft: summarizePickupDraft(canonicalDraft),
      constraints: summarizeConstraints(constraints),
    });
    throw new Error("No eligible pickup route is available for this address.");
  }

  if (freshSuggestion.recommendationKey !== suggestion.recommendationKey) {
    dispatchDebugLog("pickup.apply.recommendation-mismatch", {
      requestedSuggestion: summarizePickupSuggestion(suggestion),
      freshSuggestion: summarizePickupSuggestion(freshSuggestion),
    });
    throw new Error("The suggested pickup changed. Refresh the recommendation and try again.");
  }

  const supabase = await createClient();
  let createdCrewMemberId: string | null = null;
  let createdTripId: string | null = null;
  let attachedStopId: string | null = null;
  let attachedPassengerWasInserted = false;
  let originalStopTimeById = new Map<string, string | null>();
  let targetCrewMemberId: string | null = null;
  let targetCrewMemberRow: Awaited<ReturnType<typeof findExistingCrewMemberForDraft>> | null = null;
  const removedPickupAssignments: ExistingPickupAssignment[] = [];

  try {
    const matchedExistingCrewMember =
      resolvedCrewMember ?? (canonicalDraft.personId ? null : await findExistingCrewMemberForDraft(canonicalDraft));

    if (canonicalDraft.personId || matchedExistingCrewMember) {
      const targetPersonId = canonicalDraft.personId ?? matchedExistingCrewMember?.id ?? null;
      const { data: updatedCrewMember, error: updateError } = await supabase
        .from("crew_members")
        .update({
          full_name: canonicalDraft.name,
          home_address: canonicalDraft.address,
          phone: canonicalDraft.phone || null,
          default_role_title: canonicalDraft.role || null,
        })
        .eq("id", targetPersonId)
        .select("id, full_name, home_address, phone, default_role_title, created_at")
        .single();

      if (updateError || !updatedCrewMember) {
        throw new Error(updateError?.message || "Failed to update this person.");
      }

      targetCrewMemberId = updatedCrewMember.id;
      targetCrewMemberRow = updatedCrewMember;
    } else {
      const { data: createdCrewMember, error: createError } = await supabase
        .from("crew_members")
        .insert([
          {
            full_name: canonicalDraft.name,
            home_address: canonicalDraft.address,
            phone: canonicalDraft.phone || null,
            default_role_title: canonicalDraft.role || null,
          },
        ])
        .select("id, full_name, home_address, phone, default_role_title, created_at")
        .single();

      if (createError || !createdCrewMember) {
        throw new Error(createError?.message || "Failed to create this person.");
      }

      createdCrewMemberId = createdCrewMember.id;
      targetCrewMemberId = createdCrewMember.id;
      targetCrewMemberRow = createdCrewMember;
    }

    if (!targetCrewMemberId || !targetCrewMemberRow) {
      throw new Error("Unable to resolve the person to assign.");
    }

    const drivePlanBeforeMove = await getDrivePlan();
    const existingPickupAssignments = findExistingPickupAssignments(drivePlanBeforeMove, targetCrewMemberId);
    const affectedDriveIds = new Set([freshSuggestion.driveId, ...existingPickupAssignments.map((entry) => entry.driveId)]);
    originalStopTimeById = captureOriginalStopTimes(drivePlanBeforeMove, affectedDriveIds);

    dispatchDebugLog("pickup.apply.assignments-before-move", {
      targetCrewMemberId,
      targetCrewMemberName: targetCrewMemberRow.full_name,
      existingPickupAssignments: existingPickupAssignments.map((assignment) => ({
        driveId: assignment.driveId,
        stopId: assignment.stopId,
        stopTitle: assignment.stopSnapshot.stopTitle,
        pickupAddress: assignment.stopSnapshot.pickupAddress,
        pickupTime: assignment.stopSnapshot.pickupTime,
        remainingPassengerCount: assignment.remainingPassengerCount,
      })),
      affectedDriveIds: Array.from(affectedDriveIds),
      freshSuggestion: summarizePickupSuggestion(freshSuggestion),
    });

    if (freshSuggestion.assignmentType === "existing-stop" && freshSuggestion.stopId) {
      attachedStopId = freshSuggestion.stopId;
      attachedPassengerWasInserted = await attachPassengerToStop(supabase, freshSuggestion.stopId, targetCrewMemberId);
    } else {
      const newStop = freshSuggestion.stopPlan.find((stop) => stop.isNew);

      if (!newStop) {
        throw new Error("The assistant could not find the inserted stop to apply.");
      }

      const { data: createdTrip, error: tripError } = await supabase
        .from("trips")
        .insert([
          {
            travel_id: freshSuggestion.driveId,
            pickup_address: newStop.pickupAddress,
            pickup_time: `${newStop.pickupTime}:00`,
            trip_title: freshSuggestion.stopTitle,
          },
        ])
        .select("id")
        .single();

      if (tripError || !createdTrip) {
        throw new Error(tripError?.message || "Failed to create the suggested stop.");
      }

      createdTripId = createdTrip.id;
      attachedStopId = createdTrip.id;
      attachedPassengerWasInserted = await attachPassengerToStop(supabase, createdTrip.id, targetCrewMemberId);
    }

    for (const assignment of existingPickupAssignments) {
      if (assignment.stopId === attachedStopId) {
        continue;
      }

      const { error: detachError } = await supabase
        .from("trip_passengers")
        .delete()
        .eq("trip_id", assignment.stopId)
        .eq("crew_member_id", targetCrewMemberId);

      if (detachError) {
        throw new Error(detachError.message);
      }

      const removedAssignment = {
        ...assignment,
        stopDeleted: false,
      };
      removedPickupAssignments.push(removedAssignment);

      if (assignment.remainingPassengerCount === 0) {
        const { error: deleteTripError } = await supabase
          .from("trips")
          .delete()
          .eq("id", assignment.stopId);

        if (deleteTripError) {
          throw new Error(deleteTripError.message);
        }

        removedAssignment.stopDeleted = true;
      }
    }

    await recalculateAffectedPickupDrives(supabase, affectedDriveIds);

    const transportPlan = await getTransportPlan();
    const person = mapCrewMemberRowToPerson(targetCrewMemberRow, transportPlan);

    dispatchDebugLog("pickup.apply.success", {
      targetCrewMemberId,
      targetCrewMemberName: targetCrewMemberRow.full_name,
      attachedStopId,
      createdTripId,
      attachedPassengerWasInserted,
      removedPickupAssignments: removedPickupAssignments.map((assignment) => ({
        driveId: assignment.driveId,
        stopId: assignment.stopId,
        stopDeleted: assignment.stopDeleted,
      })),
      resultPerson: {
        id: person.id,
        name: person.name,
        pickupTime: person.pickupTime,
        pickupToLocation: person.pickupToLocation,
      },
      freshSuggestion: summarizePickupSuggestion(freshSuggestion),
    });

    return {
      person,
      transportPlan,
    };
  } catch (error) {
    dispatchDebugLog("pickup.apply.error", {
      error,
      draft: summarizePickupDraft(canonicalDraft),
      attachedStopId,
      createdTripId,
      attachedPassengerWasInserted,
      targetCrewMemberId,
      removedPickupAssignments: removedPickupAssignments.map((assignment) => ({
        driveId: assignment.driveId,
        stopId: assignment.stopId,
        stopDeleted: assignment.stopDeleted,
      })),
    });

    if (attachedPassengerWasInserted && attachedStopId && targetCrewMemberId) {
      await supabase
        .from("trip_passengers")
        .delete()
        .eq("trip_id", attachedStopId)
        .eq("crew_member_id", targetCrewMemberId);
    }

    if (createdTripId) {
      await supabase.from("trips").delete().eq("id", createdTripId);
    }

    for (const assignment of [...removedPickupAssignments].reverse()) {
      if (assignment.stopDeleted) {
        await supabase.from("trips").insert([
          {
            id: assignment.stopSnapshot.id,
            travel_id: assignment.stopSnapshot.driveId,
            pickup_address: assignment.stopSnapshot.pickupAddress,
            pickup_time: assignment.stopSnapshot.pickupTime,
            trip_title: assignment.stopSnapshot.stopTitle,
            stop_duration_sec: assignment.stopSnapshot.stopDurationSec,
            traffic_buffer_sec: assignment.stopSnapshot.trafficBufferSec,
            notes: assignment.stopSnapshot.notes,
          },
        ]);
      }

      if (targetCrewMemberId) {
        await supabase.from("trip_passengers").insert([
          {
            trip_id: assignment.stopId,
            crew_member_id: targetCrewMemberId,
          },
        ]);
      }
    }

    if (originalStopTimeById.size > 0) {
      await Promise.all(
        Array.from(originalStopTimeById.entries()).map(([stopId, pickupTime]) =>
          supabase.from("trips").update({ pickup_time: pickupTime }).eq("id", stopId),
        ),
      );
    }

    if (createdCrewMemberId) {
      await supabase.from("crew_members").delete().eq("id", createdCrewMemberId);
    }

    throw error;
  }
}

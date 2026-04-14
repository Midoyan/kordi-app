import type { Drive } from "@/lib/drive-plan";

import { dispatchDebugLog } from "@/lib/ai/dispatch/debug";
import { normalizePickupSuggestionConstraints } from "@/lib/ai/dispatch/intents";
import { getDriveArrivalTime } from "@/lib/ai/dispatch/transport";
import type { PickupAssignmentSuggestion, PickupSuggestionConstraints } from "@/lib/ai/dispatch/types";
import { normalizeSearchText, parseTimeToMinutes, readString } from "@/lib/ai/dispatch/utils";

import type { CandidateEvaluation } from "@/lib/ai/dispatch/pickup-suggestions/shared";

export function scoreQueryAgainstValue(value: string, query: string) {
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

export function getDestinationConstraintScore(drive: Drive, constraints: PickupSuggestionConstraints) {
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

export function getPreferredVanMatchScore(drive: Drive, constraints: PickupSuggestionConstraints) {
  if (!constraints.preferredVan) {
    return 0;
  }

  const candidates = [drive.van?.label, drive.driver?.name, drive.label].filter(
    (value): value is string => Boolean(value && value.trim()),
  );

  return candidates.reduce(
    (bestScore, value) => Math.max(bestScore, scoreQueryAgainstValue(value, constraints.preferredVan)),
    0,
  );
}

export function suggestionMatchesPreferredVan(
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

export function getLateArrivalMinutes(arrivalTime: string, constraints: PickupSuggestionConstraints) {
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

export function getPickupSuggestionLateArrivalMinutes(
  suggestion: Pick<PickupAssignmentSuggestion, "arrivalTime">,
  constraints?: PickupSuggestionConstraints | null,
) {
  return getLateArrivalMinutes(suggestion.arrivalTime, normalizePickupSuggestionConstraints(constraints));
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

export function resolveLatestArrivalTimeWithDriveContext(
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
      nearestDistanceMinutes: Number.isFinite(candidate.nearestDistance) ? candidate.nearestDistance : null,
    })),
  });

  return resolvedConstraints;
}

export function comparePickupCandidates(first: CandidateEvaluation, second: CandidateEvaluation) {
  if (first.score !== second.score) {
    return first.score - second.score;
  }

  if (first.suggestion.routeDeltaMinutes !== second.suggestion.routeDeltaMinutes) {
    return first.suggestion.routeDeltaMinutes - second.suggestion.routeDeltaMinutes;
  }

  return first.suggestion.pickupTime.localeCompare(second.suggestion.pickupTime);
}

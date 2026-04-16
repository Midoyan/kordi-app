export const shootDayStatuses = ["draft", "locked", "wrapped"] as const;

export type ShootDayStatus = (typeof shootDayStatuses)[number];

export type ShootDayPayload = {
  org_id: string;
  project_id: string;
  shoot_date: string;
  day_number: number | null;
  title: string | null;
  status: ShootDayStatus;
};

const shootDayStatusesSet = new Set<string>(shootDayStatuses);

function readString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function parseDayNumber(value: unknown) {
  if (value === null || typeof value === "undefined" || value === "") {
    return null;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.trunc(value);
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return Math.trunc(parsed);
    }
  }

  return null;
}

function normalizeShootDayStatus(value: unknown): ShootDayStatus {
  const status = readString(value).toLowerCase();
  return shootDayStatusesSet.has(status) ? (status as ShootDayStatus) : "draft";
}

export function normalizeShootDayPayload(payload: unknown): ShootDayPayload {
  const source = payload && typeof payload === "object" ? payload : {};
  const record = source as Record<string, unknown>;
  const title = readString(record.title);

  return {
    org_id: readString(record.org_id),
    project_id: readString(record.project_id),
    shoot_date: readString(record.shoot_date),
    day_number: parseDayNumber(record.day_number),
    title: title || null,
    status: normalizeShootDayStatus(record.status),
  };
}

export function validateShootDayPayload(payload: ShootDayPayload) {
  if (!payload.org_id) {
    return "Organization id is required.";
  }

  if (!payload.project_id) {
    return "Project id is required.";
  }

  if (!payload.shoot_date) {
    return "Shoot date is required.";
  }

  return null;
}

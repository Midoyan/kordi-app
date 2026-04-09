export const projectStatuses = ["active", "wrapped", "archived"] as const;

export type ProjectStatus = (typeof projectStatuses)[number];

export type ProjectPayload = {
  org_id: string;
  name: string;
  client: string | null;
  status: ProjectStatus;
};

const projectStatusesSet = new Set<string>(projectStatuses);

function readString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeProjectStatus(value: unknown): ProjectStatus {
  const status = readString(value).toLowerCase();
  return projectStatusesSet.has(status) ? (status as ProjectStatus) : "active";
}

export function normalizeProjectPayload(payload: unknown): ProjectPayload {
  const source = payload && typeof payload === "object" ? payload : {};
  const record = source as Record<string, unknown>;

  const client = readString(record.client);

  return {
    org_id: readString(record.org_id),
    name: readString(record.name),
    client: client || null,
    status: normalizeProjectStatus(record.status),
  };
}

export function validateProjectPayload(payload: ProjectPayload) {
  if (!payload.org_id) {
    return "Organization id is required.";
  }

  if (!payload.name) {
    return "Project name is required.";
  }

  return null;
}

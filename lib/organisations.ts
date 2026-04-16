export type OrganisationPayload = {
  name: string;
  slug: string;
};

function readString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function toSlug(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

export function normalizeOrganisationPayload(payload: unknown): OrganisationPayload {
  const source = payload && typeof payload === "object" ? payload : {};
  const record = source as Record<string, unknown>;

  const name = readString(record.name);
  const providedSlug = readString(record.slug);

  return {
    name,
    slug: providedSlug || toSlug(name),
  };
}

export function validateOrganisationPayload(payload: OrganisationPayload) {
  if (!payload.name) {
    return "Organization name is required.";
  }

  if (!payload.slug) {
    return "Organization slug is required.";
  }

  return null;
}

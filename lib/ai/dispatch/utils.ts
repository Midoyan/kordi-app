export function readString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export function normalizeAddressKey(address: string) {
  return address.trim().toLowerCase().replace(/\s+/g, " ");
}

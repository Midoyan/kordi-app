export function readString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export function normalizeSearchText(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/\u00df/g, "ss")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeAddressKey(address: string) {
  return normalizeSearchText(address);
}

export function parseTimeToMinutes(value: string) {
  const trimmedValue = readString(value).toLowerCase().replace(/\./g, "");

  if (!trimmedValue) {
    return null;
  }

  const meridiemMatch = trimmedValue.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)$/);

  if (meridiemMatch) {
    let hours = Number(meridiemMatch[1]);
    const minutes = Number(meridiemMatch[2] ?? "0");

    if (Number.isNaN(hours) || Number.isNaN(minutes) || minutes < 0 || minutes > 59 || hours < 1 || hours > 12) {
      return null;
    }

    if (meridiemMatch[3] === "pm" && hours < 12) {
      hours += 12;
    }

    if (meridiemMatch[3] === "am" && hours === 12) {
      hours = 0;
    }

    return hours * 60 + minutes;
  }

  const twentyFourHourMatch = trimmedValue.match(/^(\d{1,2})(?::(\d{2}))?$/);

  if (!twentyFourHourMatch) {
    return null;
  }

  const hours = Number(twentyFourHourMatch[1]);
  const minutes = Number(twentyFourHourMatch[2] ?? "0");

  if (Number.isNaN(hours) || Number.isNaN(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    return null;
  }

  return hours * 60 + minutes;
}

export function normalizeClockTime(value: unknown) {
  const minutes = parseTimeToMinutes(readString(value));

  if (minutes === null) {
    return "";
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(remainingMinutes).padStart(2, "0")}`;
}

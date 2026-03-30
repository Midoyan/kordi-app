export type ScheduleStopInput = {
  id: number
  pickupAddress: string
  endDestination: string
}

export type RecalculatedScheduleStop = ScheduleStopInput & {
  pickupTime: string
  arrival: string
  legDurationSeconds: number
}

export function parseTimeString(value: string) {
  const match = value.trim().match(/^(\d{1,2}):(\d{2})$/)

  if (!match) {
    return null
  }

  const hours = Number(match[1])
  const minutes = Number(match[2])

  if (
    Number.isNaN(hours) ||
    Number.isNaN(minutes) ||
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59
  ) {
    return null
  }

  return { hours, minutes }
}

export function toReferenceDate(time: string) {
  const parsed = parseTimeString(time)

  if (!parsed) {
    return null
  }

  return new Date(Date.UTC(2025, 0, 1, parsed.hours, parsed.minutes, 0, 0))
}

export function formatTimeString(date: Date) {
  const hours = date.getUTCHours().toString().padStart(2, "0")
  const minutes = date.getUTCMinutes().toString().padStart(2, "0")

  return `${hours}:${minutes}`
}

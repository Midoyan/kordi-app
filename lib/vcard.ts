type BrowserFileSystemHandle = {
  kind: "file" | "directory"
  getFile?: () => Promise<File>
}

export type VCardContactDraft = {
  name: string
  address: string
  phone: string
  role: string
}

const defaultVCardTransferTypes = [
  "text/vcard",
  "text/x-vcard",
  "text/plain",
  "text",
  "public.vcard",
  "public.utf8-plain-text",
  "com.apple.traditional-mac-plain-text",
] as const

function extractVCardText(payload: string) {
  const normalizedPayload = payload.trim()

  if (!normalizedPayload) {
    return null
  }

  return normalizedPayload.toUpperCase().includes("BEGIN:VCARD")
    ? normalizedPayload
    : null
}

function decodeVCardValue(value: string) {
  return value
    .replace(/\\n/gi, ", ")
    .replace(/\\,/g, ",")
    .replace(/\\;/g, ";")
    .replace(/\\\\/g, "\\")
    .trim()
}

function unfoldVCardLines(source: string) {
  return source
    .replace(/\r\n/g, "\n")
    .replace(/\n[ \t]/g, "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
}

function parseVCardLine(line: string) {
  const separatorIndex = line.indexOf(":")

  if (separatorIndex < 0) {
    return null
  }

  const metadata = line.slice(0, separatorIndex)
  const property = metadata.split(";")[0]?.split(".").pop()?.toUpperCase()

  if (!property) {
    return null
  }

  return {
    property,
    value: decodeVCardValue(line.slice(separatorIndex + 1)),
  }
}

function getFieldValues(lines: string[], fieldName: string) {
  const upperFieldName = fieldName.toUpperCase()

  return lines
    .map((line) => parseVCardLine(line))
    .filter((entry) => entry?.property === upperFieldName)
    .map((entry) => entry?.value ?? "")
    .filter(Boolean)
}

function formatNameFromN(value: string) {
  const [lastName, firstName, middleName, prefix, suffix] = value
    .split(";")
    .map((part) => decodeVCardValue(part))

  return [prefix, firstName, middleName, lastName, suffix].filter(Boolean).join(" ")
}

function formatAddress(value: string) {
  return value
    .split(";")
    .map((part) => decodeVCardValue(part))
    .filter(Boolean)
    .join(", ")
}

function parseVCardEntry(card: string, index: number): VCardContactDraft {
  const lines = unfoldVCardLines(card)
  const fn = getFieldValues(lines, "FN")[0]
  const n = getFieldValues(lines, "N")[0]
  const address = getFieldValues(lines, "ADR")[0] ?? getFieldValues(lines, "LABEL")[0] ?? ""
  const phone = getFieldValues(lines, "TEL")[0] ?? ""
  const name = fn || (n ? formatNameFromN(n) : `Imported contact ${index + 1}`)

  return {
    name,
    address: address.includes(";") ? formatAddress(address) : address,
    phone,
    role: "",
  }
}

export function parseVCardPayload(payload: string) {
  const matches = payload.match(/BEGIN:VCARD[\s\S]*?END:VCARD/gi)

  if (!matches) {
    return []
  }

  return matches.map((card, index) => parseVCardEntry(card, index))
}

export async function readSelectedVCardFiles(files: File[]) {
  const payloads = await Promise.all(files.map((file) => file.text()))
  const normalizedPayloads = payloads
    .map((payload) => extractVCardText(payload))
    .filter((payload): payload is string => Boolean(payload))

  return Array.from(new Set(normalizedPayloads))
}

export async function readDroppedVCardPayloads(dataTransfer: DataTransfer) {
  const payloadSet = new Set<string>()

  const appendPayload = (payload: string | null | undefined) => {
    const normalizedPayload = payload ? extractVCardText(payload) : null

    if (normalizedPayload) {
      payloadSet.add(normalizedPayload)
    }
  }

  const fileReadTasks: Array<Promise<string>> = []
  const stringReadTasks: Array<Promise<string>> = []
  const handleReadTasks: Array<Promise<string | null>> = []

  for (const transferType of dataTransfer.types) {
    appendPayload(dataTransfer.getData(transferType))
  }

  for (const transferType of defaultVCardTransferTypes) {
    appendPayload(dataTransfer.getData(transferType))
  }

  for (const file of Array.from(dataTransfer.files)) {
    if (
      file.type === "text/vcard" ||
      file.type === "public.vcard" ||
      file.name.toLowerCase().endsWith(".vcf") ||
      file.type === "text/x-vcard"
    ) {
      fileReadTasks.push(file.text())
    }
  }

  for (const item of Array.from(dataTransfer.items)) {
    if (item.kind === "file") {
      const file = item.getAsFile()

      if (
        file &&
        (file.name.toLowerCase().endsWith(".vcf") ||
          /vcard/i.test(file.type) ||
          /vcard/i.test(item.type))
      ) {
        fileReadTasks.push(file.text())
      }

      if ("getAsFileSystemHandle" in item && typeof item.getAsFileSystemHandle === "function") {
        const handlePromise = item
          .getAsFileSystemHandle()
          .then(async (handle: BrowserFileSystemHandle | null) => {
            if (!handle || handle.kind !== "file" || typeof handle.getFile !== "function") {
              return null
            }

            const handleFile = await handle.getFile()

            if (
              handleFile.name.toLowerCase().endsWith(".vcf") ||
              /vcard/i.test(handleFile.type) ||
              /vcard/i.test(item.type)
            ) {
              return handleFile.text()
            }

            return null
          })
          .catch(() => null)

        handleReadTasks.push(handlePromise)
      }
    }

    if (item.kind === "string") {
      stringReadTasks.push(
        new Promise<string>((resolve) => {
          item.getAsString((value) => resolve(value))
        })
      )
    }
  }

  for (const payload of await Promise.all(fileReadTasks)) {
    appendPayload(payload)
  }

  for (const payload of await Promise.all(stringReadTasks)) {
    appendPayload(payload)
  }

  for (const payload of await Promise.all(handleReadTasks)) {
    appendPayload(payload)
  }

  return Array.from(payloadSet)
}

import { getTransportPlan } from "@/lib/drive-plan"

const TRANSPORT_PLAN_RETRY_DELAY_MS = 400
const TRANSPORT_PLAN_MAX_ATTEMPTS = 2

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function GET() {
  let lastError: unknown = null

  for (let attempt = 1; attempt <= TRANSPORT_PLAN_MAX_ATTEMPTS; attempt += 1) {
    try {
      const transportPlan = await getTransportPlan()
      return Response.json(transportPlan, { status: 200 })
    } catch (error) {
      lastError = error

      console.error("[transport-plan] Failed to load transport plan", {
        attempt,
        maxAttempts: TRANSPORT_PLAN_MAX_ATTEMPTS,
        error: error instanceof Error ? error.message : error,
      })

      if (attempt < TRANSPORT_PLAN_MAX_ATTEMPTS) {
        await wait(TRANSPORT_PLAN_RETRY_DELAY_MS)
      }
    }
  }

  return Response.json(
    {
      error:
        lastError instanceof Error ? lastError.message : "Unexpected server error",
    },
    { status: 500 }
  )
}

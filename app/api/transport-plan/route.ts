import { getTransportPlan } from "@/lib/drive-plan"

export async function GET() {
  try {
    const transportPlan = await getTransportPlan()
    return Response.json(transportPlan, { status: 200 })
  } catch (error) {
    return Response.json(
      {
        error: error instanceof Error ? error.message : "Unexpected server error",
      },
      { status: 500 }
    )
  }
}

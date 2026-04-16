"use client"

import * as React from "react"
import { Check, RefreshCcw, Route } from "lucide-react"

import type { RecalculatedScheduleStop, ScheduleStopInput } from "@/lib/schedule-recalculation"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { ButtonGroup } from "@/components/ui/button-group"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

type ScheduleRoutingControlsProps = {
  stops: ScheduleStopInput[]
  arrivalTime: string
  hasPendingChanges: boolean
  onConfirmChanges: () => void
  onErrorChange: (message: string | null) => void
  onPlanReady: (
    stops: RecalculatedScheduleStop[],
    source: "optimize" | "recalculate"
  ) => boolean
}

type ScheduleRoutingResponse =
  | {
      error?: string
      stops?: RecalculatedScheduleStop[]
    }
  | undefined

async function parseRoutingResponse(response: Response) {
  const payload = (await response.json()) as ScheduleRoutingResponse

  if (!response.ok || !payload?.stops) {
    throw new Error(payload?.error ?? "Unable to build the schedule route.")
  }

  return payload.stops
}

export function ScheduleRoutingControls({
  stops,
  arrivalTime,
  hasPendingChanges,
  onConfirmChanges,
  onErrorChange,
  onPlanReady,
}: ScheduleRoutingControlsProps) {
  const [isRecalculating, setIsRecalculating] = React.useState(false)
  const [isOptimizing, setIsOptimizing] = React.useState(false)
  const [successFlash, setSuccessFlash] = React.useState<
    "optimize" | "recalculate" | "both" | null
  >(null)
  const successTimeoutRef = React.useRef<number | null>(null)

  const canRunActions = stops.length > 0 && Boolean(arrivalTime)

  React.useEffect(() => {
    return () => {
      if (successTimeoutRef.current !== null) {
        window.clearTimeout(successTimeoutRef.current)
      }
    }
  }, [])

  const triggerSuccessFlash = React.useCallback(
    (target: "optimize" | "recalculate" | "both") => {
      if (successTimeoutRef.current !== null) {
        window.clearTimeout(successTimeoutRef.current)
      }

      setSuccessFlash(target)
      successTimeoutRef.current = window.setTimeout(() => {
        setSuccessFlash((current) => (current === target ? null : current))
        successTimeoutRef.current = null
      }, 1500)
    },
    []
  )

  const isFlashActive = React.useCallback(
    (target: "optimize" | "recalculate") =>
      successFlash === target || successFlash === "both",
    [successFlash]
  )

  const runAction = React.useCallback(
    async (
      endpoint: string,
      setLoading: (loading: boolean) => void,
      target: "optimize" | "recalculate"
    ) => {
      if (successTimeoutRef.current !== null) {
        window.clearTimeout(successTimeoutRef.current)
      }
      onErrorChange(null)
      setLoading(true)

      try {
        const response = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            arrivalTime,
            stops,
          }),
        })

        const hasSuggestions = onPlanReady(await parseRoutingResponse(response), target)

        if (!hasSuggestions) {
          setLoading(false)
          window.requestAnimationFrame(() =>
            triggerSuccessFlash(target === "optimize" ? "both" : "recalculate")
          )
          return
        }
      } catch (error) {
        onErrorChange(
          error instanceof Error ? error.message : "Unable to build the schedule route."
        )
      } finally {
        setLoading(false)
      }
    },
    [arrivalTime, onErrorChange, onPlanReady, stops, triggerSuccessFlash]
  )

  return (
    <div className="flex items-center gap-2">
      {hasPendingChanges ? (
        <Button
          type="button"
          size="sm"
          className="bg-[#4f6bbd] text-white hover:bg-[#425ba0]"
          onClick={onConfirmChanges}
        >
          Confirm changes
        </Button>
      ) : null}

      <ButtonGroup>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={!canRunActions || isOptimizing || isRecalculating}
          className={cn(
            "border-[#d8ddd1] bg-[#f6faef] text-[#244226] hover:bg-[#edf5e2] transition-[background-color,border-color,color,box-shadow] duration-300 ease-[cubic-bezier(0.2,0,0,1)]",
            isFlashActive("optimize") &&
              "border-[#8bc67d] bg-[linear-gradient(180deg,#f4fde8_0%,#daf4bf_100%)] text-[#1f5a23] shadow-[0_10px_24px_-18px_rgba(68,128,59,0.55)]"
          )}
          onClick={() => {
            void runAction("/api/schedule/optimize", setIsOptimizing, "optimize")
          }}
        >
          {isFlashActive("optimize") ? (
            <Check className="size-4" />
          ) : (
            <Route className={cn("size-4", isOptimizing && "animate-pulse")} />
          )}
          <span className="hidden xl:inline">Find Fastest Route</span>
          <span className="xl:hidden">Fastest Route</span>
        </Button>

        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger
              delay={300}
              render={
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={!canRunActions || isRecalculating || isOptimizing}
                  className={cn(
                    "border-[#dbdbd6] bg-white text-[#1d1d1b] hover:bg-[#f3f3ef] transition-[background-color,border-color,color,box-shadow] duration-300 ease-[cubic-bezier(0.2,0,0,1)]",
                    isFlashActive("recalculate") &&
                      "border-[#8bc67d] bg-[linear-gradient(180deg,#f4fde8_0%,#daf4bf_100%)] text-[#1f5a23] shadow-[0_10px_24px_-18px_rgba(68,128,59,0.55)]"
                  )}
                  onClick={() => {
                    void runAction("/api/schedule/recalculate", setIsRecalculating, "recalculate")
                  }}
                >
                  {isFlashActive("recalculate") ? (
                    <Check className="size-4" />
                  ) : (
                    <RefreshCcw className={cn("size-4", isRecalculating && "animate-spin")} />
                  )}
                  {/* <span>Recalculate</span> */}
                </Button>
              }
            />
            <TooltipContent>Recalculate only</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </ButtonGroup>
    </div>
  )
}

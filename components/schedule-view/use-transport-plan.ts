"use client"

import * as React from "react"

import type { Drive, TransportPlan } from "@/lib/drive-plan"

const TRANSPORT_PLAN_CACHE_TTL_MS = 5 * 60 * 1000

let cachedTransportPlan: TransportPlan | null = null
let cachedTransportPlanAt = 0
let transportPlanPromise: Promise<TransportPlan> | null = null

function getCachedTransportPlan(options?: { includeExpired?: boolean }) {
  if (!cachedTransportPlan) {
    return null
  }

  if (
    !options?.includeExpired &&
    Date.now() - cachedTransportPlanAt > TRANSPORT_PLAN_CACHE_TTL_MS
  ) {
    cachedTransportPlan = null
    cachedTransportPlanAt = 0
    return null
  }

  return cachedTransportPlan
}

function setCachedTransportPlan(transportPlan: TransportPlan) {
  cachedTransportPlan = transportPlan
  cachedTransportPlanAt = Date.now()
}

export function primeTransportPlanCache(transportPlan: TransportPlan) {
  setCachedTransportPlan(transportPlan)
  return transportPlan
}

function replaceDriveInTransportPlan(transportPlan: TransportPlan, nextDrive: Drive) {
  return {
    ...transportPlan,
    drives: transportPlan.drives.map((drive) =>
      drive.id === nextDrive.id ? nextDrive : drive
    ),
  }
}

function patchCachedTransportPlan(nextDrive: Drive) {
  const currentTransportPlan = getCachedTransportPlan()

  if (!currentTransportPlan) {
    return
  }

  setCachedTransportPlan(replaceDriveInTransportPlan(currentTransportPlan, nextDrive))
}

async function loadTransportPlan(forceRefresh = false) {
  if (!forceRefresh) {
    const cached = getCachedTransportPlan()

    if (cached) {
      return cached
    }

    if (transportPlanPromise) {
      return transportPlanPromise
    }
  }

  const staleCachedTransportPlan = getCachedTransportPlan({ includeExpired: true })

  transportPlanPromise = fetch("/api/transport-plan")
    .then(async (response) => {
      const payload = (await response.json().catch(() => null)) as
        | (Partial<TransportPlan> & { error?: string })
        | null

      if (!response.ok || !payload?.drives || !payload.stopPickupPassengerOptions) {
        throw new Error(payload?.error ?? "Unable to load drives.")
      }

      const nextTransportPlan: TransportPlan = {
        drives: payload.drives,
        stopPickupPassengerOptions: payload.stopPickupPassengerOptions,
      }

      setCachedTransportPlan(nextTransportPlan)
      return nextTransportPlan
    })
    .finally(() => {
      transportPlanPromise = null
    })

  return transportPlanPromise
    .catch((error) => {
      if (staleCachedTransportPlan) {
        return staleCachedTransportPlan
      }

      throw error
    })
}

export function useTransportPlanState(initialTransportPlan?: TransportPlan | null) {
  const [transportPlan, setTransportPlan] = React.useState<TransportPlan | null>(() =>
    getCachedTransportPlan() ?? initialTransportPlan ?? null
  )
  const [isLoading, setIsLoading] = React.useState(
    () => !(getCachedTransportPlan() ?? initialTransportPlan)
  )
  const [error, setError] = React.useState<string | null>(null)
  const [retryToken, setRetryToken] = React.useState(0)

  React.useEffect(() => {
    if (!initialTransportPlan) {
      return
    }

    primeTransportPlanCache(initialTransportPlan)
    setTransportPlan((currentTransportPlan) => currentTransportPlan ?? initialTransportPlan)
    setIsLoading(false)
  }, [initialTransportPlan])

  const handleDriveUpdated = React.useCallback((nextDrive: Drive) => {
    patchCachedTransportPlan(nextDrive)

    React.startTransition(() => {
      setTransportPlan((currentTransportPlan) =>
        currentTransportPlan
          ? replaceDriveInTransportPlan(currentTransportPlan, nextDrive)
          : currentTransportPlan
      )
    })
  }, [])

  const refreshTransportPlan = React.useCallback(async () => {
    const nextTransportPlan = await loadTransportPlan(true)

    React.startTransition(() => {
      setTransportPlan(nextTransportPlan)
      setError(null)
      setIsLoading(false)
    })

    return nextTransportPlan
  }, [])

  const retryLoad = React.useCallback(() => {
    setRetryToken((current) => current + 1)
  }, [])

  React.useEffect(() => {
    const cached = getCachedTransportPlan()
    const staleCached = getCachedTransportPlan({ includeExpired: true })

    if (cached) {
      React.startTransition(() => {
        setTransportPlan(cached)
        setError(null)
        setIsLoading(false)
      })
      return
    }

    if (staleCached) {
      React.startTransition(() => {
        setTransportPlan(staleCached)
        setError(null)
        setIsLoading(false)
      })
    }

    if (initialTransportPlan) {
      React.startTransition(() => {
        setTransportPlan(initialTransportPlan)
        setError(null)
        setIsLoading(false)
      })
    }

    let cancelled = false

    if (!staleCached && !initialTransportPlan) {
      setIsLoading(true)
    }
    setError(null)

    void loadTransportPlan(retryToken > 0)
      .then((nextTransportPlan) => {
        if (cancelled) {
          return
        }

        React.startTransition(() => {
          setTransportPlan(nextTransportPlan)
          setError(null)
          setIsLoading(false)
        })
      })
      .catch((nextError) => {
        if (cancelled) {
          return
        }

        React.startTransition(() => {
          setError(nextError instanceof Error ? nextError.message : "Unable to load drives.")
          setIsLoading(false)
        })
      })

    return () => {
      cancelled = true
    }
  }, [initialTransportPlan, retryToken])

  return {
    transportPlan,
    isLoading,
    error,
    retryLoad,
    refreshTransportPlan,
    handleDriveUpdated,
  }
}

"use client"

import * as React from "react"

import type { Drive, TransportPlan } from "@/lib/drive-plan"
import {
  getCachedTransportPlan,
  getTransportPlanPromise,
  patchCachedTransportPlan,
  primeTransportPlanCache,
  replaceDriveInTransportPlan,
  setCachedTransportPlan,
  setTransportPlanPromise,
} from "@/lib/transport-plan-client-cache"

const TRANSPORT_PLAN_REQUEST_RETRY_DELAY_MS = 500
const TRANSPORT_PLAN_REQUEST_MAX_ATTEMPTS = 2

function wait(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms))
}

async function fetchTransportPlanWithRetry() {
  let lastError: unknown = null

  for (
    let attempt = 1;
    attempt <= TRANSPORT_PLAN_REQUEST_MAX_ATTEMPTS;
    attempt += 1
  ) {
    try {
      const response = await fetch("/api/transport-plan", {
        cache: "no-store",
      })
      const payload = (await response.json().catch(() => null)) as
        | (Partial<TransportPlan> & { error?: string })
        | null

      if (!response.ok || !payload?.drives || !payload.stopPickupPassengerOptions) {
        throw new Error(payload?.error ?? "Unable to load drives.")
      }

      return {
        drives: payload.drives,
        stopPickupPassengerOptions: payload.stopPickupPassengerOptions,
      } satisfies TransportPlan
    } catch (error) {
      lastError = error

      if (attempt < TRANSPORT_PLAN_REQUEST_MAX_ATTEMPTS) {
        await wait(TRANSPORT_PLAN_REQUEST_RETRY_DELAY_MS)
        continue
      }
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("Unable to load drives.")
}

async function loadTransportPlan(forceRefresh = false) {
  if (!forceRefresh) {
    const cached = getCachedTransportPlan()

    if (cached) {
      return cached
    }

    const activePromise = getTransportPlanPromise()

    if (activePromise) {
      return activePromise
    }
  }

  const staleCachedTransportPlan = getCachedTransportPlan({ includeExpired: true })

  const nextPromise = fetchTransportPlanWithRetry()
    .then((nextTransportPlan) => {
      setCachedTransportPlan(nextTransportPlan)
      return nextTransportPlan
    })
    .finally(() => {
      setTransportPlanPromise(null)
    })

  setTransportPlanPromise(nextPromise)

  return nextPromise
    .catch((error) => {
      if (staleCachedTransportPlan) {
        return staleCachedTransportPlan
      }

      throw error
    })
}

export function useTransportPlanState(initialTransportPlan?: TransportPlan | null) {
  const [transportPlan, setTransportPlan] = React.useState<TransportPlan | null>(() =>
    getCachedTransportPlan({ includeExpired: true }) ?? initialTransportPlan ?? null
  )
  const [isLoading, setIsLoading] = React.useState(
    () => !(getCachedTransportPlan({ includeExpired: true }) ?? initialTransportPlan)
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

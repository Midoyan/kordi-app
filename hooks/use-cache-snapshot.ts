"use client";

import { useSyncExternalStore } from "react";

import type { ClientCacheListener } from "@/lib/client-cache-store";

type SubscribeToCache = (listener: ClientCacheListener) => () => void;

export function useCacheSnapshot<TSnapshot>(
  subscribe: SubscribeToCache,
  getSnapshot: () => TSnapshot,
  getServerSnapshot: () => TSnapshot,
) {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

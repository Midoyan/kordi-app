"use client";

import { useRef, useSyncExternalStore } from "react";

import type { ClientCacheListener } from "@/lib/client-cache-store";

type SubscribeToCache = (listener: ClientCacheListener) => () => void;

export function useCacheSnapshot<TSnapshot>(
  subscribe: SubscribeToCache,
  getSnapshot: () => TSnapshot,
  getServerSnapshot: () => TSnapshot,
) {
  const cachedServerSnapshotRef = useRef<{ value: TSnapshot } | null>(null);

  if (cachedServerSnapshotRef.current === null) {
    cachedServerSnapshotRef.current = {
      value: getServerSnapshot(),
    };
  }

  return useSyncExternalStore(
    subscribe,
    getSnapshot,
    () => cachedServerSnapshotRef.current!.value,
  );
}

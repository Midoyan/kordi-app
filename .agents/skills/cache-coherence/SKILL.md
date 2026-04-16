---
name: cache-coherence
description: Use when changing any feature in this repo that reads from or writes to localStorage-backed caches, module-memory client caches, or derived client caches. Forces mapping source of truth, mirrors, write paths, subscriber paths, derived invalidation, cross-tab behavior, and manual verification before shipping.
---

# Cache Coherence

Use this skill whenever a task touches cached client data in this repo.

Before editing code, read [`../../../docs/cache-coherence-protocol.md`](../../../docs/cache-coherence-protocol.md).

## Workflow

1. Map the cache graph.
- Identify the source of truth.
- Identify every client mirror.
- Identify every derived cache.

2. Map the write paths.
- Find create, update, delete, import, and optimistic patch flows.
- For each write, state which caches must be patched, invalidated, or refetched.

3. Map the read paths.
- Find every mounted consumer.
- Check whether it reads a one-time snapshot, uses React-local copied state, or subscribes to cache changes.

4. Enforce subscription rules.
- If stale data would be visible without reload, the mounted consumer must subscribe.
- Same-tab writes must notify subscribers.
- `localStorage` caches must handle cross-tab `storage` events.

5. Check repo-specific derived behavior.
- `people` updates must keep `transportPlan.stopPickupPassengerOptions` in sync.
- `locations` and `vehicles` changes must reach any open editor pickers.
- `live-map-page` is an intentional load-on-mount exception unless the task explicitly changes that behavior.

6. Ship with verification.
- List the exact manual checks you ran.
- If you could not run one, say so clearly.

## Required Search Pass

Run targeted searches before and after changes:

```bash
rg -n "localStorage|cache|subscribePeopleCache|subscribeLocationsCache|subscribeVehiclesCache|subscribeTransportPlanCache" .
rg -n "getCachedPeopleSnapshot|getCachedLocationsSnapshot|getCachedVehiclesSnapshot|getCachedTransportPlan" .
```

## Done Criteria

Do not consider the task complete until you can answer all of these:

- What is the source of truth?
- Which caches mirror it?
- Which writes notify mounted consumers?
- Which derived caches were patched?
- What happens in another tab?
- Which manual checks prove the UI updates without reload?

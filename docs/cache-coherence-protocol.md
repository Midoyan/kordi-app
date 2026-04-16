# Cache Coherence Protocol

Use this checklist for any feature that reads from or writes to client-side cached data.

## Purpose
- Prevent stale UI caused by one screen updating cache data that other mounted screens never observe.
- Make cache behavior explicit before shipping new `localStorage` or module-memory cache code.

## Required Decisions
- Name the source of truth.
- List every client mirror.
  Examples: `localStorage`, module-memory caches, derived caches, React state copies.
- List every write path.
  Examples: create, update, delete, import, optimistic patch, cross-tab storage sync.
- List every mounted consumer that must update immediately after a write.
- State whether each consumer subscribes to cache changes or intentionally stays load-on-mount.
- State the cross-tab behavior.

## Implementation Rules
- Every shared client cache must have:
  - a read path
  - a write path
  - a subscribe path
  - same-tab notifications on writes
- Every `localStorage`-backed cache must also handle cross-tab `storage` events.
- If a cache has a module-memory mirror, cross-tab sync must clear or refresh that memory mirror before notifying subscribers.
- If one cache derives data into another cache, the write path must update or invalidate the derived cache in the same flow.
- Do not rely on “page reload fixes it” as acceptable cache behavior.

## Repo-Specific Caches
- `people`
  - Source of truth: backend `crew_members`
  - Client mirrors: `kordi.people-cache.v3`, module-memory people cache
  - Derived cache: transport-plan passenger options
- `locations`
  - Source of truth: backend locations API
  - Client mirrors: `kordi.locations-cache.v1`, module-memory locations cache
- `vehicles`
  - Source of truth: backend vans API
  - Client mirrors: `kordi.vehicles-cache.v2`, module-memory vehicles cache
- `transportPlan`
  - Source of truth: `/api/transport-plan`
  - Client mirrors: module-memory transport-plan cache
  - Derived fields: `stopPickupPassengerOptions` patched from people updates

## Consumer Rules
- Mounted consumers must subscribe when stale data would be user-visible or action-blocking.
- React state seeded from cache is not enough by itself; it must be refreshed from a subscription or intentionally isolated.
- If a screen intentionally stays load-on-mount, document the reason.
- Current intentional exception: `components/live-map-page.tsx` remains load-on-mount in this pass to avoid geocode and route churn.

## Pull Request Checklist
- What is the source of truth?
- Which cache keys or module caches are involved?
- Which write paths touch them?
- Which derived caches are patched or invalidated?
- Which mounted consumers subscribe?
- What happens in another tab?
- What manual tests prove the update is visible without reload?

## Minimum Manual Verification
- Update a person address and confirm Schedule passenger selection shows the new address without reload.
- Create a stop after that change and confirm first-passenger address autofill uses the new address.
- Update a location while the drive editor is open and confirm the picker reflects the change.
- Update a vehicle or driver and confirm the relevant picker reflects the change.
- Repeat one shared-data edit in a second tab and confirm the first tab updates via cache sync.

---
name: useApiMutation onSuccess override
description: hr-web's useApiMutation default cache invalidation can be silently dropped by caller onSuccess
---

# useApiMutation onSuccess override trap

In `apps/hr-web/src/hooks/use-api.ts`, `useApiMutation(url, method, invalidateKeys, options)`
runs cache invalidation in its own `onSuccess`. TanStack's `useMutation` only allows ONE
`onSuccess`, so when a caller passes `options.onSuccess`, the spread `...options` used to
overwrite the default — silently dropping every `invalidateKeys` invalidation for that callsite.

**Why:** A UI pass added per-callsite `onSuccess` toasts across ~33 pages; several callsites
(e.g. settings `hcm-setup`, attendance `periodCloseMutation` ledger key) lost their cache refresh
because the toast `onSuccess` replaced the invalidation one. Symptom: data looks stale after a
successful mutation until a manual refresh.

**How to apply:** The hook now destructures the caller's `onSuccess` and composes it AFTER
running the default invalidation, so `invalidateKeys` ALWAYS fires. Therefore: pass
`invalidateKeys` to declare what to refresh and don't hand-roll invalidation inside `onSuccess`.
This version of react-query types `onSuccess` with 4 params — forward them generically
(`(...args) => { invalidate(); callerOnSuccess?.(...args); }`) rather than hardcoding 3.

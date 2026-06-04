---
name: Destructuring null vs undefined
description: JS default values in destructuring only apply to undefined, not null — use ?? [] instead of = [] when API can return null
---

When API responses return `null` for empty lists (not `undefined`), JavaScript destructuring defaults silently pass the null through:

```js
const { data: items = [] } = { data: null };
// items === null  ← NOT []! Default only fires for undefined.
```

**Why:** `useQuery`'s `data` field is typed as `T | undefined` but mock/real APIs can return `null` in the JSON body. The `= []` destructuring default only guards against `undefined`, so `null` slips through and causes `null.filter(...)` crashes.

**How to apply:** In any hook result that destructures an array field with a default, use `??` instead:
```ts
// WRONG:
const { data: items = [] } = useApiQuery<Item[]>(...);

// CORRECT:
const { data: itemsRaw } = useApiQuery<Item[]>(...);
const items = itemsRaw ?? [];
```

Also ensure mock adapter fallback endpoints return `data: []` (empty array) rather than `data: null` for list-returning routes.

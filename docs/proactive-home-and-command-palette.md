# Proactive Home + Action Command Palette (authoritative spec)

Two features that turn the deep backend into a *smart, easy* product **without any AI**.
The platform already COMPUTES the smarts (scheduler reminders/SLA, intelligence
attrition/anomaly heuristics, approval pending steps, policy-driven defaults) — these
features SURFACE them and make every action one keystroke away.

---

## WS1 — Proactive Home ("For You")

A single per-role landing surface that answers "what needs me today?" by aggregating
signals that ALREADY EXIST. No new intelligence — pure fan-out + ranking.

### Backend: `GET /me/inbox` (new, in a small `platform/me` controller)
Resolves the authenticated actor (req.actor → user → worker) and fans out, tenant-scoped,
to existing sources (call the existing services/repos directly — do NOT duplicate logic):

| Section | Source (existing) |
|---|---|
| `approvals` (steps awaiting me) | approval-chain `findPendingForApprover(actor)` (see `/approval-chains/pending`) |
| `notifications` (unread) | platform-notifications `findForUser` (see `/notifications/me`) |
| `tasks` (due/overdue, mine) | onboarding tasks, hr-service-delivery cases, learning assignments by worker |
| `reminders` (expiring soon) | reminder-dispatch-log + scheduler ReminderDue (probation/contract/cert/visa) |
| `insights` (my risk/anomalies) | intelligence attrition-risk/worker + anomalies (manager: team-scoped) |

Response shape (stable contract — the web binds to this):
```ts
interface MeInbox {
  generatedAt: string;
  sections: Array<{
    key: 'approvals'|'tasks'|'reminders'|'notifications'|'insights';
    title: string;
    count: number;
    items: Array<{
      id: string;
      title: string;
      subtitle?: string;
      severity: 'INFO'|'DUE'|'OVERDUE'|'AT_RISK';
      dueAt?: string;
      deepLink: string;          // route into the exact record/action
      actions?: Array<{ label: string; commandPath: string; body?: Record<string,unknown> }>;
    }>;
  }>;
}
```
Rules: tenant + actor scoped (never another user's items); managers also get team-scoped
insights/approvals; each fan-out is independently fault-isolated (a failing source returns
an empty section + a logged warning, never a 500); cap each section (e.g. top 20) and
expose counts; cache per-actor for ~30s (Redis) to keep it fast. RBAC: an item only
appears if the actor is authorized for its deep-link/action.

### Frontend: `apps/hr-web/src/pages/home.tsx` (the new default authenticated route)
- Sectioned "For You" feed (approvals first, then overdue tasks, reminders, insights).
- Each item: title/subtitle, severity chip, due date, deep-link, and **inline action
  buttons** that POST the item's `commandPath` (reuse the existing command-mutation
  pattern + AllowedActions semantics) — e.g. approve a leave request without leaving home.
- Empty state that feels good ("You're all caught up ✨").
- Make it the post-login landing for every role (replace the bare dashboards as the
  default; keep the analytical dashboards reachable from nav).

---

## WS2 — Action-first Command Palette (⌘K)

Today `command-palette.tsx` only `navigate(path)`. Make it DO things, authorized-only.

### Action registry (`apps/hr-web/src/lib/command-actions.ts`)
A typed registry the palette searches. Four kinds:
```ts
type PaletteAction =
  | { kind: 'navigate'; id; label; group; path; keywords? }
  | { kind: 'create';   id; label; group; route; requiredPermission? }     // open a create form
  | { kind: 'command';  id; label; group; commandPath; body?; requiredPermission? } // run a command
  | { kind: 'search';   id; label; group; resolver: (q)=>Promise<Result[]> }; // people/records → deep-link
```
- Build the registry from the route map (navigate) + a curated set of high-frequency
  creates/commands per module. Filter by the user's effective permissions (from the
  JWT permissions / a `can(permission)` helper) — never show an action the user can't do.
- People/record search: a `search` action backed by the existing global search
  (`portal-search`) returning deep-links.

### Behavior
- ⌘K / Ctrl-K opens; fuzzy search across label + keywords + group; arrow-key navigation
  with a real active-descendant (fix the prior a11y gap — aria-activedescendant, not a
  static aria-selected); Enter runs the focused action.
- `command` actions POST to `commandPath` (same mutation path the pages use), toast the
  result, and invalidate relevant queries. `create` actions route to the form. `search`
  results deep-link. Errors surface inline (don't bounce).
- Recents/frequents pinned at top (localStorage). Keyboard-first, fully a11y.

### Why now
This is the interaction layer the AI command bar will later sit on — building the
authorized action registry now means the future AI layer just maps NL → registry actions.

---

## Acceptance (both)
- API: `GET /me/inbox` returns aggregated, actor/tenant-scoped, fault-isolated sections;
  unit tests for the aggregator (each source mocked, including a failing source → empty
  section, not 500) + a controller spec.
- Web: home.tsx renders sections from the contract and an inline approve action works;
  command palette runs a `command` action end-to-end; both have render + a11y tests.
- Extend apps/hr-api/test/runtime-lifecycle.e2e.test.ts: create a record requiring
  approval → assert it appears in the approver's `/me/inbox` `approvals` section → POST
  the item's command action → assert it leaves the inbox.
- pnpm typecheck, lint (--max-warnings 0), test, and the E2E all green. i18n the new
  strings (CI scans for hardcoded). Do not git add -A.
```

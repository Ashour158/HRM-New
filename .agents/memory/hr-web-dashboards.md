---
name: hr-web dashboards (Fusion design)
description: Non-obvious facts about the hr-web role dashboards and their data wiring.
---

# hr-web role dashboards

- The EMPLOYEE dashboard (`apps/hr-web/src/pages/employee/dashboard.tsx`) has NO backend "dashboard payload" endpoint. Its `DashboardData` (`upcomingEvents`, `pendingTasks`, `recentActivity`, `absenceBalance`) is an INTENTIONALLY hardcoded empty `React.useMemo`, with `isLoading = false`. The real, live data on this page is the ATTENDANCE wiring (`/employee/attendance-setup`, `/employee/profile`, today-state, attendance summary, correction requests) via `useApiQuery`/`useApiMutation`.
  - **Why:** the empty `data` memo predates the Fusion redesign — it is not a regression. Code reviewers repeatedly flag it as "dropped the live dashboard query"; it was never backend-driven. Do not "restore" a non-existent endpoint.
  - **How to apply:** if asked to make employee upcoming-events/tasks real, you must first add a backend endpoint; there is none today.
- Manager (`/manager/dashboard`) and Admin (`/admin/dashboard`) ARE backend-driven via single `useApiQuery` calls.
- recharts 3.x `ResponsiveContainer` logs "The width(-1) and height(-1) of chart should be greater than 0" on first mount inside grid/flex cards; charts still render once ResizeObserver fires. Benign — not a missing-height bug when the chart wrapper already has a fixed height (e.g. `h-72`).

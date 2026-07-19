import {
  BadgeDollarSign,
  BarChart3,
  Briefcase,
  Clock3,
  GraduationCap,
  Home,
  MessageSquare,
  MoreHorizontal,
  Network,
  ShieldCheck,
  TrendingUp,
  Users,
  type LucideIcon,
} from 'lucide-react';

/**
 * A single navigable destination inside an admin primary-nav module (or the
 * "More" flyout). `page` is the basename (no extension) of the source file
 * under `src/pages/admin/` this link surfaces, when one exists - it is used
 * purely for nav-completeness auditing in tests, not for rendering.
 * `systemOnly` mirrors the route-level `RequireRoles allowedRoles={systemAdminRoleNames}`
 * guard applied in routes/index.tsx to every `/admin/system-console/*` route -
 * links flagged here are hidden from admins who cannot pass that guard so the
 * nav never offers a destination that immediately bounces the user back out.
 */
export interface AdminNavLink {
  label: string;
  path: string;
  page?: string;
  systemOnly?: boolean;
}

export interface AdminNavModule {
  id: string;
  label: string;
  /** Primary click target for the module tab itself. */
  path: string;
  icon: LucideIcon;
  links: AdminNavLink[];
}

/**
 * The 11 always-visible primary-bar modules, in display order, per the
 * Zoho-inspired admin IA. Route paths below are the canonical (non-redirect)
 * paths registered in routes/index.tsx - none of them were changed to build
 * this structure, only how they are grouped and presented.
 */
export const ADMIN_PRIMARY_MODULES: AdminNavModule[] = [
  {
    id: 'home',
    label: 'Home',
    path: '/admin',
    icon: Home,
    links: [
      { label: 'Overview', path: '/admin' },
      { label: 'Get Started', path: '/admin/get-started', page: 'get-started' },
      { label: 'Dashboard', path: '/admin/dashboard', page: 'dashboard' },
    ],
  },
  {
    id: 'people',
    label: 'People',
    path: '/admin/employees',
    icon: Users,
    links: [
      { label: 'Workers', path: '/admin/employees', page: 'workers' },
      { label: 'Add Employee', path: '/admin/employees/new', page: 'employee-create' },
    ],
  },
  {
    id: 'organization',
    label: 'Organization',
    path: '/admin/organization',
    icon: Network,
    links: [
      { label: 'Organization', path: '/admin/organization', page: 'organization' },
      { label: 'Workforce Planning', path: '/admin/workforce-planning', page: 'organization' },
      { label: 'Global HR', path: '/admin/global-hr', page: 'global-hr' },
    ],
  },
  {
    id: 'time-attendance',
    label: 'Time & Attendance',
    path: '/admin/attendance',
    icon: Clock3,
    links: [
      { label: 'Attendance', path: '/admin/attendance', page: 'attendance' },
      { label: 'Leave', path: '/admin/leave', page: 'leave-management' },
      { label: 'Workforce Management', path: '/admin/workforce-management', page: 'workforce-management' },
    ],
  },
  {
    id: 'talent',
    label: 'Talent',
    path: '/admin/recruiting',
    icon: Briefcase,
    links: [
      { label: 'Recruiting', path: '/admin/recruiting', page: 'recruiting' },
      { label: 'Onboarding', path: '/admin/onboarding', page: 'onboarding' },
      { label: 'Skills & Talent', path: '/admin/skills-talent', page: 'skills-talent' },
    ],
  },
  {
    id: 'performance',
    label: 'Performance',
    path: '/admin/performance',
    icon: TrendingUp,
    links: [
      { label: 'Performance', path: '/admin/performance', page: 'performance' },
      { label: 'Performance Operations', path: '/admin/performance/operations', page: 'performance-operations' },
      { label: 'Feedback 360', path: '/admin/feedback-360', page: 'feedback-360' },
    ],
  },
  {
    id: 'learning',
    label: 'Learning',
    path: '/admin/learning',
    icon: GraduationCap,
    links: [
      { label: 'Learning', path: '/admin/learning', page: 'learning' },
    ],
  },
  {
    id: 'compensation',
    label: 'Compensation',
    path: '/admin/compensation',
    icon: BadgeDollarSign,
    links: [
      { label: 'Compensation', path: '/admin/compensation', page: 'compensation' },
      { label: 'Payroll', path: '/admin/payroll', page: 'payroll' },
      { label: 'Benefits', path: '/admin/benefits', page: 'benefits' },
    ],
  },
  {
    id: 'engagement',
    label: 'Engagement',
    path: '/admin/engagement',
    icon: MessageSquare,
    links: [
      { label: 'Engagement', path: '/admin/engagement', page: 'engagement' },
      { label: 'Wellbeing & EAP', path: '/admin/wellbeing-eap', page: 'wellbeing-eap' },
      { label: 'Employee Relations', path: '/admin/employee-relations', page: 'employee-relations' },
      { label: 'HR Service Delivery', path: '/admin/hr-service-delivery', page: 'hr-service-delivery' },
    ],
  },
  {
    // Elevated to a primary, always-visible slot (not tucked into More) -
    // this platform's compliance/governance depth is a deliberate point of
    // difference from Zoho's own IA and should read that way in the nav.
    id: 'governance',
    label: 'Governance',
    path: '/admin/compliance',
    icon: ShieldCheck,
    links: [
      { label: 'Compliance', path: '/admin/compliance', page: 'compliance' },
      { label: 'Country Policy', path: '/admin/country-policy', page: 'country-policy' },
      { label: 'Policy Center', path: '/admin/system-console/policies', page: 'policies', systemOnly: true },
      { label: 'SoD Rules', path: '/admin/system-console/sod-rules', page: 'sod-rules', systemOnly: true },
      { label: 'Access Governance', path: '/admin/system-console/access-governance', page: 'access-governance', systemOnly: true },
      { label: 'Approvals Config', path: '/admin/system-console/approvals', page: 'approvals-config', systemOnly: true },
      { label: 'Audit Console', path: '/admin/system-console/audit', page: 'audit-console', systemOnly: true },
      { label: 'Field Access', path: '/admin/system-console/field-access', page: 'field-access', systemOnly: true },
      { label: 'AI Governance', path: '/admin/hr-ai-governance', page: 'hr-ai-governance' },
      { label: 'DEI Analytics', path: '/admin/dei-analytics', page: 'dei-analytics' },
      { label: 'Contingent Workforce', path: '/admin/contingent-workforce', page: 'contingent-workforce' },
      { label: 'Union & Labor', path: '/admin/union-labor', page: 'union-labor' },
    ],
  },
  {
    id: 'reports',
    label: 'Reports',
    path: '/admin/reports',
    icon: BarChart3,
    links: [
      { label: 'Reports', path: '/admin/reports', page: 'reporting' },
      { label: 'Workforce Insights', path: '/admin/insights', page: 'insights' },
    ],
  },
];

/**
 * Platform/ops-only tooling that lives behind the "More" flyout instead of
 * the always-visible primary bar.
 */
export const ADMIN_MORE_LINKS: AdminNavLink[] = [
  { label: 'System Console', path: '/admin/system-console', page: 'system-console', systemOnly: true },
  { label: 'Settings', path: '/admin/system-console/settings', page: 'settings', systemOnly: true },
  { label: 'Single Sign-On', path: '/admin/system-console/sso', page: 'sso', systemOnly: true },
  { label: 'Integrations', path: '/admin/system-console/integrations', page: 'integrations', systemOnly: true },
  { label: 'Automation', path: '/admin/system-console/automation', page: 'automation', systemOnly: true },
  { label: 'Event Contracts', path: '/admin/system-console/event-contracts', page: 'event-contracts', systemOnly: true },
  { label: 'Failed Work Queue', path: '/admin/system-console/dead-letter-events', page: 'dead-letter-events', systemOnly: true },
  { label: 'Module Catalog', path: '/admin/modules', page: 'module-catalog' },
  { label: 'Production Readiness', path: '/admin/system-console/readiness', page: 'readiness', systemOnly: true },
];

export const ADMIN_MORE_MODULE: Omit<AdminNavModule, 'links'> = {
  id: 'more',
  label: 'More',
  path: '/admin/system-console',
  icon: MoreHorizontal,
};

/**
 * Admin `pages/admin/*.tsx` files that are intentionally NOT surfaced as a
 * standalone nav destination:
 * - `employee-profile`, `module-workbench`, `module-operations` are dynamic
 *   `:id`/`:moduleId` detail routes reached contextually (row click, tile
 *   click) from a page that IS in the nav (Workers, Module Catalog) - a
 *   fixed nav link can't target a dynamic id, and this mirrors how these
 *   routes were already reached (or not reached at all) before this change.
 * - `domain-workspace` is a shared internal UI building block used by
 *   several admin pages (benefits, engagement, union-labor, wellbeing-eap,
 *   hr-ai-governance, contingent-workforce); it is not registered as its
 *   own route in routes/index.tsx.
 */
export const ADMIN_NAV_COMPLETENESS_ALLOWLIST = [
  'employee-profile',
  'module-workbench',
  'module-operations',
  'domain-workspace',
] as const;

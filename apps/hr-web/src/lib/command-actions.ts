import type { MeInbox } from './me-inbox';
import { resolvePortalSearchPath, type PortalSearchContext } from './portal-search';

export interface PaletteSearchResult {
  id: string;
  label: string;
  group: string;
  path: string;
  keywords?: string[];
}

interface BasePaletteAction {
  id: string;
  label: string;
  group: string;
  keywords?: string[];
  requiredPermission?: string;
}

export interface NavigatePaletteAction extends BasePaletteAction {
  kind: 'navigate';
  path: string;
}

export interface CreatePaletteAction extends BasePaletteAction {
  kind: 'create';
  route: string;
}

export interface CommandPaletteAction extends BasePaletteAction {
  kind: 'command';
  commandPath: string;
  body?: Record<string, unknown>;
}

export interface SearchPaletteAction extends BasePaletteAction {
  kind: 'search';
  resolver: (query: string) => Promise<PaletteSearchResult[]>;
}

export type PaletteAction = NavigatePaletteAction | CreatePaletteAction | CommandPaletteAction | SearchPaletteAction;
export type CommandAction = PaletteAction;

interface NavigationSource {
  label: string;
  path: string;
  group?: string;
  keywords?: string[];
}

interface BuildCommandActionsOptions {
  navigationItems: NavigationSource[];
  inbox?: MeInbox;
  can: (permissionCode: string) => boolean;
  portalType: PortalSearchContext;
  portalKeywords?: string[];
  labels?: {
    createEmployee?: string;
    openReportBuilder?: string;
    configureApprovals?: string;
    groupNavigate?: string;
    groupCreate?: string;
    groupCommand?: string;
    groupSearch?: string;
    searchResult?: (query: string) => string;
  };
}

const curatedActions: PaletteAction[] = [
  {
    id: 'create:employee',
    kind: 'create',
    label: 'Create employee',
    group: 'Create',
    route: '/admin/employees/new',
    requiredPermission: 'WORKER_WRITE',
    keywords: ['hire', 'worker', 'profile'],
  },
  {
    id: 'create:report',
    kind: 'create',
    label: 'Build report',
    group: 'Create',
    route: '/admin/reports#builder',
    requiredPermission: 'REPORT_WRITE',
    keywords: ['analytics', 'bi', 'dashboard'],
  },
  {
    id: 'configure:approvals',
    kind: 'navigate',
    label: 'Configure approvals',
    group: 'Commands',
    path: '/admin/system-console/approvals',
    requiredPermission: 'WORKFLOW_MANAGE',
    keywords: ['workflow', 'approval', 'policy'],
  },
];

export function buildCommandActions({
  navigationItems,
  inbox,
  can,
  portalType,
  portalKeywords = [],
  labels,
}: BuildCommandActionsOptions): PaletteAction[] {
  const groupNavigate = labels?.groupNavigate ?? 'Navigate';
  const groupCreate = labels?.groupCreate ?? 'Create';
  const groupCommand = labels?.groupCommand ?? 'Commands';
  const groupSearch = labels?.groupSearch ?? 'Search';

  const navigationActions = navigationItems.map<PaletteAction>((item) => ({
    id: `nav:${item.path}`,
    kind: 'navigate',
    label: item.label,
    group: item.group ?? groupNavigate,
    path: item.path,
    keywords: [...(item.keywords ?? []), ...portalKeywords],
  }));

  const inboxCommandActions = (inbox?.sections ?? []).flatMap((section) => (
    section.items.flatMap((item) => (
      (item.actions ?? []).map<PaletteAction>((action) => ({
        id: `inbox:${item.id}:${action.commandPath}`,
        kind: 'command',
        label: `${action.label}: ${item.title}`,
        group: section.title || groupCommand,
        commandPath: action.commandPath,
        body: action.body,
        keywords: [section.key, item.title, item.subtitle ?? '', action.label].filter(Boolean),
      }))
    ))
  ));

  const translatedCurated = curatedActions.map((action) => {
    if (action.id === 'create:employee') return { ...action, group: groupCreate, label: labels?.createEmployee ?? action.label };
    if (action.id === 'create:report') return { ...action, group: groupCreate, label: labels?.openReportBuilder ?? action.label };
    if (action.id === 'configure:approvals') return { ...action, group: groupCommand, label: labels?.configureApprovals ?? action.label };
    return action;
  });

  return dedupeActions([
    ...navigationActions,
    ...inboxCommandActions,
    ...translatedCurated.filter((action) => !action.requiredPermission || can(action.requiredPermission)),
    buildPortalSearchAction(portalType, groupSearch, labels?.searchResult),
  ]);
}

function buildPortalSearchAction(
  portalType: PortalSearchContext,
  group: string,
  labelFactory?: (query: string) => string,
): SearchPaletteAction {
  return {
    id: `search:${portalType}`,
    kind: 'search',
    label: group,
    group,
    keywords: ['people', 'records', 'modules'],
    resolver: async (query) => {
      const trimmed = query.trim();
      if (!trimmed) return [];
      const slug = trimmed.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'query';
      return [{
        id: `search:${portalType}:${slug}`,
        label: labelFactory?.(trimmed) ?? trimmed,
        group,
        path: resolvePortalSearchPath(portalType, trimmed),
        keywords: [trimmed, portalType],
      }];
    },
  };
}

function dedupeActions(actions: PaletteAction[]): PaletteAction[] {
  const seen = new Set<string>();
  return actions.filter((action) => {
    if (seen.has(action.id)) return false;
    seen.add(action.id);
    return true;
  });
}

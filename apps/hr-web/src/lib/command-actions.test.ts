import { describe, expect, it, vi } from 'vitest';
import { buildCommandActions } from './command-actions';

const labels = {
  createEmployee: 'Create employee',
  openReportBuilder: 'Build report',
  configureApprovals: 'Configure approvals',
  groupNavigate: 'Navigate',
  groupCreate: 'Create',
  groupCommand: 'Commands',
  groupSearch: 'Search',
  searchResult: (query: string) => `Search for "${query}"`,
};

describe('buildCommandActions', () => {
  it('builds route, curated, inbox, and portal search actions filtered by permission', async () => {
    const actions = buildCommandActions({
      navigationItems: [{ label: 'Employees', path: '/admin/employees', group: 'Navigate', keywords: ['people'] }],
      inbox: {
        generatedAt: new Date().toISOString(),
        sections: [{
          key: 'approvals',
          title: 'Approvals',
          count: 1,
          items: [{
            id: 'approval-1',
            title: 'Leave request',
            severity: 'DUE',
            deepLink: '/manager/approvals',
            actions: [{ label: 'Approve', commandPath: '/workflow/approve', body: { reason: 'Approved' } }],
          }],
        }],
      },
      can: (permission) => permission === 'WORKER_WRITE',
      portalType: 'admin',
      portalKeywords: ['admin'],
      labels,
    });

    expect(actions).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'nav:/admin/employees', kind: 'navigate', group: 'Navigate', path: '/admin/employees' }),
      expect.objectContaining({ id: 'create:employee', kind: 'create', group: 'Create', route: '/admin/employees/new' }),
      expect.objectContaining({ id: 'inbox:approval-1:/workflow/approve', kind: 'command', group: 'Approvals', commandPath: '/workflow/approve' }),
    ]));
    expect(actions.some((action) => action.id === 'create:report')).toBe(false);

    const searchAction = actions.find((action) => action.kind === 'search');
    expect(searchAction).toBeDefined();
    if (searchAction?.kind !== 'search') throw new Error('Expected search action');

    const results = await searchAction.resolver('leave policy');
    expect(results[0]).toEqual(expect.objectContaining({
      id: 'search:admin:leave-policy',
      group: 'Search',
      path: '/admin/system-console/policies',
    }));
  });

  it('does not surface curated actions when permissions are missing', () => {
    const actions = buildCommandActions({
      navigationItems: [],
      can: vi.fn(() => false),
      portalType: 'admin',
      labels,
    });

    expect(actions.filter((action) => action.kind === 'create' || action.id.startsWith('configure:'))).toHaveLength(0);
    expect(actions.some((action) => action.kind === 'search')).toBe(true);
  });
});

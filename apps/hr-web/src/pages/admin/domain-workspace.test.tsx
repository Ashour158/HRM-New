import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type * as React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AdminSkillsTalent } from './skills-talent';
import { AdminUnionLabor } from './union-labor';
import { AdminWellbeingEap } from './wellbeing-eap';
import { AdminContingentWorkforce } from './contingent-workforce';
import { AdminHrAiGovernance } from './hr-ai-governance';

const useApiQueryMock = vi.fn();

vi.mock('@/hooks/use-api', () => ({
  useApiQuery: (...args: unknown[]) => useApiQueryMock(...args),
}));

vi.mock('@/hooks/use-tenant', () => ({
  useTenant: () => ({
    tenantId: '00000000-0000-0000-0000-000000000001',
    tenantName: 'Default Tenant',
  }),
}));

vi.mock('@/hooks/use-auth', () => ({
  useAuth: () => ({
    user: {
      id: '00000000-0000-0000-0000-000000000010',
      tenantId: '00000000-0000-0000-0000-000000000001',
      roles: [{ id: 'role-1', name: 'HR_ADMIN' }],
    },
  }),
}));

vi.mock('@/stores/ui-store', () => ({
  useUIStore: (selector: (state: { addNotification: () => void }) => unknown) => selector({ addNotification: vi.fn() }),
}));

vi.mock('@/components/common/allowed-actions', () => ({
  AllowedActions: ({ aggregateType }: { aggregateType: string }) => <div data-testid="allowed-actions">{aggregateType}</div>,
}));

function renderWithQueryClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

describe('backend-complete admin workspaces', () => {
  beforeEach(() => {
    useApiQueryMock.mockReset();
    useApiQueryMock.mockReturnValue({
      data: [
        {
          id: { value: '00000000-0000-0000-0000-000000000100' },
          title: 'Safety essentials',
          poolName: 'Future leaders',
          caseNumber: 'ER-2026-0001',
          unionName: 'Nurses Guild',
          name: 'Wellness cohort',
          sowNumber: 'SOW-2026-001',
          useCaseName: 'Attrition scoring',
          status: 'DRAFT',
        },
      ],
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });
  });

  it('renders skills and talent administration', () => {
    renderWithQueryClient(<AdminSkillsTalent />);

    expect(screen.getByRole('heading', { name: 'Skills & Talent' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Succession Plans' })).toBeInTheDocument();
  });

  it('renders union and labor administration', () => {
    renderWithQueryClient(<AdminUnionLabor />);

    expect(screen.getByRole('heading', { name: 'Union & Labor' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Grievances' })).toBeInTheDocument();
  });

  it('renders wellbeing administration', () => {
    renderWithQueryClient(<AdminWellbeingEap />);

    expect(screen.getByRole('heading', { name: 'Wellbeing & EAP' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Mental Health Cases' })).toBeInTheDocument();
  });

  it('renders contingent workforce administration', () => {
    renderWithQueryClient(<AdminContingentWorkforce />);

    expect(screen.getByRole('heading', { name: 'Contingent Workforce' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Classification Reviews' })).toBeInTheDocument();
  });

  it('renders HR AI governance administration', () => {
    renderWithQueryClient(<AdminHrAiGovernance />);

    expect(screen.getByRole('heading', { name: 'HR AI Governance' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Kill Switches' })).toBeInTheDocument();
  });
});

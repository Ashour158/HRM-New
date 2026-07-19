import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { I18nProvider } from '@/i18n/i18n-provider';
import { AdminPolicies } from './policies';

const apiClientGetMock = vi.hoisted(() => vi.fn());
const apiClientPostMock = vi.hoisted(() => vi.fn());
const apiClientPatchMock = vi.hoisted(() => vi.fn());
const addNotificationMock = vi.hoisted(() => vi.fn());

const tenantId = '00000000-0000-4000-8000-000000000001';

vi.mock('@/lib/api-client', () => ({
  apiClient: {
    get: apiClientGetMock,
    post: apiClientPostMock,
    patch: apiClientPatchMock,
  },
}));

vi.mock('@/hooks/use-tenant', () => ({
  useTenant: () => ({
    tenantId,
    tenantName: 'Acme Health',
    tenantConfig: {
      currency: 'AED',
      dateFormat: 'DD/MM/YYYY',
      timezone: 'Asia/Dubai',
      features: [],
    },
  }),
}));

vi.mock('@/stores/ui-store', () => ({
  useUIStore: (selector: (state: { addNotification: typeof addNotificationMock }) => unknown) => selector({ addNotification: addNotificationMock }),
}));

function apiResponse(data: unknown) {
  return Promise.resolve({ data: { success: true, data, correlationId: 'test-correlation-id' } });
}

function renderPolicies() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <I18nProvider>
        <AdminPolicies />
      </I18nProvider>
    </QueryClientProvider>,
  );
}

describe('AdminPolicies', () => {
  beforeEach(() => {
    apiClientGetMock.mockReset();
    apiClientPostMock.mockReset();
    apiClientPatchMock.mockReset();
    addNotificationMock.mockReset();
    apiClientGetMock.mockImplementation((url: string) => {
      if (url === '/admin/policies/summary') {
        return apiResponse({ totalRevisions: 0, byStatus: {}, byArea: {} });
      }
      if (url === '/admin/policies/revisions') return apiResponse([]);
      if (url === '/admin/policies/templates') return apiResponse([]);
      return apiResponse([]);
    });
    apiClientPostMock.mockResolvedValue({
      data: {
        success: true,
        data: {
          id: 'revision-1',
          area: 'LEAVE',
          title: 'New Leave Policy',
          status: 'DRAFT',
          scope: { tenantId },
          draftConfig: {},
          updatedAt: '2026-07-01T00:00:00.000Z',
        },
      },
    });
  });

  it('blocks saving a draft with no title and shows an inline error', async () => {
    renderPolicies();

    expect(await screen.findByRole('heading', { name: 'Policy Builder' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'New policy' }));
    await userEvent.click(screen.getByRole('button', { name: 'Save draft' }));

    expect(await screen.findByText('Policy title is required')).toBeInTheDocument();
    expect(apiClientPostMock).not.toHaveBeenCalled();
  });

  it('saves a valid draft and fires the create-revision mutation with the built scope and draft config', async () => {
    renderPolicies();

    expect(await screen.findByRole('heading', { name: 'Policy Builder' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'New policy' }));
    await userEvent.type(screen.getByLabelText('Policy title'), 'New Leave Policy');
    await userEvent.click(screen.getByRole('button', { name: 'Save draft' }));

    await waitFor(() => expect(apiClientPostMock).toHaveBeenCalledWith(
      '/admin/policies/revisions',
      expect.objectContaining({
        area: 'LEAVE',
        title: 'New Leave Policy',
        scope: expect.objectContaining({ tenantId }),
        // LEAVE nests the generic rule ledger inside the leave-policy shell's
        // real ledger key (see RULE_LEDGER_AREAS in policy-center-controls.ts),
        // not a flat top-level ledger.
        draftConfig: expect.objectContaining({
          leavePolicies: expect.arrayContaining([
            expect.objectContaining({
              code: 'GENERAL',
              accrualRules: expect.arrayContaining([
                expect.objectContaining({ code: 'DEFAULT_RULE' }),
              ]),
            }),
          ]),
        }),
      }),
    ));
    expect(addNotificationMock).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Policy saved',
      type: 'success',
    }));
  });

  it('adds a rule row that submits with the rest of the draft config', async () => {
    renderPolicies();

    expect(await screen.findByRole('heading', { name: 'Policy Builder' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'New policy' }));
    await userEvent.type(screen.getByLabelText('Policy title'), 'Multi-rule policy');
    await userEvent.click(screen.getByRole('button', { name: 'Add rule' }));

    const ruleCodeInputs = screen.getAllByLabelText('Rule code');
    expect(ruleCodeInputs).toHaveLength(2);

    await userEvent.click(screen.getByRole('button', { name: 'Save draft' }));

    await waitFor(() => expect(apiClientPostMock).toHaveBeenCalledWith(
      '/admin/policies/revisions',
      expect.objectContaining({
        draftConfig: expect.objectContaining({
          leavePolicies: expect.arrayContaining([
            expect.objectContaining({
              code: 'GENERAL',
              accrualRules: expect.arrayContaining([
                expect.objectContaining({ code: 'DEFAULT_RULE' }),
                expect.objectContaining({ code: 'RULE_2' }),
              ]),
            }),
          ]),
        }),
      }),
    ));
  });
});

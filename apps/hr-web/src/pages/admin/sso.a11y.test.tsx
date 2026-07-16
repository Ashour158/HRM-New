import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import { describe, expect, it, vi } from 'vitest';
import { AdminSso } from './sso';

const apiClientGetMock = vi.hoisted(() => vi.fn());
const apiClientPostMock = vi.hoisted(() => vi.fn());
const apiClientPatchMock = vi.hoisted(() => vi.fn());
const apiClientDeleteMock = vi.hoisted(() => vi.fn());
const addNotificationMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/api-client', () => ({
  apiClient: {
    get: apiClientGetMock,
    post: apiClientPostMock,
    patch: apiClientPatchMock,
    delete: apiClientDeleteMock,
  },
}));

vi.mock('@/hooks/use-tenant', () => ({
  useTenant: () => ({
    tenantId: '00000000-0000-0000-0000-000000000001',
    tenantName: 'Acme Health',
  }),
}));

vi.mock('@/stores/ui-store', () => ({
  useUIStore: (selector: (state: { addNotification: typeof addNotificationMock }) => unknown) => selector({ addNotification: addNotificationMock }),
}));

const providers = [
  {
    id: 'idp-oidc',
    tenantId: '00000000-0000-0000-0000-000000000001',
    protocol: 'OIDC',
    displayName: 'Acme Okta',
    enabled: true,
    jitProvisioning: true,
    defaultRoles: ['EMPLOYEE'],
    attributeMapping: { email: 'email' },
    groupRoleMapping: {},
    oidcIssuerUrl: 'https://idp.example.com',
    oidcClientId: 'client-id',
    oidcScopes: ['openid', 'email', 'profile'],
    hasOidcClientSecret: true,
    hasSamlSpPrivateKey: false,
  },
];

function renderSso() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  apiClientGetMock.mockResolvedValue({ data: { success: true, data: providers } });
  apiClientPatchMock.mockResolvedValue({ data: { success: true, data: providers[0] } });
  apiClientPostMock.mockResolvedValue({ data: { success: true, data: providers[0] } });
  apiClientDeleteMock.mockResolvedValue({ data: { success: true, data: { ok: true } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <AdminSso />
    </QueryClientProvider>,
  );
}

describe('AdminSso accessibility', () => {
  it('renders without accessibility violations', async () => {
    const { container } = renderSso();

    expect(await screen.findByRole('heading', { name: 'Single Sign-On' })).toBeInTheDocument();
    expect(await screen.findByText('Acme Okta')).toBeInTheDocument();
    await expect(axe(container)).resolves.toHaveNoViolations();
  });
});

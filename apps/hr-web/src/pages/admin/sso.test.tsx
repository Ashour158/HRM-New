import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { beforeEach, describe, expect, it, vi } from 'vitest';
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

describe('AdminSso', () => {
  beforeEach(() => {
    apiClientGetMock.mockReset();
    apiClientPostMock.mockReset();
    apiClientPatchMock.mockReset();
    apiClientDeleteMock.mockReset();
    addNotificationMock.mockReset();
  });

  it('lists masked SSO providers and saves updates', async () => {
    renderSso();

    expect(await screen.findByRole('heading', { name: 'Single Sign-On' })).toBeInTheDocument();
    expect(await screen.findByText('Acme Okta')).toBeInTheDocument();
    expect(screen.getByText('Stored')).toBeInTheDocument();

    await userEvent.clear(screen.getByLabelText('Display name'));
    await userEvent.type(screen.getByLabelText('Display name'), 'Acme Workforce IdP');
    await userEvent.click(screen.getByRole('button', { name: 'Save Provider' }));

    await waitFor(() => expect(apiClientPatchMock).toHaveBeenCalledWith(
      '/auth/sso/config/idp-oidc',
      expect.objectContaining({
        displayName: 'Acme Workforce IdP',
        protocol: 'OIDC',
        enabled: true,
      }),
    ));
    expect(addNotificationMock).toHaveBeenCalledWith(expect.objectContaining({
      title: 'SSO provider saved',
      type: 'success',
    }));
  });

  it('renders without accessibility violations', async () => {
    const { container } = renderSso();

    expect(await screen.findByText('Acme Okta')).toBeInTheDocument();
    await expect(axe(container)).resolves.toHaveNoViolations();
  });

  it('blocks submission and shows an inline error when display name is cleared', async () => {
    renderSso();

    expect(await screen.findByText('Acme Okta')).toBeInTheDocument();
    await userEvent.clear(screen.getByLabelText('Display name'));
    await userEvent.click(screen.getByRole('button', { name: 'Save Provider' }));

    expect(await screen.findByText('Display name is required')).toBeInTheDocument();
    expect(apiClientPatchMock).not.toHaveBeenCalled();
    expect(apiClientPostMock).not.toHaveBeenCalled();
  });

  it('blocks submission and shows an inline error when the OIDC issuer URL is cleared', async () => {
    renderSso();

    expect(await screen.findByText('Acme Okta')).toBeInTheDocument();
    await userEvent.clear(screen.getByLabelText('Issuer URL'));
    await userEvent.click(screen.getByRole('button', { name: 'Save Provider' }));

    expect(await screen.findByText('Issuer URL is required')).toBeInTheDocument();
    expect(apiClientPatchMock).not.toHaveBeenCalled();
    expect(apiClientPostMock).not.toHaveBeenCalled();
  });

  it('blocks submission and shows an inline error when attribute mapping is not valid JSON', async () => {
    renderSso();

    expect(await screen.findByText('Acme Okta')).toBeInTheDocument();
    const attributeMappingField = screen.getByLabelText('Attribute mapping');
    await userEvent.clear(attributeMappingField);
    await userEvent.type(attributeMappingField, '{{not valid json');
    await userEvent.click(screen.getByRole('button', { name: 'Save Provider' }));

    expect(await screen.findByText('Attribute mapping must be a valid JSON object')).toBeInTheDocument();
    expect(apiClientPatchMock).not.toHaveBeenCalled();
    expect(apiClientPostMock).not.toHaveBeenCalled();
  });
});

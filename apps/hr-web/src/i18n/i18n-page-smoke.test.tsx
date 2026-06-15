import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { I18nProvider } from './i18n-provider';
import { LoginPage } from '@/pages/login';

const loginMock = vi.hoisted(() => vi.fn());

vi.mock('@/hooks/use-auth', () => ({
  useAuth: () => ({
    isAuthenticated: false,
    login: loginMock,
  }),
}));

vi.mock('@/hooks/use-tenant', () => ({
  useTenant: () => ({
    tenants: [{ id: '00000000-0000-0000-0000-000000000001', name: 'Acme Health', config: { currency: 'AED', dateFormat: 'DD/MM/YYYY', timezone: 'Asia/Dubai', features: [] } }],
    isLoading: false,
  }),
}));

vi.mock('@/lib/api-client', () => ({
  apiClient: {
    get: vi.fn().mockResolvedValue({
      data: {
        data: {
          local: { enabled: true },
          oidc: { enabled: false },
          saml: { enabled: false },
          mfa: { required: false },
          session: { accessTokenTtl: '15m', refreshTokenTtl: '7d' },
        },
      },
    }),
  },
}));

function renderLogin() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <I18nProvider>
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <LoginPage />
        </MemoryRouter>
      </QueryClientProvider>
    </I18nProvider>,
  );
}

describe('LoginPage i18n', () => {
  beforeEach(() => {
    loginMock.mockReset();
  });

  it('re-renders user-facing page copy when language changes', async () => {
    renderLogin();

    expect(await screen.findByRole('heading', { name: 'Welcome back' })).toBeInTheDocument();

    await userEvent.selectOptions(screen.getByLabelText('Language'), 'ar');

    expect(await screen.findByRole('heading', { name: 'مرحباً بعودتك' })).toBeInTheDocument();
    expect(screen.getByLabelText('البريد الإلكتروني للعمل')).toBeInTheDocument();
  });
});

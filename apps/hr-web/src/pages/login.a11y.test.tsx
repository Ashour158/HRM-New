import { describe, expect, it, vi } from 'vitest';
import { axe } from 'jest-axe';
import { BrowserRouter } from 'react-router-dom';
import { render, screen } from '@testing-library/react';
import { LoginPage } from './login';

const apiClientMock = vi.hoisted(() => ({
  get: vi.fn(),
}));

vi.mock('@/lib/api-client', () => ({
  apiClient: apiClientMock,
}));

vi.mock('@/hooks/use-auth', () => ({
  useAuth: () => ({
    login: vi.fn(),
    isAuthenticated: false,
  }),
}));

vi.mock('@/hooks/use-tenant', () => ({
  useTenant: () => ({
    tenants: [{ id: 'tenant-1', name: 'Acme Health', config: { currency: 'USD', dateFormat: 'MM/DD/YYYY', timezone: 'UTC', features: [] } }],
    isLoading: false,
  }),
}));

describe('LoginPage accessibility and SSO state', () => {
  it('renders an accessible login form and disables SSO when identity providers are not configured', async () => {
    apiClientMock.get.mockResolvedValue({
      data: {
        success: true,
        data: {
          local: { enabled: true },
          oidc: { enabled: false },
          saml: { enabled: false },
          mfa: { required: false, demoCodeEnabled: false },
          session: { accessTokenTtl: '15m', refreshTokenTtl: '8h' },
        },
      },
    });

    const { container } = render(
      <BrowserRouter>
        <LoginPage />
      </BrowserRouter>,
    );

    expect(screen.getByLabelText(/work email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/organization/i)).toBeInTheDocument();
    expect(await screen.findByText(/single sign-on is not configured/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /single sign-on/i })).toBeDisabled();

    expect(await axe(container)).toHaveNoViolations();
  });
});

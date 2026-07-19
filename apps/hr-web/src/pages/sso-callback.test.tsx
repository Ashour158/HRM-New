import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { render, screen, waitFor } from '@testing-library/react';
import '@/i18n/i18n';
import { SsoCallbackPage } from './sso-callback';
import { useAuthStore } from '@/stores/auth-store';

const apiClientMock = vi.hoisted(() => ({
  get: vi.fn(),
}));

vi.mock('@/lib/api-client', () => ({
  apiClient: apiClientMock,
}));

function renderAtCallbackUrl(search: string) {
  window.history.pushState({}, '', `/auth/sso/callback${search}`);
  return render(
    <MemoryRouter initialEntries={[`/auth/sso/callback${search}`]}>
      <Routes>
        <Route path="/auth/sso/callback" element={<SsoCallbackPage />} />
        <Route path="/employee" element={<div>Employee home</div>} />
        <Route path="/login" element={<div>Login page</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('SsoCallbackPage (HCM-P0-3)', () => {
  beforeEach(() => {
    sessionStorage.clear();
    useAuthStore.setState({ user: null, roles: [], permissions: [], isAuthenticated: false, token: null, refreshToken: null });
    apiClientMock.get.mockReset();
  });

  afterEach(() => {
    window.history.pushState({}, '', '/');
  });

  it('shows an error and never calls the API when the URL has no token', async () => {
    renderAtCallbackUrl('');

    expect(await screen.findByText(/did not return a valid session/i)).toBeInTheDocument();
    expect(apiClientMock.get).not.toHaveBeenCalled();
    expect(window.location.search).toBe('');
  });

  it('strips the token from the URL immediately and hydrates the session on success', async () => {
    apiClientMock.get.mockResolvedValue({
      data: {
        success: true,
        data: {
          id: 'user-1',
          email: 'employee@example.com',
          firstName: 'Ada',
          lastName: 'Lovelace',
          tenantId: 'tenant-1',
          roles: [{ id: 'EMPLOYEE', name: 'EMPLOYEE' }],
          permissions: [{ id: 'SELF_READ', resource: 'SELF', action: 'READ' }],
        },
      },
    });

    renderAtCallbackUrl('?token=real-jwt&refreshToken=real-refresh');

    // The URL is stripped synchronously on mount, before the API call settles.
    expect(window.location.search).toBe('');
    expect(sessionStorage.getItem('auth_token')).toBe('real-jwt');

    expect(await screen.findByText('Employee home')).toBeInTheDocument();
    expect(useAuthStore.getState().isAuthenticated).toBe(true);
    expect(useAuthStore.getState().user?.email).toBe('employee@example.com');
  });

  it('shows an error and clears the session when validating the SSO session fails', async () => {
    apiClientMock.get.mockRejectedValue(new Error('network error'));

    renderAtCallbackUrl('?token=real-jwt&refreshToken=real-refresh');

    expect(await screen.findByText(/could not complete your single sign-on session/i)).toBeInTheDocument();
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    expect(sessionStorage.getItem('auth_token')).toBeNull();
  });

  it('returns to the login page from the error state', async () => {
    apiClientMock.get.mockRejectedValue(new Error('network error'));
    const { default: userEvent } = await import('@testing-library/user-event');
    const user = userEvent.setup();

    renderAtCallbackUrl('?token=real-jwt&refreshToken=real-refresh');

    await screen.findByRole('button', { name: /back to sign in/i });
    await user.click(screen.getByRole('button', { name: /back to sign in/i }));

    await waitFor(() => expect(screen.getByText('Login page')).toBeInTheDocument());
  });
});

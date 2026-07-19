import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AlertCircle, Loader2 } from 'lucide-react';
import type { ApiResponse } from '@hcm/openapi-contracts';
import type { User } from '@/types';
import { apiClient } from '@/lib/api-client';
import { persistAuthSession } from '@/lib/auth-storage';
import { useAuthStore } from '@/stores/auth-store';

/**
 * Lands here after a successful OIDC/SAML round-trip. The backend redirects
 * with `token`/`refreshToken` as query params (see auth.controller.ts
 * webSsoCallbackUrl) -- this page's only job is to move them out of the URL
 * and into session storage as fast as possible, then hydrate the user
 * profile before handing off to the portal.
 */
export function SsoCallbackPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [error, setError] = React.useState('');
  // React StrictMode double-invokes this effect in dev (mount, cleanup,
  // mount again) before any real unmount. `hasRun` makes the non-idempotent
  // setup below (reading + stripping the URL, persisting tokens, firing the
  // request) execute exactly once regardless. `isMounted` is reset to true
  // on every invocation (including the StrictMode replay) and only goes
  // false on a real unmount, so the original in-flight request's callback
  // -- kicked off by the first invocation -- still applies its result.
  const hasRun = React.useRef(false);
  const isMounted = React.useRef(true);

  React.useEffect(() => {
    isMounted.current = true;
    if (hasRun.current) {
      return () => {
        isMounted.current = false;
      };
    }
    hasRun.current = true;

    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    const refreshToken = params.get('refreshToken') ?? undefined;

    // Strip token/refreshToken from the URL before anything else runs, so
    // they don't linger in browser history, server logs, or a Referer header
    // if the next page load happens to send one.
    window.history.replaceState(null, '', window.location.pathname);

    if (!token) {
      setError(t('sso.callbackMissingToken'));
      return () => {
        isMounted.current = false;
      };
    }

    persistAuthSession({ token, refreshToken });

    apiClient
      .get<ApiResponse<User>>('/auth/me')
      .then((response) => {
        if (!isMounted.current) return;
        if (!response.data.success) throw new Error('SSO session validation failed');
        useAuthStore.getState().login(response.data.data, token, refreshToken);
        navigate('/employee', { replace: true });
      })
      .catch(() => {
        if (!isMounted.current) return;
        useAuthStore.getState().logout();
        setError(t('sso.callbackFailed'));
      });

    return () => {
      isMounted.current = false;
    };
    // Runs once against the URL this page was loaded with; token/refreshToken
    // never change after the initial redirect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted">
      <div className="flex w-full max-w-sm flex-col items-center gap-4 rounded-xl border border-border/40 bg-white px-8 py-10 text-center shadow-sm">
        {error ? (
          <>
            <AlertCircle className="h-8 w-8 text-red-600" />
            <p className="text-sm font-semibold text-red-700">{error}</p>
            <button
              type="button"
              className="text-sm font-semibold text-primary underline-offset-4 hover:underline"
              onClick={() => navigate('/login', { replace: true })}
            >
              {t('sso.backToLogin')}
            </button>
          </>
        ) : (
          <>
            <Loader2 className="h-8 w-8 animate-spin text-secondary" />
            <p className="text-sm font-semibold text-foreground">{t('sso.completingSignIn')}</p>
          </>
        )}
      </div>
    </div>
  );
}

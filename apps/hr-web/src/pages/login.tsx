import * as React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import type { ApiResponse, AuthProvidersResponse } from '@hcm/openapi-contracts';
import { useAuth } from '@/hooks/use-auth';
import { useTenant } from '@/hooks/use-tenant';
import { apiClient } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { LanguageSwitcher } from '@/i18n/language-switcher';
import { AlertCircle, ArrowRight, Building2, KeyRound, Loader2, Lock, Mail, ShieldCheck, FlaskConical } from 'lucide-react';
import type { User } from '@/types';

const DEMO_MODE = import.meta.env.DEV && import.meta.env.VITE_DEMO_MODE === 'true';
const DEMO_PASSWORD = 'Password123!';

const DEMO_ACCOUNTS = [
  { label: 'HR Admin', email: 'hr.admin@example.com', description: 'Full admin access — all modules', color: '#8b5cf6', redirect: '/admin' },
  { label: 'Manager', email: 'manager@example.com', description: 'Team management & approvals', color: '#6366f1', redirect: '/manager' },
  { label: 'Employee', email: 'employee@example.com', description: 'Self-service portal', color: '#f59e0b', redirect: '/employee' },
];

function landingPathForUser(user: User | null): string {
  const roles = new Set((user?.roles ?? []).map((role) => role.name));
  if (roles.has('HR_ADMIN') || roles.has('APP_ADMIN') || roles.has('SUPER_ADMIN')) return '/admin';
  if (roles.has('MANAGER')) return '/manager';
  return '/employee';
}

function createLoginSchema(t: (key: string) => string) {
  return z.object({
    email: z.string().email(t('login.validation.invalidEmail')),
    password: z.string().min(1, t('login.validation.passwordRequired')),
    tenantId: z.string().uuid(t('login.validation.invalidTenant')).optional().or(z.literal('')),
  });
}

const authProvidersSchema = z.object({
  local: z.object({ enabled: z.boolean() }),
  providers: z.array(z.object({
    id: z.string(),
    protocol: z.enum(['OIDC', 'SAML']),
    displayName: z.string(),
    startUrl: z.string(),
  })).default([]),
  oidc: z.object({
    enabled: z.boolean(),
    issuerUrl: z.string().optional(),
    clientId: z.string().optional(),
    redirectUri: z.string().optional(),
  }).optional(),
  saml: z.object({
    enabled: z.boolean(),
    metadataUrl: z.string().optional(),
    entityId: z.string().optional(),
  }).optional(),
  mfa: z.object({
    required: z.boolean(),
  }).optional(),
  session: z.object({
    accessTokenTtl: z.string(),
    refreshTokenTtl: z.string(),
  }).optional(),
});

type SsoDiscoveryProvider = NonNullable<AuthProvidersResponse['providers']>[number];

interface LoginFormData {
  email: string;
  password: string;
  tenantId?: string;
}

export function LoginPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { login, isAuthenticated, user } = useAuth();
  const { tenants, isLoading: tenantsLoading } = useTenant();
  const loginSchema = React.useMemo(() => createLoginSchema(t), [t]);

  const [formData, setFormData] = React.useState<LoginFormData>({ email: '', password: '', tenantId: '' });
  const [errors, setErrors] = React.useState<Partial<Record<keyof LoginFormData, string>>>({});
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [loginError, setLoginError] = React.useState('');
  const [demoLoading, setDemoLoading] = React.useState<string | null>(null);
  const [authProviders, setAuthProviders] = React.useState<AuthProvidersResponse | null>(null);
  const [providersLoading, setProvidersLoading] = React.useState(true);
  const [providerError, setProviderError] = React.useState('');
  const selectedTenantId = formData.tenantId || tenants[0]?.id || '';

  React.useEffect(() => {
    if (isAuthenticated) {
      navigate(landingPathForUser(user));
    }
  }, [isAuthenticated, navigate, user]);

  React.useEffect(() => {
    if (tenants.length === 1 && !formData.tenantId) {
      setFormData((current) => ({ ...current, tenantId: tenants[0]?.id ?? '' }));
    }
  }, [formData.tenantId, tenants]);

  React.useEffect(() => {
    let cancelled = false;

    if (!selectedTenantId) {
      setProvidersLoading(false);
      setAuthProviders(null);
      return () => {
        cancelled = true;
      };
    }

    setProvidersLoading(true);
    apiClient
      .get<ApiResponse<AuthProvidersResponse>>(`/auth/providers?tenantId=${encodeURIComponent(selectedTenantId)}`)
      .then((response) => {
        if (cancelled) return;
        const parsed = authProvidersSchema.safeParse(response.data.data);
        if (!parsed.success) {
          setProviderError(t('login.ssoVerifyError'));
          setAuthProviders(null);
          return;
        }
        setProviderError('');
        setAuthProviders(parsed.data);
      })
      .catch(() => {
        if (cancelled) return;
        setProviderError(t('login.ssoVerifyError'));
        setAuthProviders(null);
      })
      .finally(() => {
        if (!cancelled) setProvidersLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedTenantId, t]);

  const ssoProviders = authProviders?.providers ?? [];
  const ssoStatusText = providersLoading
    ? t('login.ssoChecking')
    : ssoProviders.length > 0
      ? t('login.ssoAvailable', { count: ssoProviders.length })
      : providerError || t('login.ssoNotConfigured');

  const validate = (): boolean => {
    try {
      loginSchema.parse(formData);
      setErrors({});
      return true;
    } catch (error) {
      if (error instanceof z.ZodError) {
        const fieldErrors: Partial<Record<keyof LoginFormData, string>> = {};
        error.errors.forEach((err) => {
          const path = err.path[0] as keyof LoginFormData;
          fieldErrors[path] = err.message;
        });
        setErrors(fieldErrors);
      }
      return false;
    }
  };

  const handleSsoLogin = (provider: SsoDiscoveryProvider) => {
    const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api/v1';
    const origin = new URL(baseUrl).origin;
    const target = provider.startUrl.startsWith('http')
      ? provider.startUrl
      : `${origin}${provider.startUrl.startsWith('/') ? provider.startUrl : `/${provider.startUrl}`}`;
    window.location.assign(target);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    if (!validate()) return;
    setIsSubmitting(true);
    const result = await login(formData.email, formData.password, formData.tenantId);
    setIsSubmitting(false);
    if (!result.success) {
      setLoginError(result.error || t('login.invalidCredentials'));
    }
  };

  const handleDemoLogin = async (account: typeof DEMO_ACCOUNTS[number]) => {
    setDemoLoading(account.email);
    setLoginError('');
    const result = await login(account.email, DEMO_PASSWORD);
    setDemoLoading(null);
    if (result.success) {
      navigate(account.redirect);
    } else {
      setLoginError(t('login.demoLoginFailed'));
    }
  };

  return (
    <div className="min-h-screen fusion-bg text-foreground">
      <div className="mx-auto flex min-h-screen w-full max-w-[1440px]">
        <section className="relative hidden flex-1 overflow-hidden bg-primary lg:flex">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(165,180,252,0.38),transparent_30%),radial-gradient(circle_at_80%_70%,rgba(45,212,191,0.20),transparent_32%),linear-gradient(135deg,#0f172a_0%,#4f46e5_52%,#7c3aed_100%)]" />
          <div className="absolute inset-x-16 top-20 grid gap-4">
            <div className="h-28 rounded-xl border border-white/10 bg-white/12 p-5 shadow-[0_24px_70px_rgba(0,0,0,0.22)] backdrop-blur">
              <div className="mb-4 h-3 w-28 rounded-full bg-white/60" />
              <div className="grid grid-cols-3 gap-3">
                <div className="h-10 rounded-lg bg-primary/80" />
                <div className="h-10 rounded-lg bg-white/45" />
                <div className="h-10 rounded-lg bg-warning/85" />
              </div>
            </div>
            <div className="ml-16 grid h-48 grid-cols-[1.1fr_0.9fr] gap-4 rounded-xl border border-white/10 bg-white/10 p-5 shadow-[0_24px_70px_rgba(0,0,0,0.2)] backdrop-blur">
              <div className="space-y-3">
                <div className="h-3 w-24 rounded-full bg-white/70" />
                <div className="h-20 rounded-lg bg-white/22" />
                <div className="h-3 w-3/4 rounded-full bg-white/35" />
                <div className="h-3 w-1/2 rounded-full bg-white/30" />
              </div>
              <div className="grid place-items-center rounded-xl bg-primary/18">
                <ShieldCheck className="h-16 w-16 text-primary" />
              </div>
            </div>
          </div>
          <div className="relative z-10 mt-auto w-full p-10 xl:p-12">
            <div className="max-w-xl text-white">
              <div className="mb-5 inline-flex items-center gap-2 rounded-full bg-white/12 px-3 py-1 font-mono text-xs font-semibold uppercase tracking-wider text-accent backdrop-blur">
                <ShieldCheck className="h-4 w-4 text-primary" />
                {t('login.heroPill')}
              </div>
              <h2 className="font-headline text-4xl font-bold leading-tight">{t('login.heroTitle')}</h2>
              <p className="mt-4 max-w-md text-lg leading-7 text-accent/90">
                {t('login.heroSubtitle')}
              </p>
            </div>
          </div>
        </section>

        <main className="fusion-glass flex flex-1 items-center justify-center border-l border-border/40 px-5 py-10 lg:px-20 xl:px-[120px]">
          <div className="w-full max-w-[440px]">
            <div className="mb-6 flex justify-end">
              <LanguageSwitcher />
            </div>
            <div className="mb-8 flex items-center gap-3">
              <div className="grid h-11 w-11 place-items-center rounded-lg bg-secondary text-white">
                <Building2 className="h-6 w-6" />
              </div>
              <div>
                <h1 className="fusion-gradient-text font-headline text-2xl font-bold tracking-tight">{t('login.brandName')}</h1>
                <p className="text-sm text-muted-foreground">{t('login.enterprisePortal')}</p>
              </div>
            </div>

            <div className="mb-6">
              <h2 className="font-headline text-4xl font-semibold text-foreground">{t('login.welcomeBack')}</h2>
              <p className="mt-2 text-base leading-6 text-muted-foreground">
                {t('login.subtitle')}
              </p>
            </div>

            {DEMO_MODE && (
              <div className="mb-6 rounded-xl border border-secondary/30 bg-indigo-50/70 p-4">
                <div className="mb-3 flex items-center gap-2">
                  <FlaskConical className="h-4 w-4 text-secondary" />
                  <span className="font-mono text-xs font-semibold uppercase tracking-wider text-primary">{t('login.demoMode')}</span>
                </div>
                <div className="grid gap-2">
                  {DEMO_ACCOUNTS.map((account) => (
                    <button
                      key={account.email}
                      type="button"
                      disabled={demoLoading !== null}
                      onClick={() => handleDemoLogin(account)}
                      className="flex w-full items-center justify-between rounded-lg border border-border/40 bg-white px-3 py-2.5 text-left transition-all hover:border-secondary/50 hover:shadow-sm disabled:opacity-60"
                    >
                      <div className="flex items-center gap-3">
                        <div className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-white text-xs font-bold" style={{ backgroundColor: account.color }}>
                          {account.label[0]}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-foreground">{account.label}</p>
                          <p className="text-xs text-muted-foreground">{account.description}</p>
                        </div>
                      </div>
                      {demoLoading === account.email ? (
                        <Loader2 className="h-4 w-4 animate-spin text-secondary" />
                      ) : (
                        <ArrowRight className="h-4 w-4 text-muted-foreground" />
                      )}
                    </button>
                  ))}
                </div>
                <p className="mt-2.5 text-center text-xs text-muted-foreground">
                  {t('login.demoPassword')} <span className="font-mono font-semibold text-foreground">{DEMO_PASSWORD}</span>
                </p>
              </div>
            )}

            <form className="space-y-4" onSubmit={handleSubmit}>
              {loginError && (
                <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  {loginError}
                </div>
              )}

              <div className="space-y-2">
                <Label className="font-mono text-xs font-semibold uppercase tracking-wider text-muted-foreground" htmlFor="email">
                  {t('login.workEmail')}
                </Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    placeholder={t('login.workEmailPlaceholder')}
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    aria-invalid={!!errors.email}
                    aria-describedby={errors.email ? 'email-error' : undefined}
                    className="pl-10"
                  />
                </div>
                {errors.email && (
                  <p id="email-error" className="text-sm text-red-600">{errors.email}</p>
                )}
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between gap-4">
                  <Label className="font-mono text-xs font-semibold uppercase tracking-wider text-muted-foreground" htmlFor="password">
                    {t('login.password')}
                  </Label>
                  <Link className="text-sm font-semibold text-primary underline-offset-4 hover:underline" to="/forgot-password">
                    {t('login.forgotPassword')}
                  </Link>
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="password"
                    type="password"
                    placeholder={t('login.passwordPlaceholder')}
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    aria-invalid={!!errors.password}
                    aria-describedby={errors.password ? 'password-error' : undefined}
                    className="pl-10"
                  />
                </div>
                {errors.password && (
                  <p id="password-error" className="text-sm text-red-600">{errors.password}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label className="font-mono text-xs font-semibold uppercase tracking-wider text-muted-foreground" htmlFor="tenant">
                  {t('login.organization')}
                </Label>
                {tenants.length > 1 ? (
                  <Select
                    value={formData.tenantId}
                    onValueChange={(value) => setFormData({ ...formData, tenantId: value })}
                    disabled={tenantsLoading}
                  >
                    <SelectTrigger id="tenant">
                      <SelectValue placeholder={t('login.selectOrganization')} />
                    </SelectTrigger>
                    <SelectContent>
                      {tenants.map((tenant) => (
                        <SelectItem key={tenant.id} value={tenant.id}>
                          {tenant.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    id="tenant"
                    value={tenants[0]?.name || t('login.defaultTenant')}
                    disabled
                    readOnly
                    aria-describedby="tenant-help"
                  />
                )}
                <p id="tenant-help" className="text-xs text-muted-foreground">
                  {t('login.tenantHelp')}
                </p>
              </div>

              <div className="space-y-3 pt-1">
                <Button type="submit" className="h-11 w-full gap-2" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      {t('login.signingIn')}
                    </>
                  ) : (
                    <>
                      {t('login.signIn')}
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </Button>

                <div className="flex items-center gap-4 py-2">
                  <div className="h-px flex-1 bg-border/50" />
                  <span className="font-mono text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t('common.or')}</span>
                  <div className="h-px flex-1 bg-border/50" />
                </div>

                {ssoProviders.length > 0 ? (
                  <div className="grid gap-2">
                    {ssoProviders.map((provider) => (
                      <Button
                        key={provider.id}
                        type="button"
                        variant="outline"
                        className="h-11 w-full gap-2"
                        disabled={providersLoading}
                        aria-describedby="sso-status"
                        onClick={() => handleSsoLogin(provider)}
                      >
                        <KeyRound className="h-4 w-4" />
                        {t('login.ssoButtonWithProvider', { provider: provider.displayName })}
                      </Button>
                    ))}
                  </div>
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    className="h-11 w-full gap-2"
                    disabled
                    aria-describedby="sso-status"
                  >
                    <KeyRound className="h-4 w-4" />
                    {t('login.ssoButton')}
                  </Button>
                )}
                <p id="sso-status" className="text-center text-xs text-muted-foreground">
                  {ssoStatusText}
                </p>
              </div>
            </form>

            <div className="mt-8 border-t border-border/40 pt-6 text-center text-sm leading-6 text-muted-foreground">
              {t('login.needAccess')}
              <br />
              {t('login.contactYourAdministrator')}
            </div>

            <footer className="mt-8 border-t border-border/60 pt-5">
              <div className="flex flex-col items-center gap-3 text-center">
                <div className="flex items-center gap-2">
                  <div className="grid h-7 w-7 place-items-center rounded-md bg-gradient-to-br from-primary to-secondary text-white">
                    <Building2 className="h-4 w-4" />
                  </div>
                  <span className="font-headline text-sm font-bold text-foreground">{t('login.brandName')}</span>
                </div>
                <nav className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 text-xs font-medium text-muted-foreground">
                  <a className="transition-colors hover:text-primary" href="#">{t('common.privacyPolicy')}</a>
                  <a className="transition-colors hover:text-primary" href="#">{t('common.termsOfService')}</a>
                  <a className="transition-colors hover:text-primary" href="#">{t('common.cookies')}</a>
                  <a className="transition-colors hover:text-primary" href="#">{t('common.security')}</a>
                  <a className="transition-colors hover:text-primary" href="#">{t('common.contact')}</a>
                </nav>
                <p className="text-xs text-muted-foreground">
                  {t('common.copyright', { year: new Date().getFullYear() })}
                </p>
              </div>
            </footer>
          </div>
        </main>
      </div>
    </div>
  );
}

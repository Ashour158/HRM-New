import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { useAuth } from '@/hooks/use-auth';
import { useTenant } from '@/hooks/use-tenant';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertCircle, ArrowRight, Building2, KeyRound, Loader2, Lock, Mail, ShieldCheck, FlaskConical } from 'lucide-react';

const DEMO_MODE = import.meta.env.VITE_DEMO_MODE === 'true';
const DEMO_PASSWORD = 'Password123!';

const DEMO_ACCOUNTS = [
  { label: 'HR Admin', email: 'hr.admin@example.com', description: 'Full admin access — all modules', color: '#10b981', redirect: '/admin' },
  { label: 'Manager', email: 'manager@example.com', description: 'Team management & approvals', color: '#6366f1', redirect: '/manager' },
  { label: 'Employee', email: 'employee@example.com', description: 'Self-service portal', color: '#f59e0b', redirect: '/employee' },
];

const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
  tenantId: z.string().optional(),
});

type LoginFormData = z.infer<typeof loginSchema>;

export function LoginPage() {
  const navigate = useNavigate();
  const { login, isAuthenticated } = useAuth();
  const { tenants, isLoading: tenantsLoading } = useTenant();

  const [formData, setFormData] = React.useState<LoginFormData>({ email: '', password: '', tenantId: '' });
  const [errors, setErrors] = React.useState<Partial<Record<keyof LoginFormData, string>>>({});
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [loginError, setLoginError] = React.useState('');
  const [demoLoading, setDemoLoading] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (isAuthenticated) {
      navigate('/employee');
    }
  }, [isAuthenticated, navigate]);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    if (!validate()) return;
    setIsSubmitting(true);
    const result = await login(formData.email, formData.password, formData.tenantId);
    setIsSubmitting(false);
    if (!result.success) {
      setLoginError(result.error || 'Invalid email or password');
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
      setLoginError('Demo login failed. Please try again.');
    }
  };

  return (
    <div className="min-h-screen bg-[#f8f9ff] text-[#0b1c30]">
      <div className="mx-auto flex min-h-screen w-full max-w-[1440px]">
        <section className="relative hidden flex-1 overflow-hidden bg-[#213145] lg:flex">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(111,251,190,0.32),transparent_28%),linear-gradient(135deg,#0b1c30_0%,#006c49_54%,#213145_100%)]" />
          <div className="absolute inset-x-16 top-20 grid gap-4">
            <div className="h-28 rounded-xl border border-white/10 bg-white/12 p-5 shadow-[0_24px_70px_rgba(0,0,0,0.22)] backdrop-blur">
              <div className="mb-4 h-3 w-28 rounded-full bg-white/60" />
              <div className="grid grid-cols-3 gap-3">
                <div className="h-10 rounded-lg bg-[#6ffbbe]/80" />
                <div className="h-10 rounded-lg bg-white/45" />
                <div className="h-10 rounded-lg bg-[#ffb95f]/85" />
              </div>
            </div>
            <div className="ml-16 grid h-48 grid-cols-[1.1fr_0.9fr] gap-4 rounded-xl border border-white/10 bg-white/10 p-5 shadow-[0_24px_70px_rgba(0,0,0,0.2)] backdrop-blur">
              <div className="space-y-3">
                <div className="h-3 w-24 rounded-full bg-white/70" />
                <div className="h-20 rounded-lg bg-white/22" />
                <div className="h-3 w-3/4 rounded-full bg-white/35" />
                <div className="h-3 w-1/2 rounded-full bg-white/30" />
              </div>
              <div className="grid place-items-center rounded-xl bg-[#6ffbbe]/18">
                <ShieldCheck className="h-16 w-16 text-[#6ffbbe]" />
              </div>
            </div>
          </div>
          <div className="relative z-10 mt-auto w-full p-10 xl:p-12">
            <div className="max-w-xl text-white">
              <div className="mb-5 inline-flex items-center gap-2 rounded-full bg-white/12 px-3 py-1 font-mono text-xs font-semibold uppercase tracking-wider text-[#eaf1ff] backdrop-blur">
                <ShieldCheck className="h-4 w-4 text-[#6ffbbe]" />
                Secure enterprise workspace
              </div>
              <h2 className="font-headline text-4xl font-bold leading-tight">Empowering the modern enterprise</h2>
              <p className="mt-4 max-w-md text-lg leading-7 text-[#eaf1ff]/90">
                A unified workspace for HR administration, employee services, payroll, performance, and compliance.
              </p>
            </div>
          </div>
        </section>

        <main className="flex flex-1 items-center justify-center border-l border-[#bbcabf]/40 bg-white px-5 py-10 shadow-[0_4px_20px_rgba(0,0,0,0.05)] lg:px-20 xl:px-[120px]">
          <div className="w-full max-w-[440px]">
            <div className="mb-8 flex items-center gap-3">
              <div className="grid h-11 w-11 place-items-center rounded-lg bg-[#10b981] text-white">
                <Building2 className="h-6 w-6" />
              </div>
              <div>
                <h1 className="font-headline text-2xl font-bold tracking-tight text-[#006c49]">HRM Nexus</h1>
                <p className="text-sm text-[#3c4a42]">Enterprise HR portal</p>
              </div>
            </div>

            <div className="mb-6">
              <h2 className="font-headline text-4xl font-semibold text-[#0b1c30]">Welcome back</h2>
              <p className="mt-2 text-base leading-6 text-[#3c4a42]">
                Please enter your enterprise credentials to access the portal.
              </p>
            </div>

            {DEMO_MODE && (
              <div className="mb-6 rounded-xl border border-[#10b981]/30 bg-[#f0fdf8] p-4">
                <div className="mb-3 flex items-center gap-2">
                  <FlaskConical className="h-4 w-4 text-[#10b981]" />
                  <span className="font-mono text-xs font-semibold uppercase tracking-wider text-[#006c49]">Demo Mode — Quick Access</span>
                </div>
                <div className="grid gap-2">
                  {DEMO_ACCOUNTS.map((account) => (
                    <button
                      key={account.email}
                      type="button"
                      disabled={demoLoading !== null}
                      onClick={() => handleDemoLogin(account)}
                      className="flex w-full items-center justify-between rounded-lg border border-[#bbcabf]/40 bg-white px-3 py-2.5 text-left transition-all hover:border-[#10b981]/50 hover:shadow-sm disabled:opacity-60"
                    >
                      <div className="flex items-center gap-3">
                        <div className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-white text-xs font-bold" style={{ backgroundColor: account.color }}>
                          {account.label[0]}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-[#0b1c30]">{account.label}</p>
                          <p className="text-xs text-[#6c7a71]">{account.description}</p>
                        </div>
                      </div>
                      {demoLoading === account.email ? (
                        <Loader2 className="h-4 w-4 animate-spin text-[#10b981]" />
                      ) : (
                        <ArrowRight className="h-4 w-4 text-[#6c7a71]" />
                      )}
                    </button>
                  ))}
                </div>
                <p className="mt-2.5 text-center text-xs text-[#6c7a71]">
                  Password for all accounts: <span className="font-mono font-semibold text-[#0b1c30]">{DEMO_PASSWORD}</span>
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
                <Label className="font-mono text-xs font-semibold uppercase tracking-wider text-[#3c4a42]" htmlFor="email">
                  Work Email
                </Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-[#6c7a71]" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="name@company.com"
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
                  <Label className="font-mono text-xs font-semibold uppercase tracking-wider text-[#3c4a42]" htmlFor="password">
                    Password
                  </Label>
                  <a className="text-sm font-semibold text-[#006c49] underline-offset-4 hover:underline" href="#">
                    Forgot password?
                  </a>
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-[#6c7a71]" />
                  <Input
                    id="password"
                    type="password"
                    placeholder="Enter your password"
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

              {tenants.length > 1 && (
                <div className="space-y-2">
                  <Label className="font-mono text-xs font-semibold uppercase tracking-wider text-[#3c4a42]" htmlFor="tenant">
                    Organization
                  </Label>
                  <Select
                    value={formData.tenantId}
                    onValueChange={(value) => setFormData({ ...formData, tenantId: value })}
                    disabled={tenantsLoading}
                  >
                    <SelectTrigger id="tenant">
                      <SelectValue placeholder="Select organization" />
                    </SelectTrigger>
                    <SelectContent>
                      {tenants.map((tenant) => (
                        <SelectItem key={tenant.id} value={tenant.id}>
                          {tenant.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <label className="flex cursor-pointer items-center gap-2 py-2 text-sm text-[#3c4a42]">
                <input className="h-4 w-4 rounded border-[#bbcabf] text-[#006c49] focus:ring-[#006c49]/20" type="checkbox" />
                Remember me
              </label>

              <div className="space-y-3 pt-1">
                <Button type="submit" className="h-11 w-full gap-2" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Signing in...
                    </>
                  ) : (
                    <>
                      Sign In
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </Button>

                <div className="flex items-center gap-4 py-2">
                  <div className="h-px flex-1 bg-[#bbcabf]/50" />
                  <span className="font-mono text-xs font-semibold uppercase tracking-wider text-[#6c7a71]">OR</span>
                  <div className="h-px flex-1 bg-[#bbcabf]/50" />
                </div>

                <Button type="button" variant="outline" className="h-11 w-full gap-2">
                  <KeyRound className="h-4 w-4" />
                  Single Sign-On (SSO)
                </Button>
              </div>
            </form>

            <div className="mt-8 border-t border-[#bbcabf]/40 pt-6 text-center text-sm leading-6 text-[#3c4a42]">
              Need access or technical support?
              <br />
              <a className="font-semibold text-[#006c49] underline-offset-4 hover:underline" href="#">
                Contact IT Helpdesk
              </a>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

import * as React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { ArrowLeft, Building2, Loader2, UserPlus } from 'lucide-react';
import { registerAuthUser } from '@/lib/api-client';
import { useTenant } from '@/hooks/use-tenant';
import { useAuthStore } from '@/stores/auth-store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const registerSchema = z.object({
  tenantId: z.string().uuid('Choose a valid organization'),
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  email: z.string().email('Enter a valid work email'),
  password: z.string()
    .min(12, 'Password must be at least 12 characters')
    .regex(/[a-z]/, 'Add a lowercase letter')
    .regex(/[A-Z]/, 'Add an uppercase letter')
    .regex(/\d/, 'Add a number')
    .regex(/[^A-Za-z0-9]/, 'Add a symbol'),
});

type RegisterForm = z.infer<typeof registerSchema>;

export function RegisterPage() {
  const navigate = useNavigate();
  const login = useAuthStore((state) => state.login);
  const { tenants, isLoading: tenantsLoading } = useTenant();
  const [form, setForm] = React.useState<RegisterForm>({
    tenantId: '',
    firstName: '',
    lastName: '',
    email: '',
    password: '',
  });
  const [errors, setErrors] = React.useState<Partial<Record<keyof RegisterForm, string>>>({});
  const [message, setMessage] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);

  React.useEffect(() => {
    if (tenants.length === 1 && !form.tenantId) {
      setForm((current) => ({ ...current, tenantId: tenants[0]?.id ?? '' }));
    }
  }, [form.tenantId, tenants]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setMessage('');
    const parsed = registerSchema.safeParse(form);
    if (!parsed.success) {
      const nextErrors: Partial<Record<keyof RegisterForm, string>> = {};
      parsed.error.errors.forEach((error) => {
        nextErrors[error.path[0] as keyof RegisterForm] = error.message;
      });
      setErrors(nextErrors);
      return;
    }

    setErrors({});
    setSubmitting(true);
    try {
      const credentials = await registerAuthUser(parsed.data);
      login(credentials.user, credentials.token, credentials.refreshToken);
      navigate('/employee');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Registration could not be completed.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen fusion-bg px-5 py-10 text-foreground">
      <div className="mx-auto flex min-h-[calc(100vh-80px)] w-full max-w-[960px] items-center justify-center">
        <section className="w-full max-w-[520px] rounded-xl border border-border/70 bg-white p-8 shadow-[0_24px_70px_rgba(15,23,42,0.08)]">
          <Link className="mb-7 inline-flex items-center gap-2 text-sm font-semibold text-primary" to="/login">
            <ArrowLeft className="h-4 w-4" />
            Back to sign in
          </Link>
          <div className="mb-7 flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-lg bg-secondary text-white">
              <UserPlus className="h-6 w-6" />
            </div>
            <div>
              <h1 className="font-headline text-3xl font-semibold">Create your account</h1>
              <p className="text-sm text-muted-foreground">Use your organization and work email to start self-service.</p>
            </div>
          </div>

          {message && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{message}</div>
          )}

          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <Label htmlFor="tenant">Organization</Label>
              {tenants.length > 1 ? (
                <Select value={form.tenantId} onValueChange={(tenantId) => setForm({ ...form, tenantId })} disabled={tenantsLoading}>
                  <SelectTrigger id="tenant"><SelectValue placeholder="Select organization" /></SelectTrigger>
                  <SelectContent>
                    {tenants.map((tenant) => <SelectItem key={tenant.id} value={tenant.id}>{tenant.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              ) : (
                <div className="relative">
                  <Building2 className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input id="tenant" value={tenants[0]?.name || 'Default Tenant'} disabled readOnly className="pl-9" />
                </div>
              )}
              {errors.tenantId && <p className="text-sm text-red-600">{errors.tenantId}</p>}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="First name" value={form.firstName} error={errors.firstName} onChange={(firstName) => setForm({ ...form, firstName })} />
              <Field label="Last name" value={form.lastName} error={errors.lastName} onChange={(lastName) => setForm({ ...form, lastName })} />
            </div>
            <Field label="Work email" type="email" value={form.email} error={errors.email} onChange={(email) => setForm({ ...form, email })} />
            <Field label="Password" type="password" value={form.password} error={errors.password} onChange={(password) => setForm({ ...form, password })} />

            <Button type="submit" className="h-11 w-full gap-2" disabled={submitting}>
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
              Create account
            </Button>
          </form>
        </section>
      </div>
    </main>
  );
}

function Field({
  label,
  type = 'text',
  value,
  error,
  onChange,
}: {
  label: string;
  type?: string;
  value: string;
  error?: string;
  onChange: (value: string) => void;
}) {
  const id = label.toLowerCase().replace(/\s+/g, '-');
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} type={type} value={value} onChange={(event) => onChange(event.target.value)} aria-invalid={!!error} />
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}

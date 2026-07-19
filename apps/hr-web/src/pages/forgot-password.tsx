import * as React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { ArrowLeft, KeyRound } from 'lucide-react';
import { confirmPasswordReset, requestPasswordReset } from '@/lib/api-client';
import { useTenant } from '@/hooks/use-tenant';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Spinner } from '@/components/ui/loading-state';

const requestSchema = z.object({
  tenantId: z.string().uuid('Choose a valid organization'),
  email: z.string().email('Enter a valid work email'),
});

const confirmSchema = z.object({
  token: z.string().min(16, 'Reset token is required'),
  password: z.string()
    .min(12, 'Password must be at least 12 characters')
    .regex(/[a-z]/, 'Add a lowercase letter')
    .regex(/[A-Z]/, 'Add an uppercase letter')
    .regex(/\d/, 'Add a number')
    .regex(/[^A-Za-z0-9]/, 'Add a symbol'),
});

type RequestForm = z.infer<typeof requestSchema>;
type ConfirmForm = z.infer<typeof confirmSchema>;

export function ForgotPasswordPage() {
  const navigate = useNavigate();
  const { tenants, isLoading: tenantsLoading } = useTenant();
  const [requestForm, setRequestForm] = React.useState<RequestForm>({ tenantId: '', email: '' });
  const [confirmForm, setConfirmForm] = React.useState<ConfirmForm>({ token: '', password: '' });
  const [requestErrors, setRequestErrors] = React.useState<Partial<Record<keyof RequestForm, string>>>({});
  const [confirmErrors, setConfirmErrors] = React.useState<Partial<Record<keyof ConfirmForm, string>>>({});
  const [step, setStep] = React.useState<'request' | 'confirm'>('request');
  const [message, setMessage] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);

  React.useEffect(() => {
    if (tenants.length === 1 && !requestForm.tenantId) {
      setRequestForm((current) => ({ ...current, tenantId: tenants[0]?.id ?? '' }));
    }
  }, [requestForm.tenantId, tenants]);

  async function submitRequest(event: React.FormEvent) {
    event.preventDefault();
    setMessage('');
    const parsed = requestSchema.safeParse(requestForm);
    if (!parsed.success) {
      const errors: Partial<Record<keyof RequestForm, string>> = {};
      parsed.error.errors.forEach((error) => {
        errors[error.path[0] as keyof RequestForm] = error.message;
      });
      setRequestErrors(errors);
      return;
    }
    setRequestErrors({});
    setSubmitting(true);
    try {
      await requestPasswordReset(parsed.data);
      // The reset token is delivered strictly out-of-band (email). Never bootstrap it
      // into the confirm form from the response — doing so enables account takeover.
      setStep('confirm');
      setMessage('If the account exists, a reset message has been sent.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Password reset could not be started.');
    } finally {
      setSubmitting(false);
    }
  }

  async function submitConfirm(event: React.FormEvent) {
    event.preventDefault();
    setMessage('');
    const parsed = confirmSchema.safeParse(confirmForm);
    if (!parsed.success) {
      const errors: Partial<Record<keyof ConfirmForm, string>> = {};
      parsed.error.errors.forEach((error) => {
        errors[error.path[0] as keyof ConfirmForm] = error.message;
      });
      setConfirmErrors(errors);
      return;
    }
    setConfirmErrors({});
    setSubmitting(true);
    try {
      await confirmPasswordReset(parsed.data);
      navigate('/login');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Password reset could not be completed.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen fusion-bg px-5 py-10 text-foreground">
      <div className="mx-auto flex min-h-[calc(100vh-80px)] w-full max-w-[920px] items-center justify-center">
        <section className="w-full max-w-[500px] rounded-xl border border-border/70 bg-white p-8 shadow-[0_24px_70px_rgba(15,23,42,0.08)]">
          <Link className="mb-7 inline-flex items-center gap-2 text-sm font-semibold text-primary" to="/login">
            <ArrowLeft className="h-4 w-4" />
            Back to sign in
          </Link>
          <div className="mb-7 flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-lg bg-primary text-white">
              <KeyRound className="h-6 w-6" />
            </div>
            <div>
              <h1 className="font-headline text-3xl font-semibold">Reset password</h1>
              <p className="text-sm text-muted-foreground">Request a reset message, then enter the token and new password.</p>
            </div>
          </div>

          {message && <div className="mb-4 rounded-lg border border-border bg-muted p-3 text-sm text-muted-foreground">{message}</div>}

          {step === 'request' ? (
            <form className="space-y-4" onSubmit={submitRequest}>
              <div className="space-y-2">
                <Label htmlFor="tenant">Organization</Label>
                {tenants.length > 1 ? (
                  <Select value={requestForm.tenantId} onValueChange={(tenantId) => setRequestForm({ ...requestForm, tenantId })} disabled={tenantsLoading}>
                    <SelectTrigger id="tenant"><SelectValue placeholder="Select organization" /></SelectTrigger>
                    <SelectContent>
                      {tenants.map((tenant) => <SelectItem key={tenant.id} value={tenant.id}>{tenant.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input id="tenant" value={tenants[0]?.name || 'Default Tenant'} disabled readOnly />
                )}
                {requestErrors.tenantId && <p className="text-sm text-red-600">{requestErrors.tenantId}</p>}
              </div>
              <Field label="Work email" type="email" value={requestForm.email} error={requestErrors.email} onChange={(email) => setRequestForm({ ...requestForm, email })} />
              <Button type="submit" className="h-11 w-full gap-2" disabled={submitting}>
                {submitting ? <Spinner /> : <KeyRound className="h-4 w-4" />}
                Send reset message
              </Button>
            </form>
          ) : (
            <form className="space-y-4" onSubmit={submitConfirm}>
              <Field label="Reset token" value={confirmForm.token} error={confirmErrors.token} onChange={(token) => setConfirmForm({ ...confirmForm, token })} />
              <Field label="New password" type="password" value={confirmForm.password} error={confirmErrors.password} onChange={(password) => setConfirmForm({ ...confirmForm, password })} />
              <Button type="submit" className="h-11 w-full gap-2" disabled={submitting}>
                {submitting ? <Spinner /> : <KeyRound className="h-4 w-4" />}
                Set new password
              </Button>
            </form>
          )}
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

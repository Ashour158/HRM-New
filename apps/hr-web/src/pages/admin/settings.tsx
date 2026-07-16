import * as React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Plus, Save, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useApiMutation, useApiQuery } from '@/hooks/use-api';
import { ErrorState } from '@/components/common/error-state';
import { useUIStore } from '@/stores/ui-store';
import { DEFAULT_HCM_SETUP } from '@/lib/hcm-setup-defaults';
import { isCustomFieldRuleKey } from '@/lib/custom-fields';
import type {
  CityOption,
  DocumentRequirement,
  FieldRule,
  HcmSetupConfig,
  LeavePolicy,
  SetupOption,
  WorkLocationOption,
} from '@/types';

function cloneSetup(setup: HcmSetupConfig): HcmSetupConfig {
  return JSON.parse(JSON.stringify(setup)) as HcmSetupConfig;
}

function flagEmoji(countryCode: string) {
  if (!/^[A-Z]{2}$/.test(countryCode)) return countryCode;
  return String.fromCodePoint(...countryCode.split('').map((char) => char.charCodeAt(0) + 127397));
}

function emptyOption(prefix: string): SetupOption {
  const suffix = Date.now().toString().slice(-5);
  return { code: `${prefix}_${suffix}`, label: '', active: true };
}

function splitCsv(value: string): string[] {
  return value.split(',').map((item) => item.trim()).filter(Boolean);
}

function OptionRows({
  title,
  items,
  onChange,
  onAdd,
}: {
  title: string;
  items: SetupOption[];
  onChange: (items: SetupOption[]) => void;
  onAdd: () => void;
}) {
  return (
    <section className="fusion-glass space-y-4 rounded-[2rem] p-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h3 className="fusion-gradient-text text-base font-semibold">{title}</h3>
          <p className="text-sm text-muted-foreground">{items.filter((item) => item.active).length} active values</p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={onAdd}>
          <Plus className="mr-2 h-4 w-4" />
          Add
        </Button>
      </div>
      <div className="divide-y border-y">
        {items.map((item, index) => (
          <div key={`${item.code}-${index}`} className="grid gap-3 py-3 md:grid-cols-[1fr_2fr_9rem_3rem]">
            <Input
              value={item.code}
              placeholder="CODE"
              aria-label={`${title} code, row ${index + 1}`}
              onChange={(event) => onChange(items.map((row, rowIndex) => rowIndex === index ? { ...row, code: event.target.value.toUpperCase().replace(/\s+/g, '_') } : row))}
            />
            <Input
              value={item.label}
              placeholder="Display name"
              aria-label={`${title} display name, row ${index + 1}`}
              onChange={(event) => onChange(items.map((row, rowIndex) => rowIndex === index ? { ...row, label: event.target.value } : row))}
            />
            <Select
              value={item.active ? 'ACTIVE' : 'INACTIVE'}
              onValueChange={(value) => onChange(items.map((row, rowIndex) => rowIndex === index ? { ...row, active: value === 'ACTIVE' } : row))}
            >
              <SelectTrigger aria-label={`${title} status, row ${index + 1}`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ACTIVE">Active</SelectItem>
                <SelectItem value="INACTIVE">Inactive</SelectItem>
              </SelectContent>
            </Select>
            <Button type="button" variant="ghost" size="icon" aria-label="Remove row" onClick={() => onChange(items.filter((_, rowIndex) => rowIndex !== index))}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>
    </section>
  );
}

export function AdminSettings() {
  const addNotification = useUIStore((s) => s.addNotification);
  const { data, isLoading, isError, error, refetch } = useApiQuery<HcmSetupConfig>(['hcm-setup'], '/admin/hcm-setup');
  const [setup, setSetup] = React.useState<HcmSetupConfig>(() => cloneSetup(DEFAULT_HCM_SETUP));
  const [savedAt, setSavedAt] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (data) setSetup(cloneSetup(data));
  }, [data]);

  const mutation = useApiMutation<HcmSetupConfig, HcmSetupConfig>(
    '/admin/hcm-setup',
    'patch',
    [['hcm-setup']],
    {
      onSuccess: (result) => {
        setSetup(cloneSetup(result));
        setSavedAt(new Date().toLocaleTimeString());
        addNotification({ title: 'Settings saved', message: 'The HCM setup configuration was saved.', type: 'success', read: false });
      },
      onError: (mutationError) => {
        const message = mutationError instanceof Error ? mutationError.message : 'Unable to save the setup configuration.';
        addNotification({ title: 'Something went wrong', message, type: 'error', read: false });
      },
    },
  );

  const updateSetup = <K extends keyof HcmSetupConfig>(key: K, value: HcmSetupConfig[K]) => {
    setSetup((current) => ({ ...current, [key]: value }));
    setSavedAt(null);
  };

  const updateLocation = (index: number, patch: Partial<WorkLocationOption>) => {
    updateSetup('locations', setup.locations.map((location, rowIndex) => rowIndex === index ? { ...location, ...patch } : location));
  };

  const updateCity = (index: number, patch: Partial<CityOption>) => {
    updateSetup('cities', setup.cities.map((city, rowIndex) => rowIndex === index ? { ...city, ...patch } : city));
  };

  const updateDocument = (index: number, patch: Partial<DocumentRequirement>) => {
    updateSetup('documentRequirements', setup.documentRequirements.map((document, rowIndex) => rowIndex === index ? { ...document, ...patch } : document));
  };

  const updateFieldRule = (index: number, patch: Partial<FieldRule>) => {
    updateSetup('fieldRules', setup.fieldRules.map((rule, rowIndex) => rowIndex === index ? { ...rule, ...patch } : rule));
  };

  const updateLeavePolicy = (index: number, patch: Partial<LeavePolicy>) => {
    updateSetup('leavePolicies', setup.leavePolicies.map((policy, rowIndex) => rowIndex === index ? { ...policy, ...patch } : policy));
  };

  const updateHolidayCalendar = (index: number, patch: Partial<NonNullable<HcmSetupConfig['attendancePolicy']['holidayCalendars']>[number]>) => {
    updateSetup('attendancePolicy', {
      ...setup.attendancePolicy,
      holidayCalendars: (setup.attendancePolicy.holidayCalendars ?? []).map((holiday, rowIndex) => rowIndex === index ? { ...holiday, ...patch } : holiday),
    });
  };

  const save = () => mutation.mutate(setup);

  return (
    <div className="space-y-6">
      <div className="fusion-glass flex flex-col gap-4 rounded-[2rem] p-6 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="fusion-gradient-text text-2xl font-bold">Admin Settings</h2>
          <p className="text-slate-500">Company setup values, employee ID policy, locations, required fields, and hiring document rules.</p>
        </div>
        <div className="flex items-center gap-3">
          {savedAt ? <Badge variant="secondary">Saved {savedAt}</Badge> : null}
          <Button asChild type="button" variant="outline">
            <Link to="/admin/system-console">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Command Center
            </Link>
          </Button>
          <Button asChild type="button" variant="outline">
            <Link to="/admin/system-console/policies">Policy Center</Link>
          </Button>
          <Button type="button" onClick={save} disabled={isLoading || mutation.isPending} aria-label="Save setup">
            <Save className="mr-2 h-4 w-4" />
            {mutation.isPending ? 'Saving...' : 'Save Setup'}
          </Button>
        </div>
      </div>

      {isError ? (
        <ErrorState error={error} onRetry={() => refetch()} />
      ) : null}

      <section className="fusion-glass grid gap-6 rounded-[2rem] p-6 lg:grid-cols-[20rem_1fr]">
        <div>
          <h3 className="fusion-gradient-text text-base font-semibold">Employee ID Policy</h3>
          <p className="text-sm text-muted-foreground">Controls whether Add Employee asks for manual ID entry or follows an app policy.</p>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <div className="grid gap-2">
            <Label htmlFor="employee-id-mode">Mode</Label>
            <Select
              value={setup.employeeIdPolicy.mode}
              onValueChange={(value) => updateSetup('employeeIdPolicy', { ...setup.employeeIdPolicy, mode: value as HcmSetupConfig['employeeIdPolicy']['mode'] })}
            >
              <SelectTrigger id="employee-id-mode">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="MANUAL_ONLY">Manual only</SelectItem>
                <SelectItem value="AUTO">Auto-generate</SelectItem>
                <SelectItem value="MANUAL_WITH_APP_ADMIN">Manual by app admin</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="employee-id-prefix">Prefix</Label>
            <Input
              id="employee-id-prefix"
              value={setup.employeeIdPolicy.prefix ?? ''}
              placeholder="EMP"
              disabled={setup.employeeIdPolicy.mode === 'MANUAL_ONLY'}
              onChange={(event) => updateSetup('employeeIdPolicy', { ...setup.employeeIdPolicy, prefix: event.target.value.toUpperCase() })}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="employee-id-next-number">Next Number</Label>
            <Input
              id="employee-id-next-number"
              type="number"
              value={setup.employeeIdPolicy.nextNumber ?? ''}
              disabled={setup.employeeIdPolicy.mode === 'MANUAL_ONLY'}
              onChange={(event) => updateSetup('employeeIdPolicy', { ...setup.employeeIdPolicy, nextNumber: event.target.value ? Number(event.target.value) : undefined })}
            />
          </div>
        </div>
      </section>

      <section className="fusion-glass grid gap-6 rounded-[2rem] p-6 lg:grid-cols-[20rem_1fr]">
        <div>
          <h3 className="fusion-gradient-text text-base font-semibold">Payroll Calculation Policy</h3>
          <p className="text-sm text-muted-foreground">Percentages used to calculate employee tax and insurance deductions from gross salary.</p>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <div className="grid gap-2">
            <Label htmlFor="payroll-tax-rate">Tax %</Label>
            <Input
              id="payroll-tax-rate"
              type="number"
              min={0}
              max={100}
              step="0.01"
              value={setup.payrollCalculationPolicy.taxRatePercent}
              onChange={(event) => updateSetup('payrollCalculationPolicy', {
                ...setup.payrollCalculationPolicy,
                taxRatePercent: Number(event.target.value || 0),
              })}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="payroll-employee-insurance-rate">Employee Insurance %</Label>
            <Input
              id="payroll-employee-insurance-rate"
              type="number"
              min={0}
              max={100}
              step="0.01"
              value={setup.payrollCalculationPolicy.employeeInsuranceRatePercent}
              onChange={(event) => updateSetup('payrollCalculationPolicy', {
                ...setup.payrollCalculationPolicy,
                employeeInsuranceRatePercent: Number(event.target.value || 0),
              })}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="payroll-employer-insurance-rate">Employer Insurance %</Label>
            <Input
              id="payroll-employer-insurance-rate"
              type="number"
              min={0}
              max={100}
              step="0.01"
              value={setup.payrollCalculationPolicy.employerInsuranceRatePercent ?? ''}
              onChange={(event) => updateSetup('payrollCalculationPolicy', {
                ...setup.payrollCalculationPolicy,
                employerInsuranceRatePercent: event.target.value ? Number(event.target.value) : undefined,
              })}
            />
          </div>
        </div>
      </section>

      <section className="fusion-glass space-y-4 rounded-[2rem] p-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h3 className="fusion-gradient-text text-base font-semibold">Employee Field Rules</h3>
            <p className="text-sm text-muted-foreground">Controls which Add Employee fields are mandatory or optional.</p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => updateSetup('fieldRules', [...setup.fieldRules, {
              fieldKey: `customField${Date.now().toString().slice(-5)}`,
              label: '',
              section: 'Custom',
              required: false,
              active: true,
              fieldType: 'TEXT',
            }])}
          >
            <Plus className="mr-2 h-4 w-4" />
            Add
          </Button>
        </div>
        <div className="divide-y border-y">
          {setup.fieldRules.map((rule, index) => {
            const builtIn = !isCustomFieldRuleKey(rule.fieldKey);
            const fieldType = rule.fieldType ?? 'TEXT';
            return (
              <div key={`${rule.fieldKey}-${index}`} className="space-y-2 py-3">
                <div className="grid gap-3 md:grid-cols-[1fr_1.2fr_.9fr_1fr_.8fr_.8fr_3rem]">
                  <Input
                    value={rule.fieldKey}
                    placeholder="fieldKey"
                    aria-label={`Field key, row ${index + 1}`}
                    onChange={(event) => updateFieldRule(index, { fieldKey: event.target.value })}
                  />
                  <Input
                    value={rule.label}
                    placeholder="Label"
                    aria-label={`Field label, row ${index + 1}`}
                    onChange={(event) => updateFieldRule(index, { label: event.target.value })}
                  />
                  <Input
                    value={rule.section}
                    placeholder="Section"
                    aria-label={`Field section, row ${index + 1}`}
                    onChange={(event) => updateFieldRule(index, { section: event.target.value })}
                  />
                  <Select
                    value={fieldType}
                    disabled={builtIn}
                    onValueChange={(value) => updateFieldRule(index, { fieldType: value as FieldRule['fieldType'] })}
                  >
                    <SelectTrigger aria-label={`Field type, row ${index + 1}`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="TEXT">Text</SelectItem>
                      <SelectItem value="NUMBER">Number</SelectItem>
                      <SelectItem value="DATE">Date</SelectItem>
                      <SelectItem value="BOOLEAN">Yes / No</SelectItem>
                      <SelectItem value="SELECT">Dropdown</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={rule.required ? 'REQUIRED' : 'OPTIONAL'} onValueChange={(value) => updateFieldRule(index, { required: value === 'REQUIRED' })}>
                    <SelectTrigger aria-label={`Field required setting, row ${index + 1}`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="REQUIRED">Required</SelectItem>
                      <SelectItem value="OPTIONAL">Optional</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={rule.active ? 'ACTIVE' : 'INACTIVE'} onValueChange={(value) => updateFieldRule(index, { active: value === 'ACTIVE' })}>
                    <SelectTrigger aria-label={`Field active status, row ${index + 1}`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ACTIVE">Active</SelectItem>
                      <SelectItem value="INACTIVE">Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button type="button" variant="ghost" size="icon" aria-label="Remove row" onClick={() => updateSetup('fieldRules', setup.fieldRules.filter((_, rowIndex) => rowIndex !== index))}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                {builtIn ? (
                  <p className="text-xs text-muted-foreground">Built-in field — always rendered with its dedicated input; field type is ignored.</p>
                ) : fieldType === 'SELECT' ? (
                  <Input
                    value={(rule.options ?? []).join(', ')}
                    placeholder="Dropdown options, comma separated"
                    aria-label={`Dropdown options, row ${index + 1}`}
                    onChange={(event) => updateFieldRule(index, { options: splitCsv(event.target.value) })}
                  />
                ) : null}
              </div>
            );
          })}
        </div>
      </section>

      <section className="fusion-glass space-y-4 rounded-[2rem] p-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h3 className="fusion-gradient-text text-base font-semibold">Leave Policies</h3>
            <p className="text-sm text-muted-foreground">Controls whether a leave type is day-based or hour-based, paid or unpaid, requestable, and payroll-impacting.</p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => updateSetup('leavePolicies', [...setup.leavePolicies, {
              code: `LEAVE_${Date.now().toString().slice(-5)}`,
              label: '',
              active: true,
              unit: 'DAYS',
              paid: true,
              deductFromBalance: true,
              requestableByEmployee: true,
              payrollImpact: 'PAID_LEAVE',
              approvalWorkflow: 'MANAGER',
            }])}
          >
            <Plus className="mr-2 h-4 w-4" />
            Add
          </Button>
        </div>
        <div className="divide-y border-y">
          {setup.leavePolicies.map((policy, index) => (
            <div key={`${policy.code}-${index}`} className="grid gap-3 py-3 md:grid-cols-[1fr_1.4fr_.75fr_.75fr_.75fr_.75fr_.9fr_.8fr_3rem]">
              <Input value={policy.code} aria-label={`Leave policy code, row ${index + 1}`} onChange={(event) => updateLeavePolicy(index, { code: event.target.value.toUpperCase().replace(/\s+/g, '_') })} />
              <Input value={policy.label} placeholder="Policy name" onChange={(event) => updateLeavePolicy(index, { label: event.target.value })} />
              <Select value={policy.unit} onValueChange={(value) => updateLeavePolicy(index, { unit: value as LeavePolicy['unit'] })}>
                <SelectTrigger aria-label={`Leave policy unit, row ${index + 1}`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="DAYS">Days</SelectItem>
                  <SelectItem value="HOURS">Hours</SelectItem>
                </SelectContent>
              </Select>
              <Input
                type="number"
                value={policy.annualEntitlement ?? ''}
                placeholder="Entitlement"
                onChange={(event) => updateLeavePolicy(index, { annualEntitlement: event.target.value ? Number(event.target.value) : undefined })}
              />
              <Input
                type="number"
                value={policy.maxPerRequest ?? ''}
                placeholder="Max/request"
                onChange={(event) => updateLeavePolicy(index, { maxPerRequest: event.target.value ? Number(event.target.value) : undefined })}
              />
              <Select value={policy.paid ? 'PAID' : 'UNPAID'} onValueChange={(value) => updateLeavePolicy(index, {
                paid: value === 'PAID',
                payrollImpact: value === 'PAID' ? policy.payrollImpact === 'UNPAID_LEAVE' ? 'PAID_LEAVE' : policy.payrollImpact : 'UNPAID_LEAVE',
              })}>
                <SelectTrigger aria-label={`Leave policy paid status, row ${index + 1}`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PAID">Paid</SelectItem>
                  <SelectItem value="UNPAID">Unpaid</SelectItem>
                </SelectContent>
              </Select>
              <Select value={policy.requestableByEmployee ? 'REQUESTABLE' : 'SYSTEM'} onValueChange={(value) => updateLeavePolicy(index, { requestableByEmployee: value === 'REQUESTABLE', systemManaged: value === 'SYSTEM' })}>
                <SelectTrigger aria-label={`Leave policy request mode, row ${index + 1}`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="REQUESTABLE">Requestable</SelectItem>
                  <SelectItem value="SYSTEM">System</SelectItem>
                </SelectContent>
              </Select>
              <Select value={policy.active ? 'ACTIVE' : 'INACTIVE'} onValueChange={(value) => updateLeavePolicy(index, { active: value === 'ACTIVE' })}>
                <SelectTrigger aria-label={`Leave policy active status, row ${index + 1}`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ACTIVE">Active</SelectItem>
                  <SelectItem value="INACTIVE">Inactive</SelectItem>
                </SelectContent>
              </Select>
              <Button type="button" variant="ghost" size="icon" aria-label="Remove row" onClick={() => updateSetup('leavePolicies', setup.leavePolicies.filter((_, rowIndex) => rowIndex !== index))}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      </section>

      <section className="fusion-glass space-y-4 rounded-[2rem] p-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h3 className="fusion-gradient-text text-base font-semibold">Public Holiday Calendar</h3>
            <p className="text-sm text-muted-foreground">System-managed paid or unpaid days excluded from day-based leave and consumed by attendance/payroll.</p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => updateSetup('attendancePolicy', {
              ...setup.attendancePolicy,
              holidayCalendars: [...(setup.attendancePolicy.holidayCalendars ?? []), {
                date: new Date().toISOString().slice(0, 10),
                name: 'Public holiday',
                countryCode: 'EG',
                paid: true,
              }],
            })}
          >
            <Plus className="mr-2 h-4 w-4" />
            Add
          </Button>
        </div>
        <div className="divide-y border-y">
          {(setup.attendancePolicy.holidayCalendars ?? []).map((holiday, index) => (
            <div key={`${holiday.date}-${holiday.name}-${index}`} className="grid gap-3 py-3 md:grid-cols-[1fr_1.5fr_.7fr_1.2fr_.8fr_3rem]">
              <Input type="date" value={holiday.date} aria-label={`Holiday date, row ${index + 1}`} onChange={(event) => updateHolidayCalendar(index, { date: event.target.value })} />
              <Input value={holiday.name} placeholder="Holiday name" onChange={(event) => updateHolidayCalendar(index, { name: event.target.value })} />
              <Input value={holiday.countryCode ?? ''} placeholder="Country" maxLength={2} onChange={(event) => updateHolidayCalendar(index, { countryCode: event.target.value.toUpperCase() || undefined })} />
              <Input value={(holiday.locationCodes ?? []).join(', ')} placeholder="Workplace codes" onChange={(event) => updateHolidayCalendar(index, { locationCodes: splitCsv(event.target.value) })} />
              <Select value={holiday.paid === false ? 'UNPAID' : 'PAID'} onValueChange={(value) => updateHolidayCalendar(index, { paid: value === 'PAID' })}>
                <SelectTrigger aria-label={`Holiday paid status, row ${index + 1}`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PAID">Paid</SelectItem>
                  <SelectItem value="UNPAID">Unpaid</SelectItem>
                </SelectContent>
              </Select>
              <Button type="button" variant="ghost" size="icon" aria-label="Remove row" onClick={() => updateSetup('attendancePolicy', {
                ...setup.attendancePolicy,
                holidayCalendars: (setup.attendancePolicy.holidayCalendars ?? []).filter((_, rowIndex) => rowIndex !== index),
              })}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      </section>

      <OptionRows
        title="Departments"
        items={setup.departments}
        onChange={(items) => updateSetup('departments', items)}
        onAdd={() => updateSetup('departments', [...setup.departments, emptyOption('DEPARTMENT')])}
      />

      <OptionRows
        title="Job Titles"
        items={setup.jobTitles}
        onChange={(items) => updateSetup('jobTitles', items)}
        onAdd={() => updateSetup('jobTitles', [...setup.jobTitles, emptyOption('JOB_TITLE')])}
      />

      <OptionRows
        title="Gender Values"
        items={setup.genderOptions}
        onChange={(items) => updateSetup('genderOptions', items.map((item) => ({ ...item, value: item.code })))}
        onAdd={() => {
          const option = emptyOption('GENDER');
          updateSetup('genderOptions', [...setup.genderOptions, { ...option, value: option.code }]);
        }}
      />

      <section className="fusion-glass space-y-4 rounded-[2rem] p-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h3 className="fusion-gradient-text text-base font-semibold">Work Locations</h3>
            <p className="text-sm text-muted-foreground">Company locations feed workplace, address, country flags, and salary currency defaults.</p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => updateSetup('locations', [
              ...setup.locations,
              {
                code: `LOCATION_${Date.now().toString().slice(-5)}`,
                label: '',
                active: true,
                countryCode: 'EG',
                countryName: 'Egypt',
                flag: 'EG',
                city: '',
                currency: 'EGP',
              },
            ])}
          >
            <Plus className="mr-2 h-4 w-4" />
            Add
          </Button>
        </div>
        <div className="divide-y border-y">
          {setup.locations.map((location, index) => (
            <div key={`${location.code}-${index}`} className="grid gap-3 py-3 md:grid-cols-[1fr_1.2fr_.55fr_1fr_1fr_.6fr_.8fr_.8fr_3rem]">
              <Input value={location.code} aria-label={`Location code, row ${index + 1}`} onChange={(event) => updateLocation(index, { code: event.target.value.toUpperCase().replace(/\s+/g, '_') })} />
              <Input value={location.label} placeholder="Location name" onChange={(event) => updateLocation(index, { label: event.target.value })} />
              <Input value={location.countryCode} maxLength={2} aria-label={`Location country code, row ${index + 1}`} onChange={(event) => {
                const code = event.target.value.toUpperCase().slice(0, 2);
                updateLocation(index, { countryCode: code, flag: code });
              }} />
              <Input value={location.countryName} placeholder="Country" onChange={(event) => updateLocation(index, { countryName: event.target.value })} />
              <Input value={location.city} placeholder="City" onChange={(event) => updateLocation(index, { city: event.target.value })} />
              <Input value={location.currency} maxLength={3} aria-label={`Location currency, row ${index + 1}`} onChange={(event) => updateLocation(index, { currency: event.target.value.toUpperCase().slice(0, 3) })} />
              <Input type="number" value={location.latitude ?? ''} placeholder="Lat" onChange={(event) => updateLocation(index, { latitude: event.target.value ? Number(event.target.value) : undefined })} />
              <Input type="number" value={location.longitude ?? ''} placeholder="Lng" onChange={(event) => updateLocation(index, { longitude: event.target.value ? Number(event.target.value) : undefined })} />
              <Button type="button" variant="ghost" size="icon" aria-label="Remove row" onClick={() => updateSetup('locations', setup.locations.filter((_, rowIndex) => rowIndex !== index))}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      </section>

      <section className="fusion-glass space-y-4 rounded-[2rem] p-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h3 className="fusion-gradient-text text-base font-semibold">Cities</h3>
            <p className="text-sm text-muted-foreground">City choices are filtered by selected country and location.</p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => updateSetup('cities', [...setup.cities, { code: `CITY_${Date.now().toString().slice(-5)}`, label: '', active: true, countryCode: 'EG', flag: 'EG', currency: 'EGP' }])}
          >
            <Plus className="mr-2 h-4 w-4" />
            Add
          </Button>
        </div>
        <div className="divide-y border-y">
          {setup.cities.map((city, index) => (
            <div key={`${city.code}-${index}`} className="grid gap-3 py-3 md:grid-cols-[1fr_2fr_.7fr_.7fr_.7fr_3rem]">
              <Input value={city.code} aria-label={`City code, row ${index + 1}`} onChange={(event) => updateCity(index, { code: event.target.value.toUpperCase().replace(/\s+/g, '_') })} />
              <Input value={city.label} placeholder="City" onChange={(event) => updateCity(index, { label: event.target.value })} />
              <Input value={city.countryCode} maxLength={2} aria-label={`City country code, row ${index + 1}`} onChange={(event) => {
                const code = event.target.value.toUpperCase().slice(0, 2);
                updateCity(index, { countryCode: code, flag: code });
              }} />
              <div className="flex items-center justify-center text-lg">{flagEmoji(city.flag)}</div>
              <Input value={city.currency} maxLength={3} aria-label={`City currency, row ${index + 1}`} onChange={(event) => updateCity(index, { currency: event.target.value.toUpperCase().slice(0, 3) })} />
              <Button type="button" variant="ghost" size="icon" aria-label="Remove row" onClick={() => updateSetup('cities', setup.cities.filter((_, rowIndex) => rowIndex !== index))}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      </section>

      <section className="fusion-glass space-y-4 rounded-[2rem] p-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h3 className="fusion-gradient-text text-base font-semibold">Hiring Credentials</h3>
            <p className="text-sm text-muted-foreground">Document and certificate slots shown in Add Employee.</p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => updateSetup('documentRequirements', [...setup.documentRequirements, {
              code: `DOCUMENT_${Date.now().toString().slice(-5)}`,
              label: '',
              active: true,
              required: false,
              allowMultiple: false,
              acceptedMimeTypes: ['application/pdf'],
            }])}
          >
            <Plus className="mr-2 h-4 w-4" />
            Add
          </Button>
        </div>
        <div className="divide-y border-y">
          {setup.documentRequirements.map((document, index) => (
            <div key={`${document.code}-${index}`} className="grid gap-3 py-3 md:grid-cols-[1fr_1.4fr_.8fr_.8fr_1.6fr_3rem]">
              <Input value={document.code} aria-label={`Document code, row ${index + 1}`} onChange={(event) => updateDocument(index, { code: event.target.value.toUpperCase().replace(/\s+/g, '_') })} />
              <Input value={document.label} placeholder="Document name" onChange={(event) => updateDocument(index, { label: event.target.value })} />
              <Select value={document.required ? 'REQUIRED' : 'OPTIONAL'} onValueChange={(value) => updateDocument(index, { required: value === 'REQUIRED' })}>
                <SelectTrigger aria-label={`Document required setting, row ${index + 1}`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="REQUIRED">Required</SelectItem>
                  <SelectItem value="OPTIONAL">Optional</SelectItem>
                </SelectContent>
              </Select>
              <Select value={document.allowMultiple ? 'MULTIPLE' : 'SINGLE'} onValueChange={(value) => updateDocument(index, { allowMultiple: value === 'MULTIPLE' })}>
                <SelectTrigger aria-label={`Document multiplicity, row ${index + 1}`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="SINGLE">Single</SelectItem>
                  <SelectItem value="MULTIPLE">Multiple</SelectItem>
                </SelectContent>
              </Select>
              <Input
                value={document.acceptedMimeTypes.join(', ')}
                aria-label={`Document accepted MIME types, row ${index + 1}`}
                onChange={(event) => updateDocument(index, { acceptedMimeTypes: event.target.value.split(',').map((item) => item.trim()).filter(Boolean) })}
              />
              <Button type="button" variant="ghost" size="icon" aria-label="Remove row" onClick={() => updateSetup('documentRequirements', setup.documentRequirements.filter((_, rowIndex) => rowIndex !== index))}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

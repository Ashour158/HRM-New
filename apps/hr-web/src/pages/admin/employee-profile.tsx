import { useNavigate, useParams } from 'react-router-dom';
import type { ReactNode } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  Briefcase,
  ClipboardList,
  Contact,
  DollarSign,
  FileText,
  GitBranch,
  GraduationCap,
  HeartHandshake,
  KeyRound,
  Landmark,
  MapPin,
  PauseCircle,
  RotateCcw,
  ShieldCheck,
  UserCheck,
  UserMinus,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { FieldMask } from '@/components/common/field-mask';
import { AllowedActions } from '@/components/common/allowed-actions';
import { AuditTrail } from '@/components/common/audit-trail';
import { useApiMutation, useApiQuery } from '@/hooks/use-api';
import { formatDate } from '@/lib/utils';
import type { EmployeeProfileData } from '@/types';

function valueOrDash(value?: string | null) {
  return value && value.trim() ? value : '-';
}

function displayValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return '-';
  if (value instanceof Date) return formatDate(value.toISOString());
  if (typeof value === 'string') return valueOrDash(value);
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) return value.map(displayValue).filter((item) => item !== '-').join(', ') || '-';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function humanizeKey(key: string): string {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

type LooseRecord = Record<string, unknown>;

function recordArray(value: unknown, nestedKeys: string[] = []): LooseRecord[] {
  if (Array.isArray(value)) return value.filter((item): item is LooseRecord => Boolean(item) && typeof item === 'object' && !Array.isArray(item));
  if (value && typeof value === 'object') {
    const record = value as LooseRecord;
    for (const key of nestedKeys) {
      const nested = record[key];
      if (Array.isArray(nested)) return recordArray(nested);
    }
  }
  return [];
}

function firstValue(record: LooseRecord, keys: string[]): string {
  for (const key of keys) {
    const rendered = displayValue(record[key]);
    if (rendered !== '-') return rendered;
  }
  return '-';
}

function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="border-t py-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <div className="mt-1 text-sm font-medium">{children}</div>
    </div>
  );
}

function Section({
  title,
  icon,
  children,
}: {
  title: string;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="py-6">
      <div className="mb-4 flex items-center gap-2">
        {icon}
        <h3 className="text-lg font-semibold">{title}</h3>
      </div>
      {children}
    </section>
  );
}

function EntryRows({ entries }: { entries?: Array<Record<string, unknown>> }) {
  const visibleEntries = entries?.filter((entry) => Object.values(entry).some(Boolean)) ?? [];
  if (visibleEntries.length === 0) {
    return <p className="border-t py-4 text-sm text-muted-foreground">No records captured.</p>;
  }
  return (
    <div className="divide-y border-y">
      {visibleEntries.map((entry, index) => {
        const values = Object.entries(entry).filter(([, value]) => Boolean(value)).slice(0, 5);
        return (
          <div key={index} className="grid gap-2 py-4 md:grid-cols-5">
            {values.map(([key, value]) => (
              <div key={key}>
                <p className="text-xs text-muted-foreground">{humanizeKey(key)}</p>
                <p className="text-sm font-medium">{displayValue(value)}</p>
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}

interface MasterProfileData extends EmployeeProfileData {
  profileSections?: Record<string, Record<string, unknown> | undefined>;
  relationships?: unknown;
  employmentRelationships?: unknown;
  jobAssignments?: unknown;
  positionAssignments?: unknown;
  contracts?: unknown;
  employmentContracts?: unknown;
  digitalEmployeeFile?: unknown;
  digitalFile?: unknown;
  documentFile?: unknown;
  expiryAlerts?: unknown;
  lifecycleTimeline?: unknown;
  timeline?: unknown;
  custom?: Record<string, unknown>;
  customFields?: Record<string, unknown>;
}

export function AdminEmployeeProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: profile, isLoading, refetch } = useApiQuery<EmployeeProfileData>(
    ['admin-employee-profile', id],
    `/hr/core/workers/${id}/profile`,
    { enabled: Boolean(id) },
  );
  const { data: masterProfile, refetch: refetchMaster } = useApiQuery<MasterProfileData>(
    ['admin-employee-master-profile', id],
    `/hr/core/workers/${id}/master-profile`,
    { enabled: Boolean(id), retry: false },
  );

  const activateMutation = useApiMutation<void, { employeeId: string }>(
    (vars) => `/hr/core/workers/${vars.employeeId}/commands/activate`,
    'post',
    [['admin-workers'], ['admin-employee-profile', id], ['admin-employee-master-profile', id]],
  );

  const terminateMutation = useApiMutation<void, { employeeId: string; reason: string; terminationDate: string }>(
    (vars) => `/hr/core/workers/${vars.employeeId}/commands/terminate`,
    'post',
    [['admin-workers'], ['admin-employee-profile', id], ['admin-employee-master-profile', id]],
  );

  const suspendMutation = useApiMutation<void, { employeeId: string; reason: string; effectiveDate: string }>(
    (vars) => `/hr/core/workers/${vars.employeeId}/commands/suspend`,
    'post',
    [['admin-workers'], ['admin-employee-profile', id], ['admin-employee-master-profile', id]],
  );

  const reinstateMutation = useApiMutation<void, { employeeId: string; effectiveDate: string }>(
    (vars) => `/hr/core/workers/${vars.employeeId}/commands/reinstate`,
    'post',
    [['admin-workers'], ['admin-employee-profile', id], ['admin-employee-master-profile', id]],
  );

  const rehireMutation = useApiMutation<void, { employeeId: string }>(
    (vars) => `/hr/core/workers/${vars.employeeId}/commands/rehire`,
    'post',
    [['admin-workers'], ['admin-employee-profile', id], ['admin-employee-master-profile', id]],
  );

  if (isLoading && !profile) {
    return (
      <div className="-m-4 min-h-[calc(100vh-7rem)] px-6 py-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="mt-8 h-48 w-full" />
      </div>
    );
  }

  const currentProfile = profile;

  if (!currentProfile) {
    return (
      <div className="-m-4 min-h-[calc(100vh-7rem)] px-6 py-6">
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          Employee profile could not be loaded.
        </div>
      </div>
    );
  }

  const {
    worker,
    basic,
    contact,
    emergencyContact,
    background,
    compensation,
    documents,
    workAuthorization,
    tax,
    banking,
    dependents,
    assetAccess,
    skills,
    consents,
    governance,
  } = currentProfile;
  const address = contact.address ?? {};
  const workLocation = contact.workLocation ?? {};
  const socialLinks = contact.socialLinks ?? {};
  const emergency = emergencyContact.emergencyContact ?? {};
  const emergencyContacts = emergencyContact.emergencyContacts ?? [];
  const profilePhotoSrc = basic.photoAttachment?.dataUrl || basic.photoUrl;
  const attachedDocuments = documents.documents ?? [];
  const authorization = workAuthorization?.workAuthorization ?? {};
  const taxProfile = tax?.taxProfile ?? {};
  const bankAccount = banking?.bankAccount ?? {};
  const dependentRows = dependents?.dependents ?? [];
  const beneficiaryRows = dependents?.beneficiaries ?? [];
  const assetRows = assetAccess?.assets ?? [];
  const badgeRows = assetAccess?.accessBadges ?? [];
  const skillRows = skills?.skills ?? [];
  const licenseRows = skills?.licenses ?? [];
  const consentRows = consents?.consents ?? [];
  const privacyRows = consents?.privacyNotices ?? [];
  const retentionRows = consents?.retentionHolds ?? [];
  const relationships = recordArray(masterProfile?.relationships ?? masterProfile?.employmentRelationships, ['items', 'relationships']);
  const assignments = recordArray(masterProfile?.jobAssignments ?? masterProfile?.positionAssignments, ['items', 'assignments']);
  const contracts = recordArray(masterProfile?.contracts ?? masterProfile?.employmentContracts, ['items', 'contracts']);
  const digitalFile = recordArray(masterProfile?.digitalEmployeeFile ?? masterProfile?.digitalFile ?? masterProfile?.documentFile, ['items', 'documents']);
  const expiryAlerts = recordArray(masterProfile?.expiryAlerts, ['items', 'alerts']);
  const lifecycleTimeline = recordArray(masterProfile?.lifecycleTimeline ?? masterProfile?.timeline, ['items', 'events']);
  const customFields = masterProfile?.profileSections?.CUSTOM ?? masterProfile?.customFields ?? masterProfile?.custom ?? {};
  const canActivate = worker.status === 'DRAFT' || worker.status === 'PENDING_ACTIVATION' || worker.status === 'REHIRED';
  const canTerminate = worker.status === 'ACTIVE';
  const canSuspend = worker.status === 'ACTIVE';
  const canReinstate = worker.status === 'SUSPENDED';
  const canRehire = worker.status === 'TERMINATED';

  const activate = async () => {
    await activateMutation.mutateAsync({ employeeId: worker.id });
    refetch();
    refetchMaster();
  };

  const terminate = async () => {
    const reason = window.prompt('Enter termination reason:');
    if (!reason) return;
    await terminateMutation.mutateAsync({
      employeeId: worker.id,
      reason,
      terminationDate: new Date().toISOString(),
    });
    refetch();
    refetchMaster();
  };

  const suspend = async () => {
    const reason = window.prompt('Enter suspension reason:');
    if (!reason) return;
    await suspendMutation.mutateAsync({
      employeeId: worker.id,
      reason,
      effectiveDate: new Date().toISOString(),
    });
    refetch();
    refetchMaster();
  };

  const reinstate = async () => {
    await reinstateMutation.mutateAsync({
      employeeId: worker.id,
      effectiveDate: new Date().toISOString(),
    });
    refetch();
    refetchMaster();
  };

  const rehire = async () => {
    await rehireMutation.mutateAsync({ employeeId: worker.id });
    refetch();
    refetchMaster();
  };

  return (
    <div className="-m-4 min-h-[calc(100vh-7rem)] bg-background">
      <div className="border-b px-6 py-5">
        <Button variant="ghost" size="sm" onClick={() => navigate('/admin/employees')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Employees
        </Button>
        <div className="mt-5 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex items-center gap-5">
            <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full border bg-muted text-xl font-semibold">
              {profilePhotoSrc ? <img src={profilePhotoSrc} alt="" className="h-full w-full object-cover" /> : `${worker.firstName[0] ?? ''}${worker.lastName[0] ?? ''}`}
            </div>
            <div>
              <h2 className="text-3xl font-bold">{worker.firstName} {worker.lastName}</h2>
              <p className="text-muted-foreground">{worker.employeeId} - {worker.jobTitle || 'Unassigned'}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <Badge>{worker.status}</Badge>
                <Badge variant="secondary">{governance.dataClassification}</Badge>
                {expiryAlerts.length ? <Badge variant="destructive">{expiryAlerts.length} expiry alerts</Badge> : null}
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {canActivate ? (
              <Button onClick={activate} disabled={activateMutation.isPending}>
                <UserCheck className="mr-2 h-4 w-4" />
                Activate
              </Button>
            ) : null}
            {canTerminate ? (
              <Button variant="destructive" onClick={terminate} disabled={terminateMutation.isPending}>
                <UserMinus className="mr-2 h-4 w-4" />
                Terminate
              </Button>
            ) : null}
            {canSuspend ? (
              <Button variant="outline" onClick={suspend} disabled={suspendMutation.isPending}>
                <PauseCircle className="mr-2 h-4 w-4" />
                Suspend
              </Button>
            ) : null}
            {canReinstate ? (
              <Button variant="outline" onClick={reinstate} disabled={reinstateMutation.isPending}>
                <RotateCcw className="mr-2 h-4 w-4" />
                Reinstate
              </Button>
            ) : null}
            {canRehire ? (
              <Button variant="outline" onClick={rehire} disabled={rehireMutation.isPending}>
                <RotateCcw className="mr-2 h-4 w-4" />
                Rehire
              </Button>
            ) : null}
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-[1fr_340px]">
        <main className="divide-y px-6">
          <Section title="Identity" icon={<Contact className="h-5 w-5 text-primary" />}>
            <div className="grid gap-x-8 md:grid-cols-3">
              <Detail label="Work Email"><FieldMask value={basic.workEmail ?? worker.email} decision="VISIBLE" /></Detail>
              <Detail label="Personal Email"><FieldMask value={basic.personalEmail} decision="MASKED" /></Detail>
              <Detail label="Gender">{valueOrDash(basic.gender)}</Detail>
              <Detail label="Personal Phone"><FieldMask value={basic.phoneNumber} decision="MASKED" maskingRule="PHONE_MASK" /></Detail>
              <Detail label="Work Phone"><FieldMask value={basic.workPhoneNumber} decision="MASKED" maskingRule="PHONE_MASK" /></Detail>
              <Detail label="Date of Birth"><FieldMask value={basic.dateOfBirth ? formatDate(basic.dateOfBirth) : '-'} decision="MASKED" /></Detail>
              <Detail label="Photo Attachment">{valueOrDash(basic.photoAttachment?.fileName)}</Detail>
              <Detail label="Hire Date">{worker.hireDate ? formatDate(worker.hireDate) : '-'}</Detail>
              <Detail label="Employment Status">{worker.status}</Detail>
              <Detail label="Legal Entity">{valueOrDash(worker.legalEntityName)}</Detail>
            </div>
          </Section>

          <Section title="Contact" icon={<MapPin className="h-5 w-5 text-primary" />}>
            <div className="grid gap-x-8 md:grid-cols-3">
              <Detail label="Address">{[address.line1, address.line2].filter(Boolean).join(', ') || '-'}</Detail>
              <Detail label="Building / Floor">{[address.building, address.floor].filter(Boolean).join(', ') || '-'}</Detail>
              <Detail label="Apartment">{valueOrDash(address.apartment)}</Detail>
              <Detail label="District">{valueOrDash(address.district)}</Detail>
              <Detail label="City">{valueOrDash(address.city)}</Detail>
              <Detail label="State / Region">{valueOrDash(address.state)}</Detail>
              <Detail label="Postal Code">{valueOrDash(address.postalCode)}</Detail>
              <Detail label="Country">{valueOrDash(address.country)}</Detail>
              <Detail label="Work Place">{valueOrDash(workLocation.name ?? workLocation.label)}</Detail>
              <Detail label="Work Location City">{valueOrDash(workLocation.city)}</Detail>
              <Detail label="Emergency Contact">{valueOrDash(emergency.name)}</Detail>
              <Detail label="Emergency Relationship">{valueOrDash(emergency.relationship)}</Detail>
              <Detail label="Emergency Phone"><FieldMask value={emergency.phoneNumber} decision="MASKED" maskingRule="PHONE_MASK" /></Detail>
              <Detail label="LinkedIn">{valueOrDash(socialLinks.linkedIn)}</Detail>
              <Detail label="Portfolio">{valueOrDash(socialLinks.portfolio)}</Detail>
              <Detail label="Facebook">{valueOrDash(socialLinks.facebook)}</Detail>
              <Detail label="Instagram">{valueOrDash(socialLinks.instagram)}</Detail>
            </div>
            {emergencyContacts.length > 1 ? (
              <div className="mt-4 divide-y border-y">
                {emergencyContacts.map((contact, index) => (
                  <div key={`${contact.name}-${index}`} className="grid gap-2 py-3 text-sm md:grid-cols-4">
                    <p className="font-medium">{valueOrDash(contact.name)}</p>
                    <p>{valueOrDash(contact.relationship)}</p>
                    <p>{valueOrDash(contact.phoneNumber)}</p>
                    <p className="text-muted-foreground">{valueOrDash(contact.email)}</p>
                  </div>
                ))}
              </div>
            ) : null}
          </Section>

          <Section title="Employment" icon={<Briefcase className="h-5 w-5 text-primary" />}>
            <div className="grid gap-x-8 md:grid-cols-3">
              <Detail label="Job Title">{valueOrDash(worker.jobTitle)}</Detail>
              <Detail label="Department">{valueOrDash(worker.departmentName)}</Detail>
              <Detail label="Manager">{valueOrDash(worker.managerName)}</Detail>
              <Detail label="Dotted-Line Manager">{valueOrDash(contact.dottedLineManagerId)}</Detail>
              <Detail label="HR Business Partner">{valueOrDash(contact.hrbpId)}</Detail>
              <Detail label="Mentor / Buddy">{valueOrDash(contact.mentorId)}</Detail>
              <Detail label="Colleagues">{contact.colleagueIds?.length ? contact.colleagueIds.join(', ') : '-'}</Detail>
            </div>
          </Section>

          <Section title="Lifecycle, Position, and Contracts" icon={<GitBranch className="h-5 w-5 text-primary" />}>
            <div className="grid gap-6 xl:grid-cols-3">
              <div>
                <h4 className="mb-2 text-sm font-semibold">Employment Relationships</h4>
                <EntryRows entries={relationships} />
              </div>
              <div>
                <h4 className="mb-2 text-sm font-semibold">Position Assignments</h4>
                <EntryRows entries={assignments} />
              </div>
              <div>
                <h4 className="mb-2 text-sm font-semibold">Contracts</h4>
                <EntryRows entries={contracts} />
              </div>
            </div>
            {lifecycleTimeline.length ? (
              <div className="mt-6">
                <h4 className="mb-2 text-sm font-semibold">Lifecycle Timeline</h4>
                <div className="divide-y border-y">
                  {lifecycleTimeline.slice(0, 8).map((event, index) => (
                    <div key={`${firstValue(event, ['id', 'eventId', 'eventName', 'action'])}-${index}`} className="grid gap-2 py-3 text-sm md:grid-cols-[1fr_1fr_2fr]">
                      <p className="font-medium">{firstValue(event, ['eventName', 'action', 'type', 'status'])}</p>
                      <p className="text-muted-foreground">{firstValue(event, ['occurredAt', 'effectiveDate', 'createdAt'])}</p>
                      <p className="text-muted-foreground">{firstValue(event, ['summary', 'reason', 'description'])}</p>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </Section>

          <Section title="Compensation" icon={<DollarSign className="h-5 w-5 text-primary" />}>
            <div className="grid gap-x-8 md:grid-cols-3">
              <Detail label="Gross Salary">
                {(compensation.grossSalaryAmount ?? compensation.salaryAmount) ? `${(compensation.grossSalaryAmount ?? compensation.salaryAmount)?.toLocaleString()} ${compensation.salaryCurrency ?? ''}`.trim() : '-'}
              </Detail>
              <Detail label="Tax">{compensation.taxAmount ? `${compensation.taxAmount.toLocaleString()} ${compensation.salaryCurrency ?? ''}`.trim() : '-'}</Detail>
              <Detail label="Insurance">{compensation.insuranceAmount ? `${compensation.insuranceAmount.toLocaleString()} ${compensation.salaryCurrency ?? ''}`.trim() : '-'}</Detail>
              <Detail label="Net Salary">{compensation.netSalaryAmount ? `${compensation.netSalaryAmount.toLocaleString()} ${compensation.salaryCurrency ?? ''}`.trim() : '-'}</Detail>
              <Detail label="Medical Insurance">{compensation.medicalInsuranceAmount ? `${compensation.medicalInsuranceAmount.toLocaleString()} ${compensation.salaryCurrency ?? ''}`.trim() : '-'}</Detail>
              <Detail label="Other Benefits">{compensation.otherBenefitsAmount ? `${compensation.otherBenefitsAmount.toLocaleString()} ${compensation.salaryCurrency ?? ''}`.trim() : '-'}</Detail>
              <Detail label="Salary Basis">{valueOrDash(compensation.salaryBasis)}</Detail>
              <Detail label="Pay Frequency">{valueOrDash(compensation.payFrequency)}</Detail>
              <Detail label="Benefits Notes">{valueOrDash(String(compensation.benefitsPackage?.notes ?? ''))}</Detail>
            </div>
          </Section>

          <Section title="Payroll and Work Authorization" icon={<Landmark className="h-5 w-5 text-primary" />}>
            <div className="grid gap-x-8 md:grid-cols-3">
              <Detail label="Authorization Country">{valueOrDash(String(authorization.countryCode ?? ''))}</Detail>
              <Detail label="Work Authorization Status">{valueOrDash(String(authorization.status ?? ''))}</Detail>
              <Detail label="Visa Status">{valueOrDash(String(authorization.visaStatus ?? ''))}</Detail>
              <Detail label="Visa Type">{valueOrDash(String(authorization.visaType ?? ''))}</Detail>
              <Detail label="Visa Expiry">{valueOrDash(String(authorization.visaExpiryDate ?? ''))}</Detail>
              <Detail label="Work Permit Number"><FieldMask value={String(authorization.workPermitNumber ?? '')} decision="MASKED" /></Detail>
              <Detail label="Tax Identifier"><FieldMask value={String(taxProfile.taxIdentifier ?? '')} decision="MASKED" /></Detail>
              <Detail label="Social Insurance Number"><FieldMask value={String(taxProfile.socialInsuranceNumber ?? '')} decision="MASKED" /></Detail>
              <Detail label="Bank Name">{valueOrDash(String(bankAccount.bankName ?? ''))}</Detail>
              <Detail label="Account Holder">{valueOrDash(String(bankAccount.accountHolderName ?? ''))}</Detail>
              <Detail label="Bank Account"><FieldMask value={String(bankAccount.accountNumber ?? '')} decision="MASKED" /></Detail>
              <Detail label="IBAN"><FieldMask value={String(bankAccount.iban ?? '')} decision="MASKED" /></Detail>
              <Detail label="Routing / Swift">{valueOrDash(String(bankAccount.routingNumber ?? bankAccount.swiftCode ?? ''))}</Detail>
            </div>
          </Section>

          <Section title="Documents" icon={<FileText className="h-5 w-5 text-primary" />}>
            {documents.employmentContract ? (
              <div className="mb-4 grid gap-x-8 border-y py-4 md:grid-cols-4">
                <Detail label="Contract Template">{valueOrDash(String(documents.employmentContract.templateCode ?? ''))}</Detail>
                <Detail label="Contract Status">{valueOrDash(String(documents.employmentContract.status ?? ''))}</Detail>
                <Detail label="Contract Start">{valueOrDash(String(documents.employmentContract.startDate ?? ''))}</Detail>
                <Detail label="Contract End">{valueOrDash(String(documents.employmentContract.endDate ?? ''))}</Detail>
              </div>
            ) : null}
            {digitalFile.length ? (
              <div className="mb-6">
                <h4 className="mb-2 text-sm font-semibold">Digital Employee File</h4>
                <div className="divide-y border-y">
                  {digitalFile.map((document, index) => (
                    <div key={`${firstValue(document, ['id', 'fileName', 'name'])}-${index}`} className="grid gap-2 py-4 md:grid-cols-[2fr_1fr_1fr_1fr]">
                      <p className="text-sm font-medium">{firstValue(document, ['fileName', 'name', 'title'])}</p>
                      <p className="text-sm text-muted-foreground">{firstValue(document, ['type', 'documentType', 'requirementLabel'])}</p>
                      <p className="text-sm text-muted-foreground">{firstValue(document, ['status', 'verificationStatus', 'state'])}</p>
                      <p className="text-sm text-muted-foreground">{firstValue(document, ['expiryDate', 'expiresAt', 'validUntil'])}</p>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
            {attachedDocuments.length ? (
              <div className="divide-y border-y">
                {attachedDocuments.map((document, index) => (
                  <div key={`${document.fileName}-${index}`} className="grid gap-2 py-4 md:grid-cols-[2fr_1fr_1fr]">
                    <p className="text-sm font-medium">{valueOrDash(String(document.fileName ?? ''))}</p>
                    <p className="text-sm text-muted-foreground">{valueOrDash(String(document.requirementLabel ?? document.type ?? document.mimeType ?? ''))}</p>
                    <p className="text-sm text-muted-foreground">{document.size ? `${document.size} bytes` : '-'}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="border-t py-4 text-sm text-muted-foreground">No documents attached.</p>
            )}
          </Section>

          <Section title="Background" icon={<GraduationCap className="h-5 w-5 text-primary" />}>
            <div className="space-y-6">
              <div>
                <h4 className="mb-2 text-sm font-semibold">Education</h4>
                <EntryRows entries={background.education} />
              </div>
              <div>
                <h4 className="mb-2 text-sm font-semibold">Past Experience</h4>
                <EntryRows entries={background.experience} />
              </div>
              <div>
                <h4 className="mb-2 text-sm font-semibold">Certifications</h4>
                <EntryRows entries={background.certifications} />
              </div>
              <div>
                <h4 className="mb-2 text-sm font-semibold">Skills</h4>
                <EntryRows entries={skillRows as Array<Record<string, unknown>>} />
              </div>
              <div>
                <h4 className="mb-2 text-sm font-semibold">Licenses</h4>
                <EntryRows entries={licenseRows as Array<Record<string, unknown>>} />
              </div>
            </div>
          </Section>

          <Section title="Benefits, Assets, and Governance" icon={<HeartHandshake className="h-5 w-5 text-primary" />}>
            <div className="space-y-6">
              <div>
                <h4 className="mb-2 text-sm font-semibold">Benefits Dependents</h4>
                <EntryRows entries={dependentRows as Array<Record<string, unknown>>} />
              </div>
              <div>
                <h4 className="mb-2 text-sm font-semibold">Beneficiaries</h4>
                <EntryRows entries={beneficiaryRows as Array<Record<string, unknown>>} />
              </div>
              <div>
                <h4 className="mb-2 flex items-center gap-2 text-sm font-semibold"><KeyRound className="h-4 w-4" /> Assets and Access Badges</h4>
                <EntryRows entries={[...(assetRows as Array<Record<string, unknown>>), ...(badgeRows as Array<Record<string, unknown>>)]} />
              </div>
              <div>
                <h4 className="mb-2 text-sm font-semibold">Consents and Privacy Notices</h4>
                <EntryRows entries={[...(consentRows as Array<Record<string, unknown>>), ...(privacyRows as Array<Record<string, unknown>>)]} />
              </div>
              <div>
                <h4 className="mb-2 text-sm font-semibold">Retention Holds</h4>
                <EntryRows entries={retentionRows as Array<Record<string, unknown>>} />
              </div>
              <div>
                <h4 className="mb-2 flex items-center gap-2 text-sm font-semibold"><ClipboardList className="h-4 w-4" /> Custom and Local Fields</h4>
                {Object.keys(customFields).length ? (
                  <EntryRows entries={[customFields]} />
                ) : (
                  <p className="border-t py-4 text-sm text-muted-foreground">No custom fields captured.</p>
                )}
              </div>
            </div>
          </Section>

          <Section title="Audit Trail" icon={<ShieldCheck className="h-5 w-5 text-primary" />}>
            <AuditTrail resourceType="WORKER" resourceId={worker.id} />
          </Section>
        </main>

        <aside className="space-y-6 border-l px-5 py-6">
          <section className="space-y-4">
            <h3 className="flex items-center gap-2 text-lg font-semibold">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Expiry Watch
            </h3>
            <div className="divide-y border-y">
              {expiryAlerts.length ? expiryAlerts.slice(0, 8).map((alert, index) => (
                <div key={`${firstValue(alert, ['id', 'source', 'label'])}-${index}`} className="py-3">
                  <p className="text-sm font-medium">{firstValue(alert, ['label', 'documentType', 'type', 'source'])}</p>
                  <p className="text-xs text-muted-foreground">
                    {firstValue(alert, ['expiryDate', 'expiresAt', 'validUntil'])} - {firstValue(alert, ['severity', 'status', 'daysUntilExpiry'])}
                  </p>
                </div>
              )) : (
                <p className="py-3 text-sm text-muted-foreground">No expiring documents or registrations found.</p>
              )}
            </div>
          </section>

          <section className="space-y-4">
            <h3 className="text-lg font-semibold">Governance</h3>
            <AllowedActions aggregateType="WORKER" aggregateId={worker.id} state={worker.status} />
            <div className="divide-y border-y">
              {governance.personalDataRecords.map((record) => (
                <div key={record.id} className="py-3">
                  <p className="text-sm font-medium">{record.dataCategory}</p>
                  <p className="text-xs text-muted-foreground">{record.dataClassification} - {record.consentStatus} - {record.state}</p>
                </div>
              ))}
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}

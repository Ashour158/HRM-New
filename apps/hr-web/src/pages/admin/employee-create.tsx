import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  Camera,
  CheckCircle2,
  Contact,
  DollarSign,
  FileText,
  GraduationCap,
  HeartHandshake,
  Landmark,
  MapPin,
  Network,
  ShieldCheck,
  Users,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useApiMutation, useApiQuery } from '@/hooks/use-api';
import { useAuth } from '@/hooks/use-auth';
import { useUIStore } from '@/stores/ui-store';
import { DEFAULT_HCM_SETUP } from '@/lib/hcm-setup-defaults';
import { isCustomFieldRuleKey } from '@/lib/custom-fields';
import { TextField } from '@/components/admin/text-field';
import { DynamicFieldInput } from '@/components/admin/dynamic-field-input';
import type {
  EmployeeDuplicateCheckResult,
  HcmSetupConfig,
  OrgUnit,
  Worker,
} from '@/types';

type ProfileEntry = Record<string, string>;
type EmergencyContactEntry = {
  name: string;
  relationship: string;
  phoneNumber: string;
  email: string;
};
type AttachmentMeta = {
  type: string;
  requirementCode?: string;
  requirementLabel?: string;
  fileName: string;
  mimeType: string;
  size: number;
  addedAt: string;
  dataUrl?: string;
};

interface EmployeeCreateForm {
  employeeIdMode: 'AUTO' | 'MANUAL';
  employeeNumber: string;
  firstName: string;
  lastName: string;
  gender: string;
  email: string;
  personalEmail: string;
  workEmail: string;
  phoneNumber: string;
  workPhoneNumber: string;
  dateOfBirth: string;
  photoPreviewUrl: string;
  photoAttachment?: AttachmentMeta;
  workLocationCode: string;
  addressType: string;
  addressLine1: string;
  addressLine2: string;
  building: string;
  floor: string;
  apartment: string;
  district: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  cityCode: string;
  emergencyContactName: string;
  emergencyContactRelationship: string;
  emergencyContactPhone: string;
  emergencyContactEmail: string;
  emergencyContacts: EmergencyContactEntry[];
  linkedIn: string;
  portfolio: string;
  facebook: string;
  instagram: string;
  hireDate: string;
  employmentType: string;
  jobTitle: string;
  departmentId: string;
  departmentName: string;
  managerId: string;
  dottedLineManagerId: string;
  hrbpId: string;
  mentorId: string;
  colleagueIds: string[];
  grossSalaryAmount: string;
  taxAmount: string;
  insuranceAmount: string;
  netSalaryAmount: string;
  medicalInsuranceAmount: string;
  otherBenefitsAmount: string;
  benefitsNotes: string;
  salaryCurrency: string;
  salaryBasis: string;
  payFrequency: string;
  workAuthorizationCountry: string;
  workAuthorizationStatus: string;
  visaStatus: string;
  visaType: string;
  visaExpiryDate: string;
  workPermitNumber: string;
  taxIdentifier: string;
  socialInsuranceNumber: string;
  bankName: string;
  bankAccountHolderName: string;
  bankAccountNumber: string;
  iban: string;
  bankRoutingNumber: string;
  bankSwiftCode: string;
  education: ProfileEntry[];
  experience: ProfileEntry[];
  certifications: ProfileEntry[];
  dependents: ProfileEntry[];
  beneficiaries: ProfileEntry[];
  assets: ProfileEntry[];
  accessBadges: ProfileEntry[];
  skills: ProfileEntry[];
  licenses: ProfileEntry[];
  careerPreferences: ProfileEntry;
  consents: ProfileEntry[];
  privacyNotices: ProfileEntry[];
  retentionHolds: ProfileEntry[];
  employmentContractTemplate: string;
  employmentContractStatus: string;
  employmentContractStartDate: string;
  employmentContractEndDate: string;
  selectedDocumentRequirementCode: string;
  documents: AttachmentMeta[];
  customFieldValues: Record<string, unknown>;
}

interface CreateEmployeeResult {
  workerId: string;
  status: string;
}

const steps = [
  { id: 'identity', label: 'Identity', icon: Contact },
  { id: 'address', label: 'Address', icon: MapPin },
  { id: 'organization', label: 'Organization', icon: Network },
  { id: 'compensation', label: 'Compensation', icon: DollarSign },
  { id: 'payroll', label: 'Payroll & Work', icon: Landmark },
  { id: 'background', label: 'Talent', icon: GraduationCap },
  { id: 'benefitsAccess', label: 'Benefits & Access', icon: HeartHandshake },
  { id: 'documents', label: 'Documents', icon: FileText },
  { id: 'review', label: 'Review', icon: ShieldCheck },
];

const emptyEntry = (): ProfileEntry => ({ title: '', organization: '', startDate: '', endDate: '', notes: '' });
const emptyEmergencyContact = (): EmergencyContactEntry => ({ name: '', relationship: '', phoneNumber: '', email: '' });
const emptyDependent = (): ProfileEntry => ({ name: '', relationship: '', dateOfBirth: '', coverageLevel: '', notes: '' });
const emptyBeneficiary = (): ProfileEntry => ({ name: '', relationship: '', allocationPercent: '', phoneNumber: '', notes: '' });
const emptyAsset = (): ProfileEntry => ({ type: '', identifier: '', issuedOn: '', owner: '', notes: '' });
const emptySkill = (): ProfileEntry => ({ name: '', level: '', years: '', preference: '', notes: '' });
const emptyConsent = (): ProfileEntry => ({ noticeCode: '', version: '', accepted: '', acceptedAt: '', notes: '' });

const initialForm: EmployeeCreateForm = {
  employeeIdMode: 'AUTO',
  employeeNumber: '',
  firstName: '',
  lastName: '',
  gender: '',
  email: '',
  personalEmail: '',
  workEmail: '',
  phoneNumber: '',
  workPhoneNumber: '',
  dateOfBirth: '',
  photoPreviewUrl: '',
  workLocationCode: '',
  addressType: 'HOME',
  addressLine1: '',
  addressLine2: '',
  building: '',
  floor: '',
  apartment: '',
  district: '',
  city: '',
  state: '',
  postalCode: '',
  country: '',
  cityCode: '',
  emergencyContactName: '',
  emergencyContactRelationship: '',
  emergencyContactPhone: '',
  emergencyContactEmail: '',
  emergencyContacts: [emptyEmergencyContact()],
  linkedIn: '',
  portfolio: '',
  facebook: '',
  instagram: '',
  hireDate: new Date().toISOString().slice(0, 10),
  employmentType: 'FULL_TIME',
  jobTitle: '',
  departmentId: 'none',
  departmentName: '',
  managerId: 'none',
  dottedLineManagerId: 'none',
  hrbpId: 'none',
  mentorId: 'none',
  colleagueIds: [],
  grossSalaryAmount: '',
  taxAmount: '',
  insuranceAmount: '',
  netSalaryAmount: '',
  medicalInsuranceAmount: '',
  otherBenefitsAmount: '',
  benefitsNotes: '',
  salaryCurrency: 'USD',
  salaryBasis: 'ANNUAL',
  payFrequency: 'MONTHLY',
  workAuthorizationCountry: '',
  workAuthorizationStatus: '',
  visaStatus: '',
  visaType: '',
  visaExpiryDate: '',
  workPermitNumber: '',
  taxIdentifier: '',
  socialInsuranceNumber: '',
  bankName: '',
  bankAccountHolderName: '',
  bankAccountNumber: '',
  iban: '',
  bankRoutingNumber: '',
  bankSwiftCode: '',
  education: [emptyEntry()],
  experience: [emptyEntry()],
  certifications: [emptyEntry()],
  dependents: [emptyDependent()],
  beneficiaries: [emptyBeneficiary()],
  assets: [emptyAsset()],
  accessBadges: [emptyAsset()],
  skills: [emptySkill()],
  licenses: [emptySkill()],
  careerPreferences: { preferredTrack: '', mobility: '', relocation: '', aspirations: '', notes: '' },
  consents: [emptyConsent()],
  privacyNotices: [emptyConsent()],
  retentionHolds: [{ reason: '', reference: '', startDate: '', endDate: '', notes: '' }],
  employmentContractTemplate: '',
  employmentContractStatus: 'DRAFT',
  employmentContractStartDate: '',
  employmentContractEndDate: '',
  selectedDocumentRequirementCode: '',
  documents: [],
  customFieldValues: {},
};

function cleanObject<T extends Record<string, unknown>>(value: T): Partial<T> | undefined {
  const cleaned = Object.fromEntries(
    Object.entries(value).filter(([, entry]) => {
      if (entry === undefined || entry === null || entry === '') return false;
      if (Array.isArray(entry)) return entry.length > 0;
      if (typeof entry === 'object') return Object.keys(entry as Record<string, unknown>).length > 0;
      return true;
    }),
  ) as Partial<T>;
  return Object.keys(cleaned).length > 0 ? cleaned : undefined;
}

function cleanEntries(entries: ProfileEntry[]) {
  return entries
    .map((entry) => cleanObject(entry))
    .filter((entry): entry is ProfileEntry => Boolean(entry));
}

function sameIds(left: string[], right: string[]) {
  return left.length === right.length && left.every((id, index) => id === right[index]);
}

function moneyValue(value: string) {
  return value ? Number(value) : undefined;
}

function stepIdForRuleSection(section: string) {
  const normalized = section.toLowerCase();
  if (normalized.includes('identity')) return 'identity';
  if (normalized.includes('organization')) return 'organization';
  if (normalized.includes('payroll') || normalized.includes('compliance')) return 'payroll';
  if (normalized.includes('benefit') || normalized.includes('access') || normalized.includes('governance')) return 'benefitsAccess';
  if (normalized.includes('talent')) return 'background';
  if (normalized.includes('document')) return 'documents';
  return 'identity';
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function flagEmoji(countryCode?: string) {
  if (!countryCode || !/^[A-Z]{2}$/.test(countryCode)) return countryCode ?? '';
  return String.fromCodePoint(...countryCode.split('').map((char) => char.charCodeAt(0) + 127397));
}

function EntryList({
  title,
  entries,
  onChange,
  onAdd,
}: {
  title: string;
  entries: ProfileEntry[];
  onChange: (entries: ProfileEntry[]) => void;
  onAdd: () => void;
}) {
  return (
    <section className="space-y-4 border-t py-6">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold">{title}</h3>
        <Button type="button" variant="outline" size="sm" onClick={onAdd}>
          Add
        </Button>
      </div>
      <div className="space-y-4">
        {entries.map((entry, index) => (
          <div key={index} className="grid gap-4 md:grid-cols-5">
            <TextField
              label="Title"
              value={entry.title ?? ''}
              onChange={(value) => onChange(entries.map((item, itemIndex) => itemIndex === index ? { ...item, title: value } : item))}
            />
            <TextField
              label="Organization"
              value={entry.organization ?? ''}
              onChange={(value) => onChange(entries.map((item, itemIndex) => itemIndex === index ? { ...item, organization: value } : item))}
            />
            <TextField
              label="Start"
              type="date"
              value={entry.startDate ?? ''}
              onChange={(value) => onChange(entries.map((item, itemIndex) => itemIndex === index ? { ...item, startDate: value } : item))}
            />
            <TextField
              label="End"
              type="date"
              value={entry.endDate ?? ''}
              onChange={(value) => onChange(entries.map((item, itemIndex) => itemIndex === index ? { ...item, endDate: value } : item))}
            />
            <TextField
              label="Notes"
              value={entry.notes ?? ''}
              onChange={(value) => onChange(entries.map((item, itemIndex) => itemIndex === index ? { ...item, notes: value } : item))}
            />
          </div>
        ))}
      </div>
    </section>
  );
}

function StructuredEntryList({
  title,
  entries,
  fields,
  onChange,
  onAdd,
}: {
  title: string;
  entries: ProfileEntry[];
  fields: Array<{ key: string; label: string; type?: string }>;
  onChange: (entries: ProfileEntry[]) => void;
  onAdd: () => void;
}) {
  return (
    <section className="space-y-4 border-t py-6">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold">{title}</h3>
        <Button type="button" variant="outline" size="sm" onClick={onAdd}>
          Add
        </Button>
      </div>
      <div className="space-y-4">
        {entries.map((entry, index) => (
          <div key={index} className="grid gap-4 md:grid-cols-5">
            {fields.map((field) => (
              <TextField
                key={field.key}
                label={field.label}
                type={field.type}
                value={entry[field.key] ?? ''}
                onChange={(value) =>
                  onChange(entries.map((item, itemIndex) => itemIndex === index ? { ...item, [field.key]: value } : item))
                }
              />
            ))}
          </div>
        ))}
      </div>
    </section>
  );
}

function flattenOrgTree(nodes: OrgUnit[], depth = 0): Array<OrgUnit & { depth: number }> {
  return nodes.flatMap((node) => [
    { ...node, depth },
    ...flattenOrgTree((node as OrgUnit & { children?: OrgUnit[] }).children ?? [], depth + 1),
  ]);
}

function workerName(worker: Worker) {
  return `${worker.firstName} ${worker.lastName}`.trim();
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(reader.error ?? new Error('Unable to read file'));
    reader.readAsDataURL(file);
  });
}

export function AdminEmployeeCreate() {
  const navigate = useNavigate();
  const { roles } = useAuth();
  const addNotification = useUIStore((state) => state.addNotification);
  const [activeStep, setActiveStep] = React.useState(0);
  const [form, setForm] = React.useState<EmployeeCreateForm>(initialForm);
  const [duplicateResult, setDuplicateResult] = React.useState<EmployeeDuplicateCheckResult | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const { data: setupConfig = DEFAULT_HCM_SETUP } = useApiQuery<HcmSetupConfig>(['hcm-setup'], '/admin/hcm-setup');
  const { data: orgTree = [] } = useApiQuery<OrgUnit[]>(['org-tree'], '/hr/organization/org-units/tree');
  const { data: workers = [] } = useApiQuery<Worker[]>(['employee-options'], '/hr/core/workers?pageSize=100');
  const departments = React.useMemo(() => flattenOrgTree(orgTree), [orgTree]);
  const activeGenders = setupConfig.genderOptions.filter((option) => option.active);
  const activeLocations = setupConfig.locations.filter((location) => location.active);
  const activeCities = setupConfig.cities.filter((city) => city.active);
  const activeJobTitles = setupConfig.jobTitles.filter((jobTitle) => jobTitle.active);
  const activeDepartments = setupConfig.departments.filter((department) => department.active);
  const activeDocumentRequirements = setupConfig.documentRequirements.filter((document) => document.active);
  const selectedWorkLocation = activeLocations.find((location) => location.code === form.workLocationCode);
  const selectedCity = activeCities.find((city) => city.code === form.cityCode);
  const selectedSetupDepartment = activeDepartments.find((department) => form.departmentId === `setup:${department.code}`);
  const filteredCities = selectedWorkLocation
    ? activeCities.filter((city) => city.countryCode === selectedWorkLocation.countryCode)
    : activeCities;
  const canAdminSetEmployeeId = roles.some((role) => ['APP_ADMIN', 'PLATFORM_ADMIN', 'SUPER_ADMIN'].includes(role.name));
  const idPolicy = setupConfig.employeeIdPolicy;
  const activeFieldRules = setupConfig.fieldRules.filter((rule) => rule.active);
  const manualIdVisible = idPolicy.mode !== 'AUTO';
  const canManuallySetEmployeeId = idPolicy.mode === 'MANUAL_ONLY' || canAdminSetEmployeeId;
  const employeeIdBadge = idPolicy.mode === 'AUTO'
    ? `Auto ${idPolicy.prefix ?? 'EMP'}`
    : idPolicy.mode === 'MANUAL_WITH_APP_ADMIN'
      ? 'Manual by app admin'
      : 'Manual employee ID';
  const isRequired = (fieldKey: string) => activeFieldRules.some((rule) => rule.fieldKey === fieldKey && rule.required);
  const customFieldRules = React.useMemo(
    () => activeFieldRules.filter((rule) => isCustomFieldRuleKey(rule.fieldKey)),
    [activeFieldRules],
  );
  const fieldRuleValue = (fieldKey: string) => {
    if (fieldKey === 'department') return form.departmentId !== 'none' ? form.departmentId : form.departmentName;
    if (fieldKey === 'workAuthorization') return cleanObject({
      country: form.workAuthorizationCountry,
      status: form.workAuthorizationStatus,
      visaStatus: form.visaStatus,
      visaType: form.visaType,
      visaExpiryDate: form.visaExpiryDate,
      workPermitNumber: form.workPermitNumber,
    });
    if (fieldKey === 'taxProfile') return cleanObject({ taxIdentifier: form.taxIdentifier, socialInsuranceNumber: form.socialInsuranceNumber });
    if (fieldKey === 'bankAccount') return cleanObject({
      bankName: form.bankName,
      bankAccountNumber: form.bankAccountNumber,
      iban: form.iban,
      routingNumber: form.bankRoutingNumber,
    });
    if (fieldKey === 'employmentContract') return cleanObject({
      templateCode: form.employmentContractTemplate,
      status: form.employmentContractStatus,
      startDate: form.employmentContractStartDate,
      endDate: form.employmentContractEndDate,
    });
    if (isCustomFieldRuleKey(fieldKey)) return form.customFieldValues[fieldKey];
    return (form as unknown as Record<string, unknown>)[fieldKey];
  };
  const missingRequiredFieldRules = activeFieldRules.filter((rule) => {
    if (!rule.required) return false;
    const value = fieldRuleValue(rule.fieldKey);
    if (value === undefined || value === null || value === '') return true;
    if (Array.isArray(value)) return value.length === 0 || cleanEntries(value as ProfileEntry[]).length === 0;
    if (typeof value === 'object') return Object.keys(value as Record<string, unknown>).length === 0;
    return false;
  });

  React.useEffect(() => {
    return () => {
      if (form.photoPreviewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(form.photoPreviewUrl);
      }
    };
  }, [form.photoPreviewUrl]);

  React.useEffect(() => {
    setForm((current) => {
      const employeeIdMode = idPolicy.mode === 'AUTO' ? 'AUTO' : 'MANUAL';
      const selectedDocumentRequirementCode =
        current.selectedDocumentRequirementCode || activeDocumentRequirements[0]?.code || '';
      if (
        current.employeeIdMode === employeeIdMode &&
        current.selectedDocumentRequirementCode === selectedDocumentRequirementCode
      ) {
        return current;
      }
      return {
        ...current,
        employeeIdMode,
        employeeNumber: employeeIdMode === 'AUTO' ? '' : current.employeeNumber,
        selectedDocumentRequirementCode,
      };
    });
  }, [activeDocumentRequirements, idPolicy.mode]);

  const selectedDepartment = departments.find((department) => department.id === form.departmentId);
  const sameDepartmentPeers = React.useMemo(() => {
    if (selectedDepartment) {
      return workers.filter((worker) =>
        worker.departmentId === selectedDepartment.id || worker.departmentName === selectedDepartment.name,
      );
    }
    if (selectedSetupDepartment) {
      return workers.filter((worker) => worker.departmentName === selectedSetupDepartment.label);
    }
    return [];
  }, [selectedDepartment, selectedSetupDepartment, workers]);

  React.useEffect(() => {
    const peerIds = sameDepartmentPeers.map((worker) => worker.id);
    setForm((current) => sameIds(current.colleagueIds, peerIds) ? current : { ...current, colleagueIds: peerIds });
  }, [sameDepartmentPeers]);

  const update = <K extends keyof EmployeeCreateForm>(key: K, value: EmployeeCreateForm[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
    setDuplicateResult(null);
    setError(null);
  };

  const updateMany = (patch: Partial<EmployeeCreateForm>) => {
    setForm((current) => ({ ...current, ...patch }));
    setDuplicateResult(null);
    setError(null);
  };

  const updateCompensation = (
    key: 'grossSalaryAmount' | 'taxAmount' | 'insuranceAmount' | 'netSalaryAmount' | 'medicalInsuranceAmount' | 'otherBenefitsAmount' | 'benefitsNotes',
    value: string,
  ) => {
    setForm((current) => {
      const next = { ...current, [key]: value };
      if (key === 'grossSalaryAmount' && next.grossSalaryAmount) {
        const gross = Number(next.grossSalaryAmount || 0);
        const tax = Math.round(gross * setupConfig.payrollCalculationPolicy.taxRatePercent) / 100;
        const insurance = Math.round(gross * setupConfig.payrollCalculationPolicy.employeeInsuranceRatePercent) / 100;
        next.taxAmount = String(tax);
        next.insuranceAmount = String(insurance);
        next.netSalaryAmount = String(Math.max(gross - tax - insurance, 0));
      }
      return next;
    });
    setError(null);
  };

  const duplicateMutation = useApiMutation<EmployeeDuplicateCheckResult, Partial<EmployeeCreateForm>>(
    '/hr/core/workers/duplicate-check',
    'post',
  );

  const createMutation = useApiMutation<CreateEmployeeResult, Record<string, unknown>>(
    '/hr/core/workers',
    'post',
    [['admin-workers']],
  );

  const onPhotoChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (form.photoPreviewUrl.startsWith('blob:')) URL.revokeObjectURL(form.photoPreviewUrl);
    const dataUrl = await readFileAsDataUrl(file);
    update('photoPreviewUrl', dataUrl);
    update('photoAttachment', {
      type: 'PROFILE_PHOTO',
      fileName: file.name,
      mimeType: file.type,
      size: file.size,
      addedAt: new Date().toISOString(),
      dataUrl,
    });
  };

  const onDocumentsChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    if (files.length === 0) return;
    const requirement = activeDocumentRequirements.find((document) => document.code === form.selectedDocumentRequirementCode);
    if (!requirement) return;
    const attachments = await Promise.all(
      files.map(async (file) => ({
        type: requirement.code,
        requirementCode: requirement.code,
        requirementLabel: requirement.label,
        fileName: file.name,
        mimeType: file.type,
        size: file.size,
        addedAt: new Date().toISOString(),
        dataUrl: await readFileAsDataUrl(file),
      })),
    );
    update('documents', [
      ...(requirement?.allowMultiple === false
        ? form.documents.filter((document) => document.requirementCode !== requirement.code && document.type !== requirement.code)
        : form.documents),
      ...attachments,
    ]);
  };

  const runDuplicateCheck = async () => {
    try {
      const result = await duplicateMutation.mutateAsync({
        employeeNumber: form.employeeIdMode === 'MANUAL' ? form.employeeNumber || undefined : undefined,
        firstName: form.firstName || undefined,
        lastName: form.lastName || undefined,
        email: form.workEmail || form.personalEmail || form.email || undefined,
        personalEmail: form.personalEmail || undefined,
        workEmail: form.workEmail || undefined,
        phoneNumber: form.phoneNumber || undefined,
        workPhoneNumber: form.workPhoneNumber || undefined,
      });
      setDuplicateResult(result);
      addNotification({
        title: result.exactMatches.length ? 'Duplicates found' : 'No duplicates found',
        message: result.exactMatches.length
          ? `${result.exactMatches.length} exact match(es) must be resolved before creating.`
          : 'No exact duplicate identity data was detected.',
        type: result.exactMatches.length ? 'warning' : 'success',
        read: false,
      });
      return result;
    } catch (err) {
      addNotification({
        title: 'Duplicate check failed',
        message: err instanceof Error ? err.message : 'Could not run the duplicate check.',
        type: 'error',
        read: false,
      });
      return undefined;
    }
  };

  const needsDepartment = form.departmentId === 'none';
  const missingRequiredDocuments = activeDocumentRequirements.filter((requirement) =>
    requirement.required &&
    !form.documents.some((document) => document.requirementCode === requirement.code || document.type === requirement.code),
  );
  const needsManualEmployeeId = form.employeeIdMode === 'MANUAL' && manualIdVisible && !form.employeeNumber.trim();
  const canContinueIdentity = Boolean(
    form.firstName.trim() &&
    form.lastName.trim() &&
    (!form.personalEmail || form.personalEmail.includes('@')) &&
    (!form.workEmail || form.workEmail.includes('@')) &&
    (!isRequired('personalEmail') || form.personalEmail.includes('@')) &&
    (!isRequired('workEmail') || form.workEmail.includes('@')),
  );
  const canSubmit = Boolean(
    canContinueIdentity &&
    !needsDepartment &&
    !needsManualEmployeeId &&
    missingRequiredDocuments.length === 0 &&
    missingRequiredFieldRules.length === 0,
  );

  const next = async () => {
    if (activeStep === steps.length - 2) {
      await runDuplicateCheck();
    }
    setActiveStep((current) => Math.min(current + 1, steps.length - 1));
  };

  const submit = async () => {
    setError(null);
    if (missingRequiredFieldRules.length > 0) {
      const firstMissing = missingRequiredFieldRules[0];
      setError(`Required Admin Settings field is missing: ${firstMissing.label}`);
      const targetStep = steps.findIndex((step) => step.id === stepIdForRuleSection(firstMissing.section));
      setActiveStep(targetStep >= 0 ? targetStep : 0);
      return;
    }
    if (needsDepartment) {
      setError('Department is required. Select one from the organization chart or Admin Settings.');
      setActiveStep(steps.findIndex((step) => step.id === 'organization'));
      return;
    }
    if (needsManualEmployeeId) {
      setError('Manual Employee ID is required by the current employee ID policy.');
      setActiveStep(0);
      return;
    }
    if (missingRequiredDocuments.length > 0) {
      setError(`Required hiring credentials are missing: ${missingRequiredDocuments.map((document) => document.label).join(', ')}`);
      setActiveStep(steps.findIndex((step) => step.id === 'documents'));
      return;
    }
    const duplicates = duplicateResult ?? await runDuplicateCheck();
    if (!duplicates) {
      setError('Could not verify duplicate identity data. Please run the duplicate check and try again.');
      setActiveStep(steps.length - 1);
      return;
    }
    if (!duplicates.canCreate) {
      setError('Exact duplicate data must be resolved before this employee can be created.');
      setActiveStep(steps.length - 1);
      return;
    }

    const address = cleanObject({
      type: form.addressType,
      line1: form.addressLine1,
      line2: form.addressLine2,
      building: form.building,
      floor: form.floor,
      apartment: form.apartment,
      district: form.district,
      city: form.city,
      state: form.state,
      postalCode: form.postalCode,
      country: form.country,
      cityCode: form.cityCode,
      workLocationCode: form.workLocationCode,
    });
    const emergencyContacts = form.emergencyContacts
      .map((contact) => cleanObject(contact))
      .filter((contact): contact is Record<string, string> => Boolean(contact));
    const emergencyContact = emergencyContacts[0] ?? cleanObject({
      name: form.emergencyContactName,
      relationship: form.emergencyContactRelationship,
      phoneNumber: form.emergencyContactPhone,
      email: form.emergencyContactEmail,
    });
    const socialLinks = cleanObject({
      linkedIn: form.linkedIn,
      portfolio: form.portfolio,
      facebook: form.facebook,
      instagram: form.instagram,
    });
    const departmentName = selectedDepartment?.name ?? selectedSetupDepartment?.label;
    const workAuthorization = cleanObject({
      countryCode: form.workAuthorizationCountry,
      status: form.workAuthorizationStatus,
      visaStatus: form.visaStatus,
      visaType: form.visaType,
      visaExpiryDate: form.visaExpiryDate,
      workPermitNumber: form.workPermitNumber,
    });
    const taxProfile = cleanObject({
      taxIdentifier: form.taxIdentifier,
      socialInsuranceNumber: form.socialInsuranceNumber,
    });
    const bankAccount = cleanObject({
      bankName: form.bankName,
      accountHolderName: form.bankAccountHolderName,
      accountNumber: form.bankAccountNumber,
      iban: form.iban,
      routingNumber: form.bankRoutingNumber,
      swiftCode: form.bankSwiftCode,
    });
    const employmentContract = cleanObject({
      templateCode: form.employmentContractTemplate,
      status: form.employmentContractStatus,
      startDate: form.employmentContractStartDate,
      endDate: form.employmentContractEndDate,
      sourceProcess: 'HIRING',
      documentRequirementCode: 'EMPLOYMENT_CONTRACT',
    });

    try {
    const result = await createMutation.mutateAsync({
      employeeNumber: form.employeeIdMode === 'MANUAL' && canManuallySetEmployeeId ? form.employeeNumber || undefined : undefined,
      firstName: form.firstName,
      lastName: form.lastName,
      gender: form.gender || undefined,
      email: form.workEmail || form.personalEmail || form.email || undefined,
      personalEmail: form.personalEmail || undefined,
      workEmail: form.workEmail || undefined,
      phoneNumber: form.phoneNumber || undefined,
      workPhoneNumber: form.workPhoneNumber || undefined,
      photoAttachment: form.photoAttachment,
      dateOfBirth: form.dateOfBirth || undefined,
      hireDate: form.hireDate || undefined,
      employmentType: form.employmentType,
      jobTitle: form.jobTitle || undefined,
      departmentId: form.departmentId !== 'none' && !form.departmentId.startsWith('setup:') ? form.departmentId : undefined,
      departmentName,
      managerId: form.managerId !== 'none' ? form.managerId : undefined,
      dottedLineManagerId: form.dottedLineManagerId !== 'none' ? form.dottedLineManagerId : undefined,
      hrbpId: form.hrbpId !== 'none' ? form.hrbpId : undefined,
      mentorId: form.mentorId !== 'none' ? form.mentorId : undefined,
      colleagueIds: form.colleagueIds.length > 0 ? form.colleagueIds : undefined,
      salaryAmount: moneyValue(form.grossSalaryAmount),
      grossSalaryAmount: moneyValue(form.grossSalaryAmount),
      taxAmount: moneyValue(form.taxAmount),
      insuranceAmount: moneyValue(form.insuranceAmount),
      netSalaryAmount: moneyValue(form.netSalaryAmount),
      medicalInsuranceAmount: moneyValue(form.medicalInsuranceAmount),
      otherBenefitsAmount: moneyValue(form.otherBenefitsAmount),
      salaryCurrency: form.salaryCurrency || undefined,
      salaryBasis: form.salaryBasis || undefined,
      payFrequency: form.payFrequency || undefined,
      benefitsPackage: cleanObject({
        medicalInsuranceAmount: moneyValue(form.medicalInsuranceAmount),
        otherBenefitsAmount: moneyValue(form.otherBenefitsAmount),
        notes: form.benefitsNotes,
      }),
      address,
      workLocation: selectedWorkLocation,
      emergencyContact,
      emergencyContacts,
      socialLinks,
      education: cleanEntries(form.education),
      experience: cleanEntries(form.experience),
      certifications: cleanEntries(form.certifications),
      workAuthorization,
      taxProfile,
      bankAccount,
      dependents: cleanEntries(form.dependents),
      beneficiaries: cleanEntries(form.beneficiaries),
      assets: cleanEntries(form.assets),
      accessBadges: cleanEntries(form.accessBadges),
      skills: cleanEntries(form.skills),
      licenses: cleanEntries(form.licenses),
      careerPreferences: cleanObject(form.careerPreferences),
      consents: cleanEntries(form.consents),
      privacyNotices: cleanEntries(form.privacyNotices),
      retentionHolds: cleanEntries(form.retentionHolds),
      employmentContract,
      documents: form.documents,
      customFieldValues: cleanObject(form.customFieldValues),
    });
    addNotification({
      title: 'Employee created',
      message: `${form.firstName} ${form.lastName}`.trim() + ' has been added successfully.',
      type: 'success',
      read: false,
    });
    navigate(`/admin/employees/${result.workerId}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not create the employee record.';
      setError(message);
      addNotification({ title: 'Employee creation failed', message, type: 'error', read: false });
    }
  };

  const current = steps[activeStep];
  const displayName = `${form.firstName || 'New'} ${form.lastName || 'Employee'}`.trim();
  const customFieldRulesForStep = customFieldRules.filter((rule) => stepIdForRuleSection(rule.section) === current.id);

  return (
    <div className="-m-4 min-h-[calc(100vh-7rem)] space-y-6 px-6 py-6">
      <div className="fusion-glass rounded-[2rem] px-6 py-5">
        <Button variant="ghost" size="sm" onClick={() => navigate('/admin/employees')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Employees
        </Button>
        <div className="mt-5 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex items-center gap-5">
            <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full border bg-muted text-lg font-semibold">
              {form.photoPreviewUrl ? (
                <img src={form.photoPreviewUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <Camera className="h-7 w-7 text-muted-foreground" />
              )}
            </div>
            <div>
              <h2 className="text-3xl font-bold fusion-gradient-text">{displayName}</h2>
              <p className="text-muted-foreground">{current.label} profile intake</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <Badge variant="secondary">Draft</Badge>
                <Badge variant="outline">{employeeIdBadge}</Badge>
                {selectedWorkLocation ? <Badge variant="outline">{flagEmoji(selectedWorkLocation.countryCode)} {selectedWorkLocation.label}</Badge> : null}
                {selectedDepartment || selectedSetupDepartment ? <Badge variant="outline">{selectedDepartment?.name ?? selectedSetupDepartment?.label}</Badge> : null}
              </div>
            </div>
          </div>
          <Badge variant="secondary">{current.label}</Badge>
        </div>

        <nav className="mt-6 flex gap-2 overflow-x-auto border-t pt-4">
          {steps.map((step, index) => {
            const Icon = step.icon;
            return (
              <button
                key={step.id}
                type="button"
                onClick={() => setActiveStep(index)}
                className={`flex min-w-fit items-center gap-2 rounded-md px-3 py-2 text-sm ${
                  index === activeStep ? 'bg-primary text-primary-foreground' : 'border hover:bg-muted'
                }`}
              >
                <Icon className="h-4 w-4" />
                {step.label}
              </button>
            );
          })}
        </nav>
      </div>

      <main className="fusion-glass rounded-[2rem] px-6 py-6">
        {activeStep === 0 && (
          <section className="max-w-6xl space-y-6">
            <div>
              <h3 className="text-xl font-semibold">Identity</h3>
              <p className="text-sm text-muted-foreground">Names, identifiers, photo attachment, and primary contact points.</p>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              <TextField label="First Name" value={form.firstName} onChange={(value) => update('firstName', value)} required={isRequired('firstName')} />
              <TextField label="Last Name" value={form.lastName} onChange={(value) => update('lastName', value)} required={isRequired('lastName')} />
              <div className="grid gap-2">
                <Label>Gender</Label>
                <Select value={form.gender || 'none'} onValueChange={(value) => update('gender', value === 'none' ? '' : value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select gender" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Not specified</SelectItem>
                    {activeGenders.map((option) => (
                      <SelectItem key={option.code} value={option.value}>{option.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Employee ID Policy</Label>
                <Select
                  value={form.employeeIdMode}
                  onValueChange={(value) => update('employeeIdMode', value as 'AUTO' | 'MANUAL')}
                  disabled={idPolicy.mode !== 'MANUAL_WITH_APP_ADMIN'}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="AUTO">Auto-generate by app policy</SelectItem>
                    <SelectItem value="MANUAL" disabled={!manualIdVisible || !canManuallySetEmployeeId}>
                      {idPolicy.mode === 'MANUAL_WITH_APP_ADMIN' ? 'Manual ID (App Admin only)' : 'Manual ID'}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {manualIdVisible ? (
                <TextField
                  label="Manual Employee ID"
                  value={form.employeeNumber}
                  onChange={(value) => update('employeeNumber', value)}
                  placeholder={canManuallySetEmployeeId ? 'EMP-2026-001' : 'Restricted to App Admin'}
                  disabled={form.employeeIdMode !== 'MANUAL' || !canManuallySetEmployeeId}
                />
              ) : (
                <div className="grid gap-2">
                  <Label>Generated Employee ID</Label>
                  <Input value={`${idPolicy.prefix ?? 'EMP'}-${idPolicy.nextNumber ?? 'next'}`} disabled />
                </div>
              )}
              <TextField
                label="Personal Email"
                type="email"
                value={form.personalEmail}
                onChange={(value) => update('personalEmail', value)}
                required={isRequired('personalEmail')}
              />
              <TextField
                label="Work Email"
                type="email"
                value={form.workEmail}
                onChange={(value) => update('workEmail', value)}
                required={isRequired('workEmail')}
              />
              <TextField label="Personal Phone" value={form.phoneNumber} onChange={(value) => update('phoneNumber', value)} required={isRequired('phoneNumber')} />
              {setupConfig.workPhoneEnabled ? (
                <TextField label="Work Phone" value={form.workPhoneNumber} onChange={(value) => update('workPhoneNumber', value)} required={isRequired('workPhoneNumber')} />
              ) : null}
              <TextField label="Date of Birth" type="date" value={form.dateOfBirth} onChange={(value) => update('dateOfBirth', value)} />
              <div className="grid gap-2 md:col-span-2">
                <Label htmlFor="employee-photo">Profile Photo</Label>
                <Input id="employee-photo" type="file" accept="image/*" onChange={onPhotoChange} />
                {form.photoAttachment ? (
                  <p className="text-xs text-muted-foreground">
                    Attached {form.photoAttachment.fileName} ({formatFileSize(form.photoAttachment.size)})
                  </p>
                ) : null}
              </div>
            </div>
          </section>
        )}

        {activeStep === 1 && (
          <section className="max-w-6xl space-y-6">
            <div>
              <h3 className="text-xl font-semibold">Full Address</h3>
              <p className="text-sm text-muted-foreground">Residential address, emergency contact, and professional links.</p>
            </div>
            <div className="grid gap-4 md:grid-cols-4">
              <div className="grid gap-2 md:col-span-2">
                <Label>Work Place</Label>
                <Select
                  value={form.workLocationCode || 'none'}
                  onValueChange={(value) => {
                    const location = activeLocations.find((item) => item.code === value);
                    const city = location
                      ? activeCities.find((item) => item.countryCode === location.countryCode && item.label === location.city)
                      : undefined;
                    updateMany({
                      workLocationCode: value === 'none' ? '' : value,
                      cityCode: city?.code ?? form.cityCode,
                      city: location?.city ?? form.city,
                      country: location?.countryName ?? form.country,
                      salaryCurrency: location?.currency ?? form.salaryCurrency,
                    });
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select company location" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No workplace selected</SelectItem>
                    {activeLocations.map((location) => (
                      <SelectItem key={location.code} value={location.code}>
                        {flagEmoji(location.countryCode)} {location.label} - {location.city}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Address Type</Label>
                <Select value={form.addressType} onValueChange={(value) => update('addressType', value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="HOME">Home</SelectItem>
                    <SelectItem value="MAILING">Mailing</SelectItem>
                    <SelectItem value="TEMPORARY">Temporary</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <TextField label="Address Line 1" value={form.addressLine1} onChange={(value) => update('addressLine1', value)} />
              <TextField label="Address Line 2" value={form.addressLine2} onChange={(value) => update('addressLine2', value)} />
              <TextField label="Building" value={form.building} onChange={(value) => update('building', value)} />
              <TextField label="Floor" value={form.floor} onChange={(value) => update('floor', value)} />
              <TextField label="Apartment" value={form.apartment} onChange={(value) => update('apartment', value)} />
              <TextField label="District" value={form.district} onChange={(value) => update('district', value)} />
              <div className="grid gap-2">
                <Label>City</Label>
                <Select
                  value={form.cityCode || 'none'}
                  onValueChange={(value) => {
                    const city = filteredCities.find((item) => item.code === value);
                    updateMany({
                      cityCode: value === 'none' ? '' : value,
                      city: city?.label ?? '',
                      country: city ? city.countryCode : form.country,
                      salaryCurrency: city?.currency ?? form.salaryCurrency,
                    });
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select city" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Select city</SelectItem>
                    {filteredCities.map((city) => (
                      <SelectItem key={city.code} value={city.code}>
                        {flagEmoji(city.countryCode)} {city.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <TextField label="State / Region" value={form.state} onChange={(value) => update('state', value)} />
              <TextField label="Postal Code" value={form.postalCode} onChange={(value) => update('postalCode', value)} />
              <TextField label="Country" value={form.country || selectedWorkLocation?.countryName || selectedCity?.countryCode || ''} onChange={(value) => update('country', value)} />
            </div>
            <section className="border-t pt-6">
              <div className="mb-4 flex items-center justify-between gap-4">
                <h3 className="text-base font-semibold">Emergency Contacts</h3>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => update('emergencyContacts', [...form.emergencyContacts, emptyEmergencyContact()])}
                >
                  Add Contact
                </Button>
              </div>
              <div className="space-y-4">
                {form.emergencyContacts.map((contact, index) => (
                  <div key={index} className="grid gap-4 md:grid-cols-[1fr_1fr_1fr_1fr_5rem]">
                    <TextField
                      label="Name"
                      value={contact.name}
                      onChange={(value) => update('emergencyContacts', form.emergencyContacts.map((item, itemIndex) => itemIndex === index ? { ...item, name: value } : item))}
                    />
                    <TextField
                      label="Relationship"
                      value={contact.relationship}
                      onChange={(value) => update('emergencyContacts', form.emergencyContacts.map((item, itemIndex) => itemIndex === index ? { ...item, relationship: value } : item))}
                    />
                    <TextField
                      label="Phone"
                      value={contact.phoneNumber}
                      onChange={(value) => update('emergencyContacts', form.emergencyContacts.map((item, itemIndex) => itemIndex === index ? { ...item, phoneNumber: value } : item))}
                    />
                    <TextField
                      label="Email"
                      type="email"
                      value={contact.email}
                      onChange={(value) => update('emergencyContacts', form.emergencyContacts.map((item, itemIndex) => itemIndex === index ? { ...item, email: value } : item))}
                    />
                    <div className="flex items-end">
                      <Button
                        type="button"
                        variant="ghost"
                        disabled={form.emergencyContacts.length === 1}
                        onClick={() => update('emergencyContacts', form.emergencyContacts.filter((_, itemIndex) => itemIndex !== index))}
                      >
                        Remove
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
            <section className="border-t pt-6">
              <h3 className="mb-4 text-base font-semibold">Professional Links</h3>
              <div className="grid gap-4 md:grid-cols-4">
                <TextField label="LinkedIn" value={form.linkedIn} onChange={(value) => update('linkedIn', value)} />
                <TextField label="Portfolio" value={form.portfolio} onChange={(value) => update('portfolio', value)} />
                <TextField label="Facebook" value={form.facebook} onChange={(value) => update('facebook', value)} />
                <TextField label="Instagram" value={form.instagram} onChange={(value) => update('instagram', value)} />
              </div>
            </section>
          </section>
        )}

        {activeStep === 2 && (
          <section className="max-w-6xl space-y-6">
            <div>
              <h3 className="text-xl font-semibold">Organization Placement</h3>
              <p className="text-sm text-muted-foreground">Department is required and should come from the organization chart when available.</p>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              <TextField label="Hire Date" type="date" value={form.hireDate} onChange={(value) => update('hireDate', value)} />
              <div className="grid gap-2">
                <Label>Employment Type</Label>
                <Select value={form.employmentType} onValueChange={(value) => update('employmentType', value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="FULL_TIME">Full time</SelectItem>
                    <SelectItem value="PART_TIME">Part time</SelectItem>
                    <SelectItem value="CONTRACTOR">Contractor</SelectItem>
                    <SelectItem value="INTERN">Intern</SelectItem>
                    <SelectItem value="TEMPORARY">Temporary</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Job Title</Label>
                <Select value={form.jobTitle || 'none'} onValueChange={(value) => update('jobTitle', value === 'none' ? '' : value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select job title" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Select job title</SelectItem>
                    {activeJobTitles.map((jobTitle) => (
                      <SelectItem key={jobTitle.code} value={jobTitle.label}>{jobTitle.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Department *</Label>
                <Select
                  value={form.departmentId}
                  onValueChange={(value) => {
                    const setupDepartment = activeDepartments.find((item) => `setup:${item.code}` === value);
                    const department = departments.find((item) => item.id === value);
                    updateMany({
                      departmentId: value,
                      departmentName: department?.name ?? setupDepartment?.label ?? '',
                    });
                  }}
                >
                  <SelectTrigger aria-label="Department">
                    <SelectValue placeholder="Select from org chart" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Select from org chart</SelectItem>
                    {departments.map((department) => (
                      <SelectItem key={department.id} value={department.id}>
                        {'- '.repeat(department.depth)}{department.name}
                      </SelectItem>
                    ))}
                    {activeDepartments.map((department) => (
                      <SelectItem key={department.code} value={`setup:${department.code}`}>
                        {department.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <section className="border-t pt-6">
              <h3 className="mb-4 text-base font-semibold">Org Chart Preview</h3>
              {departments.length > 0 ? (
                <div className="max-h-64 overflow-auto border-y py-3">
                  {departments.map((department) => (
                    <button
                      key={department.id}
                      type="button"
                      onClick={() => {
                        updateMany({ departmentId: department.id, departmentName: department.name });
                      }}
                      className={`block w-full px-3 py-2 text-left text-sm hover:bg-muted ${
                        form.departmentId === department.id ? 'bg-primary text-primary-foreground' : ''
                      }`}
                      style={{ paddingLeft: `${12 + department.depth * 18}px` }}
                    >
                      {department.name}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="border-y py-4 text-sm text-muted-foreground">
                  No organization chart units were returned. Add departments in Admin Settings or build the organization chart in the Organization panel.
                </div>
              )}
            </section>

            <section className="border-t pt-6">
              <h3 className="mb-4 text-base font-semibold">Hierarchy</h3>
              <div className="grid gap-4 md:grid-cols-4">
                {[
                  ['Direct Manager', 'managerId'],
                  ['Dotted-Line Manager', 'dottedLineManagerId'],
                  ['HR Business Partner', 'hrbpId'],
                  ['Mentor / Buddy', 'mentorId'],
                ].map(([label, key]) => (
                  <div key={key} className="grid gap-2">
                    <Label>{label}</Label>
                    <Select value={String(form[key as keyof EmployeeCreateForm])} onValueChange={(value) => update(key as keyof EmployeeCreateForm, value as never)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        {workers.map((worker) => (
                          <SelectItem key={worker.id} value={worker.id}>{workerName(worker)}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
              <div className="mt-5">
                <div className="mb-2 flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  <Label>Colleagues / Peers</Label>
                </div>
                {sameDepartmentPeers.length > 0 ? (
                  <div className="grid gap-2 md:grid-cols-3">
                    {sameDepartmentPeers.map((worker) => (
                      <div key={worker.id} className="border-y py-2 text-sm">
                        <p className="font-medium">{workerName(worker)}</p>
                        <p className="text-xs text-muted-foreground">Auto-selected from same department</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="border-y py-4 text-sm text-muted-foreground">
                    Peers will auto-select when employees already exist in the selected department.
                  </div>
                )}
              </div>
            </section>
          </section>
        )}

        {activeStep === 3 && (
          <section className="max-w-6xl space-y-6">
            <div>
              <h3 className="text-xl font-semibold">Compensation</h3>
              <p className="text-sm text-muted-foreground">Gross pay, statutory deductions, net pay, and benefits are high-sensitivity data.</p>
            </div>
            <div className="grid gap-4 md:grid-cols-4">
              <TextField label="Gross Salary" type="number" value={form.grossSalaryAmount} onChange={(value) => updateCompensation('grossSalaryAmount', value)} />
              <TextField
                label={`Tax (${setupConfig.payrollCalculationPolicy.taxRatePercent}%)`}
                type="number"
                value={form.taxAmount}
                onChange={(value) => updateCompensation('taxAmount', value)}
                disabled
              />
              <TextField
                label={`Insurance (${setupConfig.payrollCalculationPolicy.employeeInsuranceRatePercent}%)`}
                type="number"
                value={form.insuranceAmount}
                onChange={(value) => updateCompensation('insuranceAmount', value)}
                disabled
              />
              <TextField label="Net Salary" type="number" value={form.netSalaryAmount} onChange={(value) => updateCompensation('netSalaryAmount', value)} disabled />
              <TextField
                label={selectedWorkLocation || selectedCity ? 'Currency from country' : 'Currency'}
                value={form.salaryCurrency}
                onChange={(value) => update('salaryCurrency', value.toUpperCase().slice(0, 3))}
              />
              <div className="grid gap-2">
                <Label>Salary Basis</Label>
                <Select value={form.salaryBasis} onValueChange={(value) => update('salaryBasis', value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ANNUAL">Annual</SelectItem>
                    <SelectItem value="MONTHLY">Monthly</SelectItem>
                    <SelectItem value="HOURLY">Hourly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Pay Frequency</Label>
                <Select value={form.payFrequency} onValueChange={(value) => update('payFrequency', value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="WEEKLY">Weekly</SelectItem>
                    <SelectItem value="BIWEEKLY">Biweekly</SelectItem>
                    <SelectItem value="SEMIMONTHLY">Semimonthly</SelectItem>
                    <SelectItem value="MONTHLY">Monthly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <section className="border-t pt-6">
              <h3 className="mb-4 text-base font-semibold">Benefits</h3>
              <div className="grid gap-4 md:grid-cols-3">
                <TextField
                  label="Medical Insurance"
                  type="number"
                  value={form.medicalInsuranceAmount}
                  onChange={(value) => updateCompensation('medicalInsuranceAmount', value)}
                />
                <TextField
                  label="Other Benefits"
                  type="number"
                  value={form.otherBenefitsAmount}
                  onChange={(value) => updateCompensation('otherBenefitsAmount', value)}
                />
                <TextField
                  label="Benefits Notes"
                  value={form.benefitsNotes}
                  onChange={(value) => updateCompensation('benefitsNotes', value)}
                  placeholder="Plan, coverage level, dependents"
                />
              </div>
            </section>
          </section>
        )}

        {activeStep === 4 && (
          <section className="max-w-6xl space-y-6">
            <div>
              <h3 className="text-xl font-semibold">Payroll and Work Authorization</h3>
              <p className="text-sm text-muted-foreground">Work eligibility, visa status, payroll identifiers, and bank account details.</p>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              <TextField label="Authorization Country" value={form.workAuthorizationCountry} onChange={(value) => update('workAuthorizationCountry', value.toUpperCase().slice(0, 2))} required={isRequired('workAuthorization')} />
              <div className="grid gap-2">
                <Label>Work Authorization Status{isRequired('workAuthorization') ? <span className="text-destructive"> *</span> : null}</Label>
                <Select value={form.workAuthorizationStatus || 'none'} onValueChange={(value) => update('workAuthorizationStatus', value === 'none' ? '' : value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Not specified</SelectItem>
                    <SelectItem value="CITIZEN">Citizen</SelectItem>
                    <SelectItem value="PERMANENT_RESIDENT">Permanent resident</SelectItem>
                    <SelectItem value="WORK_PERMIT">Work permit</SelectItem>
                    <SelectItem value="SPONSORED_VISA">Sponsored visa</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Visa Status</Label>
                <Select value={form.visaStatus || 'none'} onValueChange={(value) => update('visaStatus', value === 'none' ? '' : value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select visa status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Not required</SelectItem>
                    <SelectItem value="PENDING">Pending</SelectItem>
                    <SelectItem value="ACTIVE">Active</SelectItem>
                    <SelectItem value="EXPIRING_SOON">Expiring soon</SelectItem>
                    <SelectItem value="EXPIRED">Expired</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <TextField label="Visa Type" value={form.visaType} onChange={(value) => update('visaType', value)} />
              <TextField label="Visa Expiry" type="date" value={form.visaExpiryDate} onChange={(value) => update('visaExpiryDate', value)} />
              <TextField label="Work Permit Number" value={form.workPermitNumber} onChange={(value) => update('workPermitNumber', value)} />
            </div>

            <section className="border-t pt-6">
              <h3 className="mb-4 text-base font-semibold">Payroll Tax and Banking</h3>
              <div className="grid gap-4 md:grid-cols-3">
                <TextField label="Tax Identifier" value={form.taxIdentifier} onChange={(value) => update('taxIdentifier', value)} required={isRequired('taxProfile')} />
                <TextField label="Social Insurance Number" value={form.socialInsuranceNumber} onChange={(value) => update('socialInsuranceNumber', value)} />
                <TextField label="Bank Name" value={form.bankName} onChange={(value) => update('bankName', value)} required={isRequired('bankAccount')} />
                <TextField label="Account Holder Name" value={form.bankAccountHolderName} onChange={(value) => update('bankAccountHolderName', value)} />
                <TextField label="Bank Account Number" value={form.bankAccountNumber} onChange={(value) => update('bankAccountNumber', value)} />
                <TextField label="IBAN" value={form.iban} onChange={(value) => update('iban', value)} />
                <TextField label="Routing Number" value={form.bankRoutingNumber} onChange={(value) => update('bankRoutingNumber', value)} />
                <TextField label="Swift Code" value={form.bankSwiftCode} onChange={(value) => update('bankSwiftCode', value)} />
              </div>
            </section>
          </section>
        )}

        {activeStep === 5 && (
          <section className="max-w-6xl">
            <div className="mb-4">
              <h3 className="text-xl font-semibold">Talent Background</h3>
              <p className="text-sm text-muted-foreground">Education, experience, certifications, skills, licenses, and career preferences.</p>
            </div>
            <EntryList title="Education" entries={form.education} onChange={(value) => update('education', value)} onAdd={() => update('education', [...form.education, emptyEntry()])} />
            <EntryList title="Past Experience" entries={form.experience} onChange={(value) => update('experience', value)} onAdd={() => update('experience', [...form.experience, emptyEntry()])} />
            <EntryList title="Certifications" entries={form.certifications} onChange={(value) => update('certifications', value)} onAdd={() => update('certifications', [...form.certifications, emptyEntry()])} />
            <StructuredEntryList
              title="Skills"
              entries={form.skills}
              fields={[{ key: 'name', label: 'Skill' }, { key: 'level', label: 'Level' }, { key: 'years', label: 'Years' }, { key: 'preference', label: 'Preference' }, { key: 'notes', label: 'Notes' }]}
              onChange={(value) => update('skills', value)}
              onAdd={() => update('skills', [...form.skills, emptySkill()])}
            />
            <StructuredEntryList
              title="Licenses"
              entries={form.licenses}
              fields={[{ key: 'name', label: 'License' }, { key: 'level', label: 'Issuer' }, { key: 'years', label: 'Number' }, { key: 'preference', label: 'Expires' }, { key: 'notes', label: 'Notes' }]}
              onChange={(value) => update('licenses', value)}
              onAdd={() => update('licenses', [...form.licenses, emptySkill()])}
            />
            <section className="border-t py-6">
              <h3 className="mb-4 text-base font-semibold">Career Preferences</h3>
              <div className="grid gap-4 md:grid-cols-5">
                <TextField label="Preferred Track" value={form.careerPreferences.preferredTrack ?? ''} onChange={(value) => update('careerPreferences', { ...form.careerPreferences, preferredTrack: value })} />
                <TextField label="Mobility" value={form.careerPreferences.mobility ?? ''} onChange={(value) => update('careerPreferences', { ...form.careerPreferences, mobility: value })} />
                <TextField label="Relocation" value={form.careerPreferences.relocation ?? ''} onChange={(value) => update('careerPreferences', { ...form.careerPreferences, relocation: value })} />
                <TextField label="Aspirations" value={form.careerPreferences.aspirations ?? ''} onChange={(value) => update('careerPreferences', { ...form.careerPreferences, aspirations: value })} />
                <TextField label="Notes" value={form.careerPreferences.notes ?? ''} onChange={(value) => update('careerPreferences', { ...form.careerPreferences, notes: value })} />
              </div>
            </section>
          </section>
        )}

        {activeStep === 6 && (
          <section className="max-w-6xl">
            <div className="mb-4">
              <h3 className="text-xl font-semibold">Benefits, Assets, and Governance</h3>
              <p className="text-sm text-muted-foreground">Dependents, beneficiaries, issued assets, access badges, consents, privacy notices, and retention holds.</p>
            </div>
            <StructuredEntryList
              title="Benefits Dependents"
              entries={form.dependents}
              fields={[{ key: 'name', label: 'Name' }, { key: 'relationship', label: 'Relationship' }, { key: 'dateOfBirth', label: 'Birth Date', type: 'date' }, { key: 'coverageLevel', label: 'Coverage' }, { key: 'notes', label: 'Notes' }]}
              onChange={(value) => update('dependents', value)}
              onAdd={() => update('dependents', [...form.dependents, emptyDependent()])}
            />
            <StructuredEntryList
              title="Beneficiaries"
              entries={form.beneficiaries}
              fields={[{ key: 'name', label: 'Name' }, { key: 'relationship', label: 'Relationship' }, { key: 'allocationPercent', label: 'Allocation %', type: 'number' }, { key: 'phoneNumber', label: 'Phone' }, { key: 'notes', label: 'Notes' }]}
              onChange={(value) => update('beneficiaries', value)}
              onAdd={() => update('beneficiaries', [...form.beneficiaries, emptyBeneficiary()])}
            />
            <StructuredEntryList
              title="Assets and Devices"
              entries={form.assets}
              fields={[{ key: 'type', label: 'Type' }, { key: 'identifier', label: 'Asset Tag' }, { key: 'issuedOn', label: 'Issued On', type: 'date' }, { key: 'owner', label: 'Owner' }, { key: 'notes', label: 'Notes' }]}
              onChange={(value) => update('assets', value)}
              onAdd={() => update('assets', [...form.assets, emptyAsset()])}
            />
            <StructuredEntryList
              title="Access Badges"
              entries={form.accessBadges}
              fields={[{ key: 'type', label: 'Badge Type' }, { key: 'identifier', label: 'Badge Number' }, { key: 'issuedOn', label: 'Issued On', type: 'date' }, { key: 'owner', label: 'Site' }, { key: 'notes', label: 'Notes' }]}
              onChange={(value) => update('accessBadges', value)}
              onAdd={() => update('accessBadges', [...form.accessBadges, emptyAsset()])}
            />
            <StructuredEntryList
              title="Consents"
              entries={form.consents}
              fields={[{ key: 'noticeCode', label: 'Notice Code' }, { key: 'version', label: 'Version' }, { key: 'accepted', label: 'Accepted' }, { key: 'acceptedAt', label: 'Accepted At', type: 'date' }, { key: 'notes', label: 'Notes' }]}
              onChange={(value) => update('consents', value)}
              onAdd={() => update('consents', [...form.consents, emptyConsent()])}
            />
            <StructuredEntryList
              title="Privacy Notices"
              entries={form.privacyNotices}
              fields={[{ key: 'noticeCode', label: 'Notice Code' }, { key: 'version', label: 'Version' }, { key: 'accepted', label: 'Delivered' }, { key: 'acceptedAt', label: 'Delivered At', type: 'date' }, { key: 'notes', label: 'Notes' }]}
              onChange={(value) => update('privacyNotices', value)}
              onAdd={() => update('privacyNotices', [...form.privacyNotices, emptyConsent()])}
            />
            <StructuredEntryList
              title="Retention Holds"
              entries={form.retentionHolds}
              fields={[{ key: 'reason', label: 'Reason' }, { key: 'reference', label: 'Reference' }, { key: 'startDate', label: 'Start', type: 'date' }, { key: 'endDate', label: 'End', type: 'date' }, { key: 'notes', label: 'Notes' }]}
              onChange={(value) => update('retentionHolds', value)}
              onAdd={() => update('retentionHolds', [...form.retentionHolds, { reason: '', reference: '', startDate: '', endDate: '', notes: '' }])}
            />
          </section>
        )}

        {activeStep === 7 && (
          <section className="max-w-5xl space-y-6">
            <div>
              <h3 className="text-xl font-semibold">Documents and Certificates</h3>
              <p className="text-sm text-muted-foreground">Attach certificates, identity documents, contracts, and onboarding evidence.</p>
            </div>
            <section className="border-y py-5">
              <h3 className="mb-4 text-base font-semibold">Employment Contract</h3>
              <div className="grid gap-4 md:grid-cols-4">
                <TextField
                  label="Contract Template"
                  value={form.employmentContractTemplate}
                  onChange={(value) => update('employmentContractTemplate', value)}
                  required={isRequired('employmentContract')}
                />
                <div className="grid gap-2">
                  <Label>Contract Status</Label>
                  <Select value={form.employmentContractStatus} onValueChange={(value) => update('employmentContractStatus', value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="DRAFT">Draft from hiring</SelectItem>
                      <SelectItem value="PENDING_SIGNATURE">Pending signature</SelectItem>
                      <SelectItem value="SIGNED">Signed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <TextField label="Contract Start" type="date" value={form.employmentContractStartDate} onChange={(value) => update('employmentContractStartDate', value)} />
                <TextField label="Contract End" type="date" value={form.employmentContractEndDate} onChange={(value) => update('employmentContractEndDate', value)} />
              </div>
            </section>
            <div className="grid gap-4 md:grid-cols-[1fr_1.5fr]">
              <div className="grid gap-2">
                <Label>Document Slot</Label>
                <Select value={form.selectedDocumentRequirementCode || 'none'} onValueChange={(value) => update('selectedDocumentRequirementCode', value === 'none' ? '' : value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {activeDocumentRequirements.length === 0 ? <SelectItem value="none">No configured credentials</SelectItem> : null}
                    {activeDocumentRequirements.map((requirement) => (
                      <SelectItem key={requirement.code} value={requirement.code}>
                        {requirement.label}{requirement.required ? ' *' : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="employee-documents">Attachments</Label>
                <Input
                  id="employee-documents"
                  type="file"
                  multiple
                  disabled={activeDocumentRequirements.length === 0 || !form.selectedDocumentRequirementCode}
                  accept={activeDocumentRequirements.find((document) => document.code === form.selectedDocumentRequirementCode)?.acceptedMimeTypes.join(',')}
                  onChange={onDocumentsChange}
                />
                {activeDocumentRequirements.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Hiring credential slots must be configured in Admin Settings first.</p>
                ) : null}
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              {activeDocumentRequirements.map((requirement) => {
                const count = form.documents.filter((document) => document.requirementCode === requirement.code || document.type === requirement.code).length;
                return (
                  <button
                    key={requirement.code}
                    type="button"
                    onClick={() => update('selectedDocumentRequirementCode', requirement.code)}
                    className={`border-y px-3 py-3 text-left text-sm hover:bg-muted ${
                      form.selectedDocumentRequirementCode === requirement.code ? 'bg-primary text-primary-foreground' : ''
                    }`}
                  >
                    <span className="font-medium">{requirement.label}</span>
                    <span className="mt-1 block text-xs opacity-80">
                      {requirement.required ? 'Required' : 'Optional'} - {count} attached
                    </span>
                  </button>
                );
              })}
            </div>
            <div className="divide-y border-y">
              {form.documents.length === 0 ? (
                <p className="py-4 text-sm text-muted-foreground">No documents attached.</p>
              ) : (
                form.documents.map((document) => (
                  <div key={`${document.fileName}-${document.addedAt}`} className="flex items-center justify-between py-3">
                    <div>
                      <p className="text-sm font-medium">{document.fileName}</p>
                      <p className="text-xs text-muted-foreground">{document.mimeType || 'Unknown type'} · {formatFileSize(document.size)}</p>
                    </div>
                    <Badge variant="outline">{document.requirementLabel ?? document.type}</Badge>
                  </div>
                ))
              )}
            </div>
          </section>
        )}

        {activeStep === 8 && (
          <section className="max-w-5xl space-y-6">
            <div>
              <h3 className="text-xl font-semibold">Governance Review</h3>
              <p className="text-sm text-muted-foreground">Duplicate controls, required data, and profile readiness.</p>
            </div>
            <div className="grid gap-4 md:grid-cols-4">
              <div className="border-y py-4">
                <p className="text-sm text-muted-foreground">Identity</p>
                <p className="font-medium">{form.firstName} {form.lastName}</p>
                <p className="text-sm">{form.email || 'No email'}{form.gender ? ` - ${form.gender}` : ''}</p>
              </div>
              <div className="border-y py-4">
                <p className="text-sm text-muted-foreground">Employee ID</p>
                <p className="font-medium">{form.employeeIdMode === 'AUTO' ? 'Auto-generated' : form.employeeNumber || 'Manual missing'}</p>
                <p className="text-sm">{needsManualEmployeeId ? 'Required before create' : form.employeeIdMode === 'MANUAL' && !canManuallySetEmployeeId ? 'Restricted by app policy' : 'Policy compliant'}</p>
              </div>
              <div className="border-y py-4">
                <p className="text-sm text-muted-foreground">Department</p>
                <p className="font-medium">{selectedDepartment?.name || selectedSetupDepartment?.label || form.departmentName || 'Missing'}</p>
                <p className="text-sm">{needsDepartment ? 'Required before create' : 'Ready'}</p>
              </div>
              <div className="border-y py-4">
                <p className="text-sm text-muted-foreground">Sensitive Data</p>
                <p className="font-medium">Compensation and documents</p>
                <p className="text-sm">{missingRequiredDocuments.length ? `${missingRequiredDocuments.length} credential(s) missing` : 'High sensitivity'}</p>
              </div>
            </div>

            <div className="border-t pt-5">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h3 className="font-semibold">Duplicate Check</h3>
                  <p className="text-sm text-muted-foreground">Exact email, phone, and employee ID matches block creation.</p>
                </div>
                <Button type="button" variant="outline" onClick={runDuplicateCheck} disabled={duplicateMutation.isPending}>
                  {duplicateMutation.isPending ? 'Checking...' : 'Run check'}
                </Button>
              </div>
              {duplicateResult ? (
                <div className="mt-4 space-y-3">
                  {duplicateResult.exactMatches.length === 0 ? (
                    <div className="flex items-center gap-2 text-sm text-green-700">
                      <CheckCircle2 className="h-4 w-4" />
                      No exact duplicate identity data found.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {duplicateResult.exactMatches.map((match) => (
                        <div key={`${match.field}-${match.value}`} className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm">
                          Duplicate {match.field}: {match.value}
                        </div>
                      ))}
                    </div>
                  )}
                  {duplicateResult.warnings.map((warning) => (
                    <div key={warning.workerId} className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                      Possible duplicate: {warning.name} ({warning.employeeId}) - {warning.reason}
                    </div>
                  ))}
                </div>
              ) : null}
            </div>

            <div className="border-t pt-5">
              <h3 className="font-semibold">Integrated Profile Coverage</h3>
              <div className="mt-3 grid gap-2 text-sm md:grid-cols-2">
                <div className="border-y py-2">Work authorization: {form.workAuthorizationStatus || form.visaStatus || 'not captured'}</div>
                <div className="border-y py-2">Payroll tax and bank: {form.taxIdentifier || form.bankName ? 'captured' : 'not captured'}</div>
                <div className="border-y py-2">Benefits dependents: {cleanEntries(form.dependents).length}</div>
                <div className="border-y py-2">Beneficiaries: {cleanEntries(form.beneficiaries).length}</div>
                <div className="border-y py-2">Assets and badges: {cleanEntries(form.assets).length + cleanEntries(form.accessBadges).length}</div>
                <div className="border-y py-2">Skills and licenses: {cleanEntries(form.skills).length + cleanEntries(form.licenses).length}</div>
                <div className="border-y py-2">Consents and privacy notices: {cleanEntries(form.consents).length + cleanEntries(form.privacyNotices).length}</div>
                <div className="border-y py-2">Employment contract: {form.employmentContractTemplate || 'not selected'}</div>
              </div>
              {missingRequiredFieldRules.length > 0 ? (
                <div className="mt-4 rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                  Missing required fields from Admin Settings: {missingRequiredFieldRules.map((rule) => rule.label).join(', ')}
                </div>
              ) : null}
            </div>

            {error ? <div className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">{error}</div> : null}
          </section>
        )}

        {customFieldRulesForStep.length > 0 ? (
          <section className="mt-6 max-w-6xl space-y-4 border-t pt-6">
            <div>
              <h3 className="text-base font-semibold">Custom Fields</h3>
              <p className="text-sm text-muted-foreground">Admin-defined fields from Admin Settings for this section.</p>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              {customFieldRulesForStep.map((rule) => (
                <DynamicFieldInput
                  key={rule.fieldKey}
                  rule={rule}
                  value={form.customFieldValues[rule.fieldKey]}
                  onChange={(value) => update('customFieldValues', { ...form.customFieldValues, [rule.fieldKey]: value })}
                />
              ))}
            </div>
          </section>
        ) : null}
      </main>

      <div className="sticky bottom-0 flex items-center justify-between fusion-glass rounded-[2rem] px-6 py-4">
        <Button variant="outline" onClick={() => setActiveStep((currentIndex) => Math.max(currentIndex - 1, 0))} disabled={activeStep === 0}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        {activeStep < steps.length - 1 ? (
          <Button onClick={next} disabled={(activeStep === 0 && !canContinueIdentity) || duplicateMutation.isPending}>
            Next
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        ) : (
          <Button onClick={submit} disabled={!canSubmit || createMutation.isPending || duplicateMutation.isPending}>
            {createMutation.isPending ? 'Creating...' : 'Create Employee'}
          </Button>
        )}
      </div>
    </div>
  );
}

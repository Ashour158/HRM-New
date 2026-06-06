import * as React from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  CheckCircle2,
  FileKey2,
  GitCompareArrows,
  KeyRound,
  Plus,
  RefreshCcw,
  Save,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  UserCog,
  UsersRound,
} from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { useApiMutation, useApiQuery } from '@/hooks/use-api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

type RoleView = {
  id: string;
  code: string;
  name: string;
  tier: string;
  description: string | null;
  isSystem: boolean;
  createdAt: string;
};

type PermissionView = {
  id: string;
  code: string;
  description: string | null;
  domain: string;
  dataClassification: string | null;
  auditOnAccess: boolean;
};

type RolePermissionView = {
  roleId: string;
  permissionId: string;
  roleCode: string;
  permissionCode: string;
};

type UserRoleView = {
  id: string;
  userId: string;
  roleId: string;
  roleCode: string;
  assignedBy: string | null;
  assignedAt: string;
  expiresAt: string | null;
};

type ServiceAccountView = {
  id: string;
  code: string;
  name: string;
  ownerWorkerId: string | null;
  status: string;
  scopes: unknown;
  credentialRotationDays: number;
  lastRotatedAt: string | null;
  expiresAt: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
};

type ServiceAccountCredentialView = {
  id: string;
  serviceAccountId: string;
  name: string;
  secretPrefix: string;
  status: string;
  scopes: unknown;
  issuedAt: string;
  expiresAt: string | null;
  lastUsedAt: string | null;
  rotatedAt: string | null;
  revokedAt: string | null;
  revokedReason: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
};

type IssuedServiceAccountCredentialView = ServiceAccountCredentialView & {
  oneTimeSecret: string;
};

type AccessReviewCampaignView = {
  id: string;
  code: string;
  name: string;
  scope: unknown;
  reviewerRole: string;
  status: string;
  dueAt: string | null;
  createdBy: string | null;
  launchedAt: string | null;
  lastReminderAt: string | null;
  escalatedAt: string | null;
  escalationCount: number;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

type AccessReviewItemView = {
  id: string;
  campaignId: string;
  subjectUserId: string | null;
  subjectWorkerId: string | null;
  roleId: string | null;
  roleCode: string | null;
  permissionId: string | null;
  permissionCode: string | null;
  serviceAccountId: string | null;
  serviceAccountCode: string | null;
  decision: string;
  reviewerId: string | null;
  reviewedAt: string | null;
  evidence: unknown;
  createdAt: string;
};

type AccessReviewWorkflowEventView = {
  id: string;
  campaignId: string;
  eventType: string;
  actorId: string | null;
  targetRole: string | null;
  message: string | null;
  pendingItemCount: number;
  payload: unknown;
  createdAt: string;
};

type AbacPolicyView = {
  id: string;
  dimension: string;
  conditions: unknown;
  effect: 'ALLOW' | 'DENY';
  priority: number;
  createdAt: string;
};

type FieldAccessPolicyView = {
  id: string;
  fieldPath: string;
  dataClassification: string;
  roleDecisions: unknown;
  selfServiceDecision: string | null;
  managerDecision: string | null;
  maskingRule: string | null;
  createdAt: string;
};

type SodRuleView = {
  id: string;
  code: string;
  description: string | null;
  incompatibleRolePairs: unknown | null;
  incompatiblePermissionPairs: unknown | null;
  enforcementPoint: string | null;
  breakGlassAllowed: boolean;
  createdAt: string;
};

type AccessGovernanceSummary = {
  roles: RoleView[];
  permissions: PermissionView[];
  rolePermissions: RolePermissionView[];
  userRoles: UserRoleView[];
  serviceAccounts: ServiceAccountView[];
  serviceAccountCredentials: ServiceAccountCredentialView[];
  accessReviewCampaigns: AccessReviewCampaignView[];
  accessReviewItems: AccessReviewItemView[];
  accessReviewWorkflowEvents: AccessReviewWorkflowEventView[];
  abacPolicies: AbacPolicyView[];
  fieldAccessPolicies: FieldAccessPolicyView[];
  sodRules: SodRuleView[];
};

type RoleForm = {
  code: string;
  name: string;
  tier: string;
  description: string;
};

type PermissionForm = {
  code: string;
  domain: string;
  dataClassification: string;
  description: string;
  auditOnAccess: string;
};

type AbacForm = {
  dimension: string;
  effect: 'ALLOW' | 'DENY';
  priority: string;
  conditions: string;
};

type FieldPolicyForm = {
  fieldPath: string;
  dataClassification: string;
  roleDecisions: string;
  selfServiceDecision: string;
  managerDecision: string;
  maskingRule: string;
};

type SodForm = {
  code: string;
  description: string;
  enforcementPoint: string;
  breakGlassAllowed: string;
  incompatibleRolePairs: string;
  incompatiblePermissionPairs: string;
};

type UserRoleForm = {
  userId: string;
  roleId: string;
  expiresAt: string;
};

type ServiceAccountForm = {
  code: string;
  name: string;
  ownerWorkerId: string;
  status: string;
  scopes: string;
  credentialRotationDays: string;
  expiresAt: string;
};

type ServiceCredentialForm = {
  serviceAccountId: string;
  name: string;
  scopes: string;
  expiresAt: string;
};

type AccessReviewCampaignForm = {
  code: string;
  name: string;
  reviewerRole: string;
  status: string;
  dueAt: string;
  scope: string;
};

type AccessReviewItemForm = {
  campaignId: string;
  subjectUserId: string;
  subjectWorkerId: string;
  roleId: string;
  permissionId: string;
  serviceAccountId: string;
  evidence: string;
};

const ACCESS_QUERY_KEY = ['access-governance'];

const initialRoleForm: RoleForm = {
  code: '',
  name: '',
  tier: 'TENANT',
  description: '',
};

const initialPermissionForm: PermissionForm = {
  code: '',
  domain: 'HR_CORE',
  dataClassification: 'CONFIDENTIAL',
  description: '',
  auditOnAccess: 'false',
};

const initialAbacForm: AbacForm = {
  dimension: 'WORKER_SCOPE',
  effect: 'ALLOW',
  priority: '10',
  conditions: '{\n  "departmentMatch": true\n}',
};

const initialFieldPolicyForm: FieldPolicyForm = {
  fieldPath: 'worker.compensation.salary',
  dataClassification: 'SPECIAL_CATEGORY',
  roleDecisions: '{\n  "HR_ADMIN": "VISIBLE",\n  "MANAGER": "MASKED"\n}',
  selfServiceDecision: 'HIDDEN',
  managerDecision: 'MASKED',
  maskingRule: 'CURRENCY_RANGE',
};

const initialSodForm: SodForm = {
  code: '',
  description: '',
  enforcementPoint: 'ROLE_ASSIGNMENT',
  breakGlassAllowed: 'false',
  incompatibleRolePairs: '[\n  ["PAYROLL_ADMIN", "PAYROLL_APPROVER"]\n]',
  incompatiblePermissionPairs: '[]',
};

const initialUserRoleForm: UserRoleForm = {
  userId: '',
  roleId: '',
  expiresAt: '',
};

const initialServiceAccountForm: ServiceAccountForm = {
  code: '',
  name: '',
  ownerWorkerId: '',
  status: 'ACTIVE',
  scopes: '[\n  "hr:read"\n]',
  credentialRotationDays: '90',
  expiresAt: '',
};

const initialServiceCredentialForm: ServiceCredentialForm = {
  serviceAccountId: '',
  name: '',
  scopes: '[\n  "hr:read"\n]',
  expiresAt: '',
};

const initialAccessReviewCampaignForm: AccessReviewCampaignForm = {
  code: '',
  name: '',
  reviewerRole: 'HR_ADMIN',
  status: 'DRAFT',
  dueAt: '',
  scope: '{\n  "roles": ["HR_ADMIN"]\n}',
};

const initialAccessReviewItemForm: AccessReviewItemForm = {
  campaignId: '',
  subjectUserId: '',
  subjectWorkerId: '',
  roleId: '',
  permissionId: '',
  serviceAccountId: '',
  evidence: '{\n  "source": "manual-admin-review"\n}',
};

function formatDate(value: string | undefined) {
  if (!value) return '-';
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(value));
}

function asJson(value: unknown) {
  return JSON.stringify(value ?? null, null, 2);
}

function parseJson(value: string, label: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    throw new Error(`${label} must be valid JSON`);
  }
}

function EmptyRows({ colSpan, label }: { colSpan: number; label: string }) {
  return (
    <TableRow>
      <TableCell colSpan={colSpan} className="h-24 text-center text-sm text-muted-foreground">
        {label}
      </TableCell>
    </TableRow>
  );
}

function StatusStrip({ label, value, helper, icon: Icon }: { label: string; value: string | number; helper: string; icon: React.ElementType }) {
  return (
    <Card className="fusion-glass fusion-hover rounded-[2rem] border-transparent">
      <CardContent className="flex items-start justify-between gap-4 p-4">
        <div>
          <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
          <p className="mt-2 text-2xl font-bold">{value}</p>
          <p className="mt-1 text-sm text-muted-foreground">{helper}</p>
        </div>
        <div className="grid size-10 shrink-0 place-items-center rounded-2xl bg-white/20 bg-gradient-to-br from-indigo-500 to-violet-500 text-white">
          <Icon className="size-5" />
        </div>
      </CardContent>
    </Card>
  );
}

function JsonTextarea({
  label,
  value,
  onChange,
  rows = 5,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  rows?: number;
}) {
  return (
    <div className="grid gap-2">
      <Label>{label}</Label>
      <textarea
        className="min-h-28 rounded-md border border-input bg-background px-3 py-2 font-mono text-sm outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring"
        onChange={(event) => onChange(event.target.value)}
        rows={rows}
        value={value}
      />
    </div>
  );
}

export function AdminAccessGovernance() {
  const queryClient = useQueryClient();
  const { data, isLoading, isError, refetch } = useApiQuery<AccessGovernanceSummary>(ACCESS_QUERY_KEY, '/admin/access-governance', {
    retry: false,
  });
  const [roleForm, setRoleForm] = React.useState<RoleForm>(initialRoleForm);
  const [permissionForm, setPermissionForm] = React.useState<PermissionForm>(initialPermissionForm);
  const [selectedRoleId, setSelectedRoleId] = React.useState('');
  const [selectedPermissionId, setSelectedPermissionId] = React.useState('');
  const [abacForm, setAbacForm] = React.useState<AbacForm>(initialAbacForm);
  const [fieldPolicyForm, setFieldPolicyForm] = React.useState<FieldPolicyForm>(initialFieldPolicyForm);
  const [sodForm, setSodForm] = React.useState<SodForm>(initialSodForm);
  const [userRoleForm, setUserRoleForm] = React.useState<UserRoleForm>(initialUserRoleForm);
  const [serviceAccountForm, setServiceAccountForm] = React.useState<ServiceAccountForm>(initialServiceAccountForm);
  const [serviceCredentialForm, setServiceCredentialForm] = React.useState<ServiceCredentialForm>(initialServiceCredentialForm);
  const [issuedCredential, setIssuedCredential] = React.useState<IssuedServiceAccountCredentialView | null>(null);
  const [accessReviewCampaignForm, setAccessReviewCampaignForm] = React.useState<AccessReviewCampaignForm>(initialAccessReviewCampaignForm);
  const [accessReviewItemForm, setAccessReviewItemForm] = React.useState<AccessReviewItemForm>(initialAccessReviewItemForm);
  const [formError, setFormError] = React.useState<string | null>(null);
  const [savedAt, setSavedAt] = React.useState<string | null>(null);

  const onSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ACCESS_QUERY_KEY });
    setFormError(null);
    setSavedAt(new Date().toLocaleTimeString());
  };

  const roleMutation = useApiMutation<RoleView, RoleForm>('/admin/access-governance/roles', 'post', [ACCESS_QUERY_KEY], {
    onSuccess: () => {
      setRoleForm(initialRoleForm);
      onSuccess();
    },
  });

  const permissionMutation = useApiMutation<PermissionView, {
    code: string;
    domain: string;
    dataClassification: string;
    description: string;
    auditOnAccess: boolean;
  }>(
    '/admin/access-governance/permissions',
    'post',
    [ACCESS_QUERY_KEY],
    {
      onSuccess: () => {
        setPermissionForm(initialPermissionForm);
        onSuccess();
      },
    },
  );

  const assignmentMutation = useMutation({
    mutationFn: async ({ roleId, permissionId }: { roleId: string; permissionId: string }) => {
      const response = await apiClient.post(`/admin/access-governance/roles/${roleId}/permissions/${permissionId}`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ACCESS_QUERY_KEY });
      setSelectedPermissionId('');
      onSuccess();
    },
  });

  const removeAssignmentMutation = useMutation({
    mutationFn: async ({ roleId, permissionId }: { roleId: string; permissionId: string }) => {
      const response = await apiClient.delete(`/admin/access-governance/roles/${roleId}/permissions/${permissionId}`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ACCESS_QUERY_KEY });
      onSuccess();
    },
  });

  const userRoleMutation = useApiMutation<UserRoleView[], { userId: string; roleId: string; expiresAt: string | null }>(
    '/admin/access-governance/user-roles',
    'post',
    [ACCESS_QUERY_KEY],
    {
      onSuccess: () => {
        setUserRoleForm(initialUserRoleForm);
        onSuccess();
      },
    },
  );

  const removeUserRoleMutation = useMutation({
    mutationFn: async ({ userId, roleId }: { userId: string; roleId: string }) => {
      const response = await apiClient.delete(`/admin/access-governance/user-roles/${userId}/${roleId}`);
      return response.data;
    },
    onSuccess,
  });

  const serviceAccountMutation = useApiMutation<ServiceAccountView, {
    code: string;
    name: string;
    ownerWorkerId: string | null;
    status: string;
    scopes: unknown;
    credentialRotationDays: number;
    expiresAt: string | null;
  }>('/admin/access-governance/service-accounts', 'post', [ACCESS_QUERY_KEY], {
    onSuccess: () => {
      setServiceAccountForm(initialServiceAccountForm);
      onSuccess();
    },
  });

  const issueCredentialMutation = useMutation({
    mutationFn: async (payload: {
      serviceAccountId: string;
      name: string | null;
      scopes: unknown;
      expiresAt: string | null;
    }) => {
      const response = await apiClient.post<{ data: IssuedServiceAccountCredentialView }>(
        `/admin/access-governance/service-accounts/${payload.serviceAccountId}/credentials/issue`,
        {
          name: payload.name,
          scopes: payload.scopes,
          expiresAt: payload.expiresAt,
        },
      );
      return response.data.data;
    },
    onSuccess: (credential) => {
      setIssuedCredential(credential);
      setServiceCredentialForm((current) => ({
        ...initialServiceCredentialForm,
        serviceAccountId: current.serviceAccountId,
      }));
      queryClient.invalidateQueries({ queryKey: ACCESS_QUERY_KEY });
      setFormError(null);
      setSavedAt(new Date().toLocaleTimeString());
    },
  });

  const rotateCredentialMutation = useMutation({
    mutationFn: async ({ accountId, credentialId }: { accountId: string; credentialId: string }) => {
      const response = await apiClient.post<{ data: IssuedServiceAccountCredentialView }>(
        `/admin/access-governance/service-accounts/${accountId}/credentials/${credentialId}/rotate`,
        {},
      );
      return response.data.data;
    },
    onSuccess: (credential) => {
      setIssuedCredential(credential);
      queryClient.invalidateQueries({ queryKey: ACCESS_QUERY_KEY });
      setFormError(null);
      setSavedAt(new Date().toLocaleTimeString());
    },
  });

  const revokeCredentialMutation = useMutation({
    mutationFn: async ({ accountId, credentialId }: { accountId: string; credentialId: string }) => {
      const response = await apiClient.post<{ data: ServiceAccountCredentialView }>(
        `/admin/access-governance/service-accounts/${accountId}/credentials/${credentialId}/revoke`,
        { reason: 'Revoked from access governance admin' },
      );
      return response.data.data;
    },
    onSuccess,
  });

  const accessReviewCampaignMutation = useApiMutation<AccessReviewCampaignView, {
    code: string;
    name: string;
    reviewerRole: string;
    status: string;
    dueAt: string | null;
    scope: unknown;
  }>('/admin/access-governance/access-reviews/campaigns', 'post', [ACCESS_QUERY_KEY], {
    onSuccess: () => {
      setAccessReviewCampaignForm(initialAccessReviewCampaignForm);
      onSuccess();
    },
  });

  const accessReviewItemMutation = useApiMutation<AccessReviewItemView[], {
    campaignId: string;
    subjectUserId: string | null;
    subjectWorkerId: string | null;
    roleId: string | null;
    permissionId: string | null;
    serviceAccountId: string | null;
    evidence: unknown;
  }>('/admin/access-governance/access-reviews/items', 'post', [ACCESS_QUERY_KEY], {
    onSuccess: () => {
      setAccessReviewItemForm(initialAccessReviewItemForm);
      onSuccess();
    },
  });

  const accessReviewDecisionMutation = useMutation({
    mutationFn: async ({ itemId, decision }: { itemId: string; decision: string }) => {
      const response = await apiClient.patch(`/admin/access-governance/access-reviews/items/${itemId}`, {
        decision,
        evidence: { decidedFrom: 'access-governance-admin' },
      });
      return response.data;
    },
    onSuccess,
  });

  const accessReviewCommandMutation = useMutation({
    mutationFn: async ({ campaignId, command, message }: { campaignId: string; command: 'launch' | 'remind' | 'escalate' | 'complete'; message?: string }) => {
      const response = await apiClient.post<{ data: AccessReviewWorkflowEventView }>(
        `/admin/access-governance/access-reviews/campaigns/${campaignId}/commands/${command}`,
        message ? { message } : {},
      );
      return response.data.data;
    },
    onSuccess,
  });

  const abacMutation = useApiMutation<AbacPolicyView, { dimension: string; effect: 'ALLOW' | 'DENY'; priority: number; conditions: unknown }>(
    '/admin/access-governance/abac-policies',
    'post',
    [ACCESS_QUERY_KEY],
    {
      onSuccess: () => {
        setAbacForm(initialAbacForm);
        onSuccess();
      },
    },
  );

  const fieldPolicyMutation = useApiMutation<FieldAccessPolicyView, {
    fieldPath: string;
    dataClassification: string;
    roleDecisions: unknown;
    selfServiceDecision: string | null;
    managerDecision: string | null;
    maskingRule: string | null;
  }>('/admin/access-governance/field-access-policies', 'post', [ACCESS_QUERY_KEY], {
    onSuccess: () => {
      setFieldPolicyForm(initialFieldPolicyForm);
      onSuccess();
    },
  });

  const sodMutation = useApiMutation<SodRuleView, {
    code: string;
    description: string | null;
    enforcementPoint: string | null;
    breakGlassAllowed: boolean;
    incompatibleRolePairs: unknown | null;
    incompatiblePermissionPairs: unknown | null;
  }>('/admin/access-governance/sod-rules', 'post', [ACCESS_QUERY_KEY], {
    onSuccess: () => {
      setSodForm(initialSodForm);
      onSuccess();
    },
  });

  const roles = data?.roles ?? [];
  const permissions = data?.permissions ?? [];
  const assignments = data?.rolePermissions ?? [];
  const userRoles = data?.userRoles ?? [];
  const serviceAccounts = data?.serviceAccounts ?? [];
  const serviceAccountCredentials = data?.serviceAccountCredentials ?? [];
  const accessReviewCampaigns = data?.accessReviewCampaigns ?? [];
  const accessReviewItems = data?.accessReviewItems ?? [];
  const accessReviewWorkflowEvents = data?.accessReviewWorkflowEvents ?? [];

  React.useEffect(() => {
    if (!selectedRoleId && roles[0]) setSelectedRoleId(roles[0].id);
  }, [roles, selectedRoleId]);

  React.useEffect(() => {
    if (!userRoleForm.roleId && roles[0]) setUserRoleForm((current) => ({ ...current, roleId: roles[0].id }));
  }, [roles, userRoleForm.roleId]);

  React.useEffect(() => {
    if (!accessReviewItemForm.campaignId && accessReviewCampaigns[0]) {
      setAccessReviewItemForm((current) => ({ ...current, campaignId: accessReviewCampaigns[0].id }));
    }
  }, [accessReviewCampaigns, accessReviewItemForm.campaignId]);

  React.useEffect(() => {
    if (!serviceCredentialForm.serviceAccountId && serviceAccounts[0]) {
      setServiceCredentialForm((current) => ({ ...current, serviceAccountId: serviceAccounts[0].id }));
    }
  }, [serviceAccounts, serviceCredentialForm.serviceAccountId]);

  const submitRole = () => {
    setFormError(null);
    roleMutation.mutate(roleForm);
  };

  const submitPermission = () => {
    setFormError(null);
    permissionMutation.mutate({
      ...permissionForm,
      auditOnAccess: permissionForm.auditOnAccess === 'true',
    });
  };

  const submitAssignment = () => {
    if (!selectedRoleId || !selectedPermissionId) {
      setFormError('Select a role and permission before assigning.');
      return;
    }
    assignmentMutation.mutate({ roleId: selectedRoleId, permissionId: selectedPermissionId });
  };

  const submitUserRole = () => {
    if (!userRoleForm.userId || !userRoleForm.roleId) {
      setFormError('Enter a user ID and select a role before assigning access.');
      return;
    }
    userRoleMutation.mutate({
      userId: userRoleForm.userId,
      roleId: userRoleForm.roleId,
      expiresAt: userRoleForm.expiresAt || null,
    });
  };

  const submitServiceAccount = () => {
    try {
      serviceAccountMutation.mutate({
        code: serviceAccountForm.code,
        name: serviceAccountForm.name,
        ownerWorkerId: serviceAccountForm.ownerWorkerId || null,
        status: serviceAccountForm.status,
        scopes: parseJson(serviceAccountForm.scopes, 'Service account scopes'),
        credentialRotationDays: Number(serviceAccountForm.credentialRotationDays || 90),
        expiresAt: serviceAccountForm.expiresAt || null,
      });
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Invalid service account payload');
    }
  };

  const submitServiceCredential = () => {
    try {
      if (!serviceCredentialForm.serviceAccountId) {
        setFormError('Create or select a service account before issuing credentials.');
        return;
      }
      issueCredentialMutation.mutate({
        serviceAccountId: serviceCredentialForm.serviceAccountId,
        name: serviceCredentialForm.name || null,
        scopes: parseJson(serviceCredentialForm.scopes, 'Credential scopes'),
        expiresAt: serviceCredentialForm.expiresAt || null,
      });
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Invalid credential payload');
    }
  };

  const submitAccessReviewCampaign = () => {
    try {
      accessReviewCampaignMutation.mutate({
        code: accessReviewCampaignForm.code,
        name: accessReviewCampaignForm.name,
        reviewerRole: accessReviewCampaignForm.reviewerRole,
        status: accessReviewCampaignForm.status,
        dueAt: accessReviewCampaignForm.dueAt || null,
        scope: parseJson(accessReviewCampaignForm.scope, 'Access review scope'),
      });
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Invalid access review campaign payload');
    }
  };

  const submitAccessReviewItem = () => {
    try {
      if (!accessReviewItemForm.campaignId) {
        setFormError('Create or select an access review campaign first.');
        return;
      }
      accessReviewItemMutation.mutate({
        campaignId: accessReviewItemForm.campaignId,
        subjectUserId: accessReviewItemForm.subjectUserId || null,
        subjectWorkerId: accessReviewItemForm.subjectWorkerId || null,
        roleId: accessReviewItemForm.roleId || null,
        permissionId: accessReviewItemForm.permissionId || null,
        serviceAccountId: accessReviewItemForm.serviceAccountId || null,
        evidence: parseJson(accessReviewItemForm.evidence, 'Access review evidence'),
      });
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Invalid access review item payload');
    }
  };

  const submitAbac = () => {
    try {
      abacMutation.mutate({
        dimension: abacForm.dimension,
        effect: abacForm.effect,
        priority: Number(abacForm.priority || 0),
        conditions: parseJson(abacForm.conditions, 'ABAC conditions'),
      });
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Invalid ABAC policy payload');
    }
  };

  const submitFieldPolicy = () => {
    try {
      fieldPolicyMutation.mutate({
        fieldPath: fieldPolicyForm.fieldPath,
        dataClassification: fieldPolicyForm.dataClassification,
        roleDecisions: parseJson(fieldPolicyForm.roleDecisions, 'Role decisions'),
        selfServiceDecision: fieldPolicyForm.selfServiceDecision || null,
        managerDecision: fieldPolicyForm.managerDecision || null,
        maskingRule: fieldPolicyForm.maskingRule || null,
      });
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Invalid field access payload');
    }
  };

  const submitSodRule = () => {
    try {
      sodMutation.mutate({
        code: sodForm.code,
        description: sodForm.description || null,
        enforcementPoint: sodForm.enforcementPoint || null,
        breakGlassAllowed: sodForm.breakGlassAllowed === 'true',
        incompatibleRolePairs: parseJson(sodForm.incompatibleRolePairs, 'Incompatible role pairs'),
        incompatiblePermissionPairs: parseJson(sodForm.incompatiblePermissionPairs, 'Incompatible permission pairs'),
      });
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Invalid SoD payload');
    }
  };

  return (
    <div className="-m-4 min-h-[calc(100vh-7rem)] px-6 py-6">
      <div className="flex flex-col gap-4 border-b pb-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="mb-3 inline-flex w-fit items-center gap-2 rounded-full border border-white/60 bg-white/60 py-1 pl-2 pr-3 text-xs font-bold text-slate-600 backdrop-blur-md">
            <span className="relative flex h-2.5 w-2.5">
              <span className="fusion-pulse absolute inline-flex h-full w-full rounded-full bg-emerald-400" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
            </span>
            Access controls live
          </div>
          <div className="flex items-center gap-2">
            <UserCog className="size-6 text-primary" />
            <h1 className="fusion-gradient-text font-headline text-3xl font-extrabold tracking-tight">Access Governance</h1>
          </div>
          <p className="mt-2 text-muted-foreground">
            Operate role catalog, permissions, assignments, ABAC, field access, and segregation-of-duties controls.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {savedAt ? <Badge variant="secondary">Saved {savedAt}</Badge> : null}
          <Button asChild type="button" variant="outline">
            <Link to="/admin/system-console">System Console</Link>
          </Button>
          <Button type="button" variant="outline" onClick={() => refetch()}>
            <RefreshCcw className="mr-2 size-4" />
            Refresh
          </Button>
        </div>
      </div>

      {formError ? (
        <div className="mt-4 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {formError}
        </div>
      ) : null}

      {isError ? (
        <Card className="fusion-glass rounded-2xl border-transparent mt-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldAlert className="size-5 text-destructive" />
              Access Governance API Unavailable
            </CardTitle>
            <CardDescription>The admin page is wired to the backend, but the current API call did not complete.</CardDescription>
          </CardHeader>
        </Card>
      ) : null}

      <section className="grid gap-4 py-6 md:grid-cols-2 xl:grid-cols-7">
        {isLoading ? (
          <>
            <Skeleton className="h-28" />
            <Skeleton className="h-28" />
            <Skeleton className="h-28" />
            <Skeleton className="h-28" />
            <Skeleton className="h-28" />
            <Skeleton className="h-28" />
            <Skeleton className="h-28" />
          </>
        ) : (
          <>
            <StatusStrip label="Roles" value={roles.length} helper="tenant role catalog" icon={UsersRound} />
            <StatusStrip label="Permissions" value={permissions.length} helper="domain permission catalog" icon={KeyRound} />
            <StatusStrip label="User Roles" value={userRoles.length} helper="user-role grants" icon={UserCog} />
            <StatusStrip label="Assignments" value={assignments.length} helper="role-permission joins" icon={GitCompareArrows} />
            <StatusStrip label="Service IDs" value={serviceAccounts.length} helper="service account identities" icon={FileKey2} />
            <StatusStrip label="Reviews" value={accessReviewCampaigns.length} helper={`${accessReviewItems.length} review items`} icon={ShieldAlert} />
            <StatusStrip label="Policies" value={(data?.abacPolicies.length ?? 0) + (data?.fieldAccessPolicies.length ?? 0) + (data?.sodRules.length ?? 0)} helper="ABAC, field, and SoD" icon={ShieldCheck} />
          </>
        )}
      </section>

      <Tabs defaultValue="roles" className="flex flex-col gap-5">
        <TabsList className="grid h-auto grid-cols-2 gap-1 md:grid-cols-5 xl:grid-cols-9">
          <TabsTrigger value="roles">Roles</TabsTrigger>
          <TabsTrigger value="permissions">Permissions</TabsTrigger>
          <TabsTrigger value="assignments">Assignments</TabsTrigger>
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="services">Service Accounts</TabsTrigger>
          <TabsTrigger value="reviews">Reviews</TabsTrigger>
          <TabsTrigger value="abac">ABAC</TabsTrigger>
          <TabsTrigger value="fields">Fields</TabsTrigger>
          <TabsTrigger value="sod">SoD</TabsTrigger>
        </TabsList>

        <TabsContent value="roles" className="grid gap-4 xl:grid-cols-[22rem_1fr]">
          <Card className="fusion-glass rounded-2xl border-transparent">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Plus className="size-5" />
                Add Role
              </CardTitle>
              <CardDescription>Create tenant roles in the RBAC catalog.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="grid gap-2">
                <Label>Code</Label>
                <Input value={roleForm.code} onChange={(event) => setRoleForm({ ...roleForm, code: event.target.value })} placeholder="PAYROLL_VIEWER" />
              </div>
              <div className="grid gap-2">
                <Label>Name</Label>
                <Input value={roleForm.name} onChange={(event) => setRoleForm({ ...roleForm, name: event.target.value })} placeholder="Payroll Viewer" />
              </div>
              <div className="grid gap-2">
                <Label>Tier</Label>
                <Select value={roleForm.tier} onValueChange={(value) => setRoleForm({ ...roleForm, tier: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="SYSTEM">System</SelectItem>
                    <SelectItem value="TENANT">Tenant</SelectItem>
                    <SelectItem value="BUSINESS">Business</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Description</Label>
                <Input value={roleForm.description} onChange={(event) => setRoleForm({ ...roleForm, description: event.target.value })} />
              </div>
              <Button type="button" onClick={submitRole} disabled={roleMutation.isPending}>
                <Save className="mr-2 size-4" />
                {roleMutation.isPending ? 'Saving...' : 'Create Role'}
              </Button>
            </CardContent>
          </Card>

          <Card className="fusion-glass rounded-2xl border-transparent">
            <CardHeader>
              <CardTitle>Role Catalog</CardTitle>
              <CardDescription>{roles.length} roles available to this tenant.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-5">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Code</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Tier</TableHead>
                    <TableHead>System</TableHead>
                    <TableHead>Created</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {roles.length > 0 ? roles.map((role) => (
                    <TableRow key={role.id}>
                      <TableCell className="font-mono text-xs">{role.code}</TableCell>
                      <TableCell>
                        <p className="font-medium">{role.name}</p>
                        <p className="text-xs text-muted-foreground">{role.description ?? '-'}</p>
                      </TableCell>
                      <TableCell>{role.tier}</TableCell>
                      <TableCell>{role.isSystem ? <Badge variant="secondary">System</Badge> : <Badge variant="outline">Tenant</Badge>}</TableCell>
                      <TableCell>{formatDate(role.createdAt)}</TableCell>
                    </TableRow>
                  )) : <EmptyRows colSpan={5} label="No roles have been created yet." />}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="permissions" className="grid gap-4 xl:grid-cols-[22rem_1fr]">
          <Card className="fusion-glass rounded-2xl border-transparent">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <FileKey2 className="size-5" />
                Add Permission
              </CardTitle>
              <CardDescription>Define permissions by domain and data classification.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="grid gap-2">
                <Label>Code</Label>
                <Input value={permissionForm.code} onChange={(event) => setPermissionForm({ ...permissionForm, code: event.target.value })} placeholder="PAYROLL_READ" />
              </div>
              <div className="grid gap-2">
                <Label>Domain</Label>
                <Input value={permissionForm.domain} onChange={(event) => setPermissionForm({ ...permissionForm, domain: event.target.value })} />
              </div>
              <div className="grid gap-2">
                <Label>Data Classification</Label>
                <Input value={permissionForm.dataClassification} onChange={(event) => setPermissionForm({ ...permissionForm, dataClassification: event.target.value })} />
              </div>
              <div className="grid gap-2">
                <Label>Audit On Access</Label>
                <Select value={permissionForm.auditOnAccess} onValueChange={(value) => setPermissionForm({ ...permissionForm, auditOnAccess: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="false">No</SelectItem>
                    <SelectItem value="true">Yes</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Description</Label>
                <Input value={permissionForm.description} onChange={(event) => setPermissionForm({ ...permissionForm, description: event.target.value })} />
              </div>
              <Button
                type="button"
                onClick={submitPermission}
                disabled={permissionMutation.isPending}
              >
                <Save className="mr-2 size-4" />
                {permissionMutation.isPending ? 'Saving...' : 'Create Permission'}
              </Button>
            </CardContent>
          </Card>

          <Card className="fusion-glass rounded-2xl border-transparent">
            <CardHeader>
              <CardTitle>Permission Catalog</CardTitle>
              <CardDescription>{permissions.length} permission records backed by the database.</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Code</TableHead>
                    <TableHead>Domain</TableHead>
                    <TableHead>Classification</TableHead>
                    <TableHead>Audit</TableHead>
                    <TableHead>Description</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {permissions.length > 0 ? permissions.map((permission) => (
                    <TableRow key={permission.id}>
                      <TableCell className="font-mono text-xs">{permission.code}</TableCell>
                      <TableCell>{permission.domain}</TableCell>
                      <TableCell>{permission.dataClassification ?? '-'}</TableCell>
                      <TableCell>{permission.auditOnAccess ? <Badge variant="secondary">Audited</Badge> : <Badge variant="outline">Standard</Badge>}</TableCell>
                      <TableCell>{permission.description ?? '-'}</TableCell>
                    </TableRow>
                  )) : <EmptyRows colSpan={5} label="No permissions have been created yet." />}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="assignments" className="grid gap-4 xl:grid-cols-[22rem_1fr]">
          <Card className="fusion-glass rounded-2xl border-transparent">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <GitCompareArrows className="size-5" />
                Assign Permission
              </CardTitle>
              <CardDescription>Persist role-permission joins in RBAC.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="grid gap-2">
                <Label>Role</Label>
                <Select value={selectedRoleId} onValueChange={setSelectedRoleId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    {roles.map((role) => <SelectItem key={role.id} value={role.id}>{role.code}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Permission</Label>
                <Select value={selectedPermissionId} onValueChange={setSelectedPermissionId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select permission" />
                  </SelectTrigger>
                  <SelectContent>
                    {permissions.map((permission) => <SelectItem key={permission.id} value={permission.id}>{permission.code}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <Button type="button" onClick={submitAssignment} disabled={assignmentMutation.isPending || roles.length === 0 || permissions.length === 0}>
                <CheckCircle2 className="mr-2 size-4" />
                {assignmentMutation.isPending ? 'Assigning...' : 'Assign Permission'}
              </Button>
            </CardContent>
          </Card>

          <Card className="fusion-glass rounded-2xl border-transparent">
            <CardHeader>
              <CardTitle>Role-Permission Assignments</CardTitle>
              <CardDescription>{assignments.length} persisted assignments.</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Role</TableHead>
                    <TableHead>Permission</TableHead>
                    <TableHead className="w-20">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {assignments.length > 0 ? assignments.map((assignment) => (
                    <TableRow key={`${assignment.roleId}-${assignment.permissionId}`}>
                      <TableCell className="font-mono text-xs">{assignment.roleCode}</TableCell>
                      <TableCell className="font-mono text-xs">{assignment.permissionCode}</TableCell>
                      <TableCell>
                        <Button
                          aria-label={`Remove ${assignment.permissionCode} from ${assignment.roleCode}`}
                          size="icon"
                          type="button"
                          variant="ghost"
                          onClick={() => removeAssignmentMutation.mutate({ roleId: assignment.roleId, permissionId: assignment.permissionId })}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  )) : <EmptyRows colSpan={3} label="No role-permission assignments exist yet." />}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="users" className="grid gap-4 xl:grid-cols-[24rem_1fr]">
          <Card className="fusion-glass rounded-2xl border-transparent">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <UserCog className="size-5" />
                Assign User Role
              </CardTitle>
              <CardDescription>Grant a tenant role to a user identity with optional expiry.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="grid gap-2">
                <Label>User ID</Label>
                <Input value={userRoleForm.userId} onChange={(event) => setUserRoleForm({ ...userRoleForm, userId: event.target.value })} placeholder="00000000-0000-0000-0000-000000000010" />
              </div>
              <div className="grid gap-2">
                <Label>Role</Label>
                <Select value={userRoleForm.roleId} onValueChange={(value) => setUserRoleForm({ ...userRoleForm, roleId: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    {roles.map((role) => <SelectItem key={role.id} value={role.id}>{role.code}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Expires At</Label>
                <Input type="datetime-local" value={userRoleForm.expiresAt} onChange={(event) => setUserRoleForm({ ...userRoleForm, expiresAt: event.target.value })} />
              </div>
              <Button type="button" onClick={submitUserRole} disabled={userRoleMutation.isPending || roles.length === 0}>
                <CheckCircle2 className="mr-2 size-4" />
                {userRoleMutation.isPending ? 'Assigning...' : 'Assign Role'}
              </Button>
            </CardContent>
          </Card>

          <Card className="fusion-glass rounded-2xl border-transparent">
            <CardHeader>
              <CardTitle>User Role Grants</CardTitle>
              <CardDescription>{userRoles.length} active or expiring user-role assignments.</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Assigned</TableHead>
                    <TableHead>Expires</TableHead>
                    <TableHead className="w-20">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {userRoles.length > 0 ? userRoles.map((assignment) => (
                    <TableRow key={assignment.id}>
                      <TableCell className="font-mono text-xs">{assignment.userId}</TableCell>
                      <TableCell className="font-mono text-xs">{assignment.roleCode}</TableCell>
                      <TableCell>{formatDate(assignment.assignedAt)}</TableCell>
                      <TableCell>{formatDate(assignment.expiresAt ?? undefined)}</TableCell>
                      <TableCell>
                        <Button
                          aria-label={`Remove ${assignment.roleCode} from user`}
                          size="icon"
                          type="button"
                          variant="ghost"
                          onClick={() => removeUserRoleMutation.mutate({ userId: assignment.userId, roleId: assignment.roleId })}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  )) : <EmptyRows colSpan={5} label="No user-role grants exist yet." />}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="services" className="grid gap-4 xl:grid-cols-[25rem_1fr]">
          <Card className="fusion-glass rounded-2xl border-transparent">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <FileKey2 className="size-5" />
                Create Service Account
              </CardTitle>
              <CardDescription>Register machine identities with scopes, owner, and rotation policy.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="grid gap-2">
                <Label>Code</Label>
                <Input value={serviceAccountForm.code} onChange={(event) => setServiceAccountForm({ ...serviceAccountForm, code: event.target.value })} placeholder="PAYROLL_EXPORT_BOT" />
              </div>
              <div className="grid gap-2">
                <Label>Name</Label>
                <Input value={serviceAccountForm.name} onChange={(event) => setServiceAccountForm({ ...serviceAccountForm, name: event.target.value })} placeholder="Payroll Export Bot" />
              </div>
              <div className="grid gap-2">
                <Label>Owner Worker ID</Label>
                <Input value={serviceAccountForm.ownerWorkerId} onChange={(event) => setServiceAccountForm({ ...serviceAccountForm, ownerWorkerId: event.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-2">
                  <Label>Status</Label>
                  <Select value={serviceAccountForm.status} onValueChange={(value) => setServiceAccountForm({ ...serviceAccountForm, status: value })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ACTIVE">Active</SelectItem>
                      <SelectItem value="DISABLED">Disabled</SelectItem>
                      <SelectItem value="ROTATION_DUE">Rotation Due</SelectItem>
                      <SelectItem value="EXPIRED">Expired</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label>Rotation Days</Label>
                  <Input type="number" value={serviceAccountForm.credentialRotationDays} onChange={(event) => setServiceAccountForm({ ...serviceAccountForm, credentialRotationDays: event.target.value })} />
                </div>
              </div>
              <div className="grid gap-2">
                <Label>Expires At</Label>
                <Input type="datetime-local" value={serviceAccountForm.expiresAt} onChange={(event) => setServiceAccountForm({ ...serviceAccountForm, expiresAt: event.target.value })} />
              </div>
              <JsonTextarea label="Scopes JSON" value={serviceAccountForm.scopes} onChange={(value) => setServiceAccountForm({ ...serviceAccountForm, scopes: value })} rows={4} />
              <Button type="button" onClick={submitServiceAccount} disabled={serviceAccountMutation.isPending}>
                <Save className="mr-2 size-4" />
                {serviceAccountMutation.isPending ? 'Saving...' : 'Create Service Account'}
              </Button>
            </CardContent>
          </Card>

          <Card className="fusion-glass rounded-2xl border-transparent">
            <CardHeader>
              <CardTitle>Service Accounts</CardTitle>
              <CardDescription>{serviceAccounts.length} registered service identities.</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Account</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Rotation</TableHead>
                    <TableHead>Expires</TableHead>
                    <TableHead>Scopes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {serviceAccounts.length > 0 ? serviceAccounts.map((account) => (
                    <TableRow key={account.id}>
                      <TableCell>
                        <p className="font-mono text-xs">{account.code}</p>
                        <p className="text-xs text-muted-foreground">{account.name}</p>
                      </TableCell>
                      <TableCell><Badge variant={account.status === 'ACTIVE' ? 'secondary' : 'outline'}>{account.status}</Badge></TableCell>
                      <TableCell>{account.credentialRotationDays} days</TableCell>
                      <TableCell>{formatDate(account.expiresAt ?? undefined)}</TableCell>
                      <TableCell><pre className="max-h-24 overflow-auto rounded-md bg-muted p-2 text-xs">{asJson(account.scopes)}</pre></TableCell>
                    </TableRow>
                  )) : <EmptyRows colSpan={5} label="No service accounts have been created yet." />}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card className="fusion-glass rounded-2xl border-transparent xl:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <KeyRound className="size-5" />
                Credential Vault
              </CardTitle>
              <CardDescription>Issue one-time secrets, rotate active credentials, and revoke compromised keys.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-5 xl:grid-cols-[24rem_1fr]">
              <div className="flex flex-col gap-4">
                <div className="grid gap-2">
                  <Label>Service Account</Label>
                  <Select value={serviceCredentialForm.serviceAccountId} onValueChange={(value) => setServiceCredentialForm({ ...serviceCredentialForm, serviceAccountId: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select service account" />
                    </SelectTrigger>
                    <SelectContent>
                      {serviceAccounts.map((account) => <SelectItem key={account.id} value={account.id}>{account.code}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label>Credential Name</Label>
                  <Input value={serviceCredentialForm.name} onChange={(event) => setServiceCredentialForm({ ...serviceCredentialForm, name: event.target.value })} placeholder="Payroll API key" />
                </div>
                <div className="grid gap-2">
                  <Label>Expires At</Label>
                  <Input type="datetime-local" value={serviceCredentialForm.expiresAt} onChange={(event) => setServiceCredentialForm({ ...serviceCredentialForm, expiresAt: event.target.value })} />
                </div>
                <JsonTextarea label="Credential Scopes JSON" rows={4} value={serviceCredentialForm.scopes} onChange={(value) => setServiceCredentialForm({ ...serviceCredentialForm, scopes: value })} />
                <Button type="button" onClick={submitServiceCredential} disabled={issueCredentialMutation.isPending || serviceAccounts.length === 0}>
                  <KeyRound className="mr-2 size-4" />
                  {issueCredentialMutation.isPending ? 'Issuing...' : 'Issue One-Time Secret'}
                </Button>
                {issuedCredential ? (
                  <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-950">
                    <p className="font-semibold">One-time secret issued</p>
                    <p className="mt-1 text-xs">Store this now. It will not appear again in the admin summary.</p>
                    <pre className="mt-3 overflow-auto rounded-md bg-white p-2 font-mono text-xs">{issuedCredential.oneTimeSecret}</pre>
                    <p className="mt-2 font-mono text-xs">Prefix: {issuedCredential.secretPrefix}</p>
                  </div>
                ) : null}
              </div>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Credential</TableHead>
                      <TableHead>Account</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Issued</TableHead>
                      <TableHead>Expires</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {serviceAccountCredentials.length > 0 ? serviceAccountCredentials.map((credential) => {
                      const account = serviceAccounts.find((item) => item.id === credential.serviceAccountId);
                      const isActive = credential.status === 'ACTIVE';
                      return (
                        <TableRow key={credential.id}>
                          <TableCell>
                            <p className="font-medium">{credential.name}</p>
                            <p className="font-mono text-xs text-muted-foreground">{credential.secretPrefix}...</p>
                          </TableCell>
                          <TableCell className="font-mono text-xs">{account?.code ?? credential.serviceAccountId}</TableCell>
                          <TableCell><Badge variant={isActive ? 'secondary' : 'outline'}>{credential.status}</Badge></TableCell>
                          <TableCell>{formatDate(credential.issuedAt)}</TableCell>
                          <TableCell>{formatDate(credential.expiresAt ?? undefined)}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button
                                size="sm"
                                type="button"
                                variant="outline"
                                disabled={!isActive || rotateCredentialMutation.isPending}
                                onClick={() => rotateCredentialMutation.mutate({ accountId: credential.serviceAccountId, credentialId: credential.id })}
                              >
                                <RefreshCcw className="mr-2 size-3" />
                                Rotate
                              </Button>
                              <Button
                                size="sm"
                                type="button"
                                variant="destructive"
                                disabled={!isActive || revokeCredentialMutation.isPending}
                                onClick={() => revokeCredentialMutation.mutate({ accountId: credential.serviceAccountId, credentialId: credential.id })}
                              >
                                Revoke
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    }) : <EmptyRows colSpan={6} label="No credentials have been issued yet." />}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="reviews" className="grid gap-4 2xl:grid-cols-[25rem_25rem_1fr]">
          <Card className="fusion-glass rounded-2xl border-transparent">
            <CardHeader>
              <CardTitle>Access Review Campaign</CardTitle>
              <CardDescription>Create certification campaigns for users, roles, permissions, and service accounts.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="grid gap-2">
                <Label>Code</Label>
                <Input value={accessReviewCampaignForm.code} onChange={(event) => setAccessReviewCampaignForm({ ...accessReviewCampaignForm, code: event.target.value })} placeholder="Q2_PRIVILEGED_REVIEW" />
              </div>
              <div className="grid gap-2">
                <Label>Name</Label>
                <Input value={accessReviewCampaignForm.name} onChange={(event) => setAccessReviewCampaignForm({ ...accessReviewCampaignForm, name: event.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-2">
                  <Label>Status</Label>
                  <Select value={accessReviewCampaignForm.status} onValueChange={(value) => setAccessReviewCampaignForm({ ...accessReviewCampaignForm, status: value })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="DRAFT">Draft</SelectItem>
                      <SelectItem value="LAUNCHED">Launched</SelectItem>
                      <SelectItem value="IN_REVIEW">In Review</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label>Reviewer Role</Label>
                  <Input value={accessReviewCampaignForm.reviewerRole} onChange={(event) => setAccessReviewCampaignForm({ ...accessReviewCampaignForm, reviewerRole: event.target.value })} />
                </div>
              </div>
              <div className="grid gap-2">
                <Label>Due At</Label>
                <Input type="datetime-local" value={accessReviewCampaignForm.dueAt} onChange={(event) => setAccessReviewCampaignForm({ ...accessReviewCampaignForm, dueAt: event.target.value })} />
              </div>
              <JsonTextarea label="Scope JSON" value={accessReviewCampaignForm.scope} onChange={(value) => setAccessReviewCampaignForm({ ...accessReviewCampaignForm, scope: value })} rows={4} />
              <Button type="button" onClick={submitAccessReviewCampaign} disabled={accessReviewCampaignMutation.isPending}>
                <Save className="mr-2 size-4" />
                {accessReviewCampaignMutation.isPending ? 'Saving...' : 'Create Campaign'}
              </Button>
            </CardContent>
          </Card>

          <Card className="fusion-glass rounded-2xl border-transparent">
            <CardHeader>
              <CardTitle>Review Item</CardTitle>
              <CardDescription>Add an entitlement, user, worker, or service identity to a campaign.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="grid gap-2">
                <Label>Campaign</Label>
                <Select value={accessReviewItemForm.campaignId} onValueChange={(value) => setAccessReviewItemForm({ ...accessReviewItemForm, campaignId: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select campaign" />
                  </SelectTrigger>
                  <SelectContent>
                    {accessReviewCampaigns.map((campaign) => <SelectItem key={campaign.id} value={campaign.id}>{campaign.code}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Subject User ID</Label>
                <Input value={accessReviewItemForm.subjectUserId} onChange={(event) => setAccessReviewItemForm({ ...accessReviewItemForm, subjectUserId: event.target.value })} />
              </div>
              <div className="grid gap-2">
                <Label>Subject Worker ID</Label>
                <Input value={accessReviewItemForm.subjectWorkerId} onChange={(event) => setAccessReviewItemForm({ ...accessReviewItemForm, subjectWorkerId: event.target.value })} />
              </div>
              <div className="grid gap-3 md:grid-cols-3">
                <Select value={accessReviewItemForm.roleId} onValueChange={(value) => setAccessReviewItemForm({ ...accessReviewItemForm, roleId: value })}>
                  <SelectTrigger><SelectValue placeholder="Role" /></SelectTrigger>
                  <SelectContent>{roles.map((role) => <SelectItem key={role.id} value={role.id}>{role.code}</SelectItem>)}</SelectContent>
                </Select>
                <Select value={accessReviewItemForm.permissionId} onValueChange={(value) => setAccessReviewItemForm({ ...accessReviewItemForm, permissionId: value })}>
                  <SelectTrigger><SelectValue placeholder="Permission" /></SelectTrigger>
                  <SelectContent>{permissions.map((permission) => <SelectItem key={permission.id} value={permission.id}>{permission.code}</SelectItem>)}</SelectContent>
                </Select>
                <Select value={accessReviewItemForm.serviceAccountId} onValueChange={(value) => setAccessReviewItemForm({ ...accessReviewItemForm, serviceAccountId: value })}>
                  <SelectTrigger><SelectValue placeholder="Service ID" /></SelectTrigger>
                  <SelectContent>{serviceAccounts.map((account) => <SelectItem key={account.id} value={account.id}>{account.code}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <JsonTextarea label="Evidence JSON" value={accessReviewItemForm.evidence} onChange={(value) => setAccessReviewItemForm({ ...accessReviewItemForm, evidence: value })} rows={4} />
              <Button type="button" onClick={submitAccessReviewItem} disabled={accessReviewItemMutation.isPending || accessReviewCampaigns.length === 0}>
                <Plus className="mr-2 size-4" />
                {accessReviewItemMutation.isPending ? 'Adding...' : 'Add Review Item'}
              </Button>
            </CardContent>
          </Card>

          <Card className="fusion-glass rounded-2xl border-transparent">
            <CardHeader>
              <CardTitle>Access Reviews</CardTitle>
              <CardDescription>{accessReviewCampaigns.length} campaigns and {accessReviewItems.length} review items.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-5">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Campaign</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Reviewer</TableHead>
                    <TableHead>Due</TableHead>
                    <TableHead>Certification</TableHead>
                    <TableHead className="text-right">Workflow</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {accessReviewCampaigns.length > 0 ? accessReviewCampaigns.map((campaign) => {
                    const pendingItems = accessReviewItems.filter((item) => item.campaignId === campaign.id && item.decision === 'PENDING').length;
                    const isClosed = campaign.status === 'COMPLETED' || campaign.status === 'CANCELLED';
                    return (
                      <TableRow key={campaign.id}>
                        <TableCell>
                          <p className="font-mono text-xs">{campaign.code}</p>
                          <p className="text-xs text-muted-foreground">{campaign.name}</p>
                        </TableCell>
                        <TableCell><Badge variant={campaign.status === 'COMPLETED' ? 'secondary' : 'outline'}>{campaign.status}</Badge></TableCell>
                        <TableCell>{campaign.reviewerRole}</TableCell>
                        <TableCell>{formatDate(campaign.dueAt ?? undefined)}</TableCell>
                        <TableCell>
                          <div className="space-y-1 text-xs text-muted-foreground">
                            <p>{pendingItems} pending items</p>
                            <p>Last reminder: {formatDate(campaign.lastReminderAt ?? undefined)}</p>
                            <p>Escalations: {campaign.escalationCount}</p>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex flex-wrap justify-end gap-2">
                            <Button size="sm" type="button" variant="outline" disabled={isClosed || accessReviewCommandMutation.isPending} onClick={() => accessReviewCommandMutation.mutate({ campaignId: campaign.id, command: 'launch' })}>
                              Launch
                            </Button>
                            <Button size="sm" type="button" variant="outline" disabled={isClosed || pendingItems === 0 || accessReviewCommandMutation.isPending} onClick={() => accessReviewCommandMutation.mutate({ campaignId: campaign.id, command: 'remind', message: 'Please complete your access certification.' })}>
                              Remind
                            </Button>
                            <Button size="sm" type="button" variant="outline" disabled={isClosed || pendingItems === 0 || accessReviewCommandMutation.isPending} onClick={() => accessReviewCommandMutation.mutate({ campaignId: campaign.id, command: 'escalate', message: 'Access certification is overdue.' })}>
                              Escalate
                            </Button>
                            <Button size="sm" type="button" disabled={isClosed || pendingItems > 0 || accessReviewCommandMutation.isPending} onClick={() => accessReviewCommandMutation.mutate({ campaignId: campaign.id, command: 'complete' })}>
                              Complete
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  }) : <EmptyRows colSpan={6} label="No access review campaigns have been created yet." />}
                </TableBody>
              </Table>
              <div className="rounded-lg border p-3">
                <div className="mb-3 flex items-center justify-between">
                  <p className="font-semibold">Review Items</p>
                  <Badge variant="secondary">{accessReviewItems.length}</Badge>
                </div>
                <div className="mb-4 grid gap-3 md:grid-cols-2">
                  <Select value={accessReviewItemForm.campaignId} onValueChange={(value) => setAccessReviewItemForm({ ...accessReviewItemForm, campaignId: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Campaign" />
                    </SelectTrigger>
                    <SelectContent>
                      {accessReviewCampaigns.map((campaign) => <SelectItem key={campaign.id} value={campaign.id}>{campaign.code}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Input value={accessReviewItemForm.subjectUserId} onChange={(event) => setAccessReviewItemForm({ ...accessReviewItemForm, subjectUserId: event.target.value })} placeholder="Subject user UUID" />
                  <Input value={accessReviewItemForm.subjectWorkerId} onChange={(event) => setAccessReviewItemForm({ ...accessReviewItemForm, subjectWorkerId: event.target.value })} placeholder="Subject worker UUID" />
                  <Select value={accessReviewItemForm.roleId || 'NONE'} onValueChange={(value) => setAccessReviewItemForm({ ...accessReviewItemForm, roleId: value === 'NONE' ? '' : value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Role" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="NONE">No role</SelectItem>
                      {roles.map((role) => <SelectItem key={role.id} value={role.id}>{role.code}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Select value={accessReviewItemForm.permissionId || 'NONE'} onValueChange={(value) => setAccessReviewItemForm({ ...accessReviewItemForm, permissionId: value === 'NONE' ? '' : value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Permission" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="NONE">No permission</SelectItem>
                      {permissions.map((permission) => <SelectItem key={permission.id} value={permission.id}>{permission.code}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Select value={accessReviewItemForm.serviceAccountId || 'NONE'} onValueChange={(value) => setAccessReviewItemForm({ ...accessReviewItemForm, serviceAccountId: value === 'NONE' ? '' : value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Service account" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="NONE">No service account</SelectItem>
                      {serviceAccounts.map((account) => <SelectItem key={account.id} value={account.id}>{account.code}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <JsonTextarea label="Evidence JSON" rows={3} value={accessReviewItemForm.evidence} onChange={(value) => setAccessReviewItemForm({ ...accessReviewItemForm, evidence: value })} />
                <Button className="my-3" type="button" onClick={submitAccessReviewItem} disabled={accessReviewItemMutation.isPending || accessReviewCampaigns.length === 0}>
                  <Plus className="mr-2 size-4" />
                  Create Review Item
                </Button>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Subject</TableHead>
                      <TableHead>Entitlement</TableHead>
                      <TableHead>Decision</TableHead>
                      <TableHead className="w-44">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {accessReviewItems.length > 0 ? accessReviewItems.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-mono text-xs">{item.subjectUserId ?? item.subjectWorkerId ?? item.serviceAccountCode ?? '-'}</TableCell>
                        <TableCell>{item.roleCode ?? item.permissionCode ?? item.serviceAccountCode ?? '-'}</TableCell>
                        <TableCell>
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant={item.decision === 'REVOKE' ? 'destructive' : 'outline'}>{item.decision}</Badge>
                            {item.decision === 'PENDING' ? (
                              <>
                                <Button type="button" size="sm" variant="outline" onClick={() => accessReviewDecisionMutation.mutate({ itemId: item.id, decision: 'APPROVED' })}>
                                  Approve
                                </Button>
                                <Button type="button" size="sm" variant="outline" onClick={() => accessReviewDecisionMutation.mutate({ itemId: item.id, decision: 'REVOKE' })}>
                                  Revoke
                                </Button>
                              </>
                            ) : null}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            {['APPROVED', 'REVOKE', 'ESCALATE'].map((decision) => (
                              <Button
                                key={decision}
                                size="sm"
                                type="button"
                                variant={decision === 'REVOKE' ? 'destructive' : 'outline'}
                                onClick={() => accessReviewDecisionMutation.mutate({ itemId: item.id, decision })}
                              >
                                {decision === 'APPROVED' ? 'Approve' : decision === 'REVOKE' ? 'Revoke' : 'Escalate'}
                              </Button>
                            ))}
                          </div>
                        </TableCell>
                      </TableRow>
                    )) : <EmptyRows colSpan={4} label="No access review items have been created yet." />}
                  </TableBody>
                </Table>
              </div>
              <div className="rounded-lg border p-3">
                <div className="mb-3 flex items-center justify-between">
                  <p className="font-semibold">Workflow History</p>
                  <Badge variant="outline">{accessReviewWorkflowEvents.length}</Badge>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Event</TableHead>
                      <TableHead>Campaign</TableHead>
                      <TableHead>Pending</TableHead>
                      <TableHead>Message</TableHead>
                      <TableHead>Created</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {accessReviewWorkflowEvents.length > 0 ? accessReviewWorkflowEvents.map((event) => {
                      const campaign = accessReviewCampaigns.find((item) => item.id === event.campaignId);
                      return (
                        <TableRow key={event.id}>
                          <TableCell><Badge variant="outline">{event.eventType}</Badge></TableCell>
                          <TableCell className="font-mono text-xs">{campaign?.code ?? event.campaignId}</TableCell>
                          <TableCell>{event.pendingItemCount}</TableCell>
                          <TableCell className="max-w-xs truncate">{event.message ?? '-'}</TableCell>
                          <TableCell>{formatDate(event.createdAt)}</TableCell>
                        </TableRow>
                      );
                    }) : <EmptyRows colSpan={5} label="No workflow events have been recorded yet." />}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="abac" className="grid gap-4 xl:grid-cols-[25rem_1fr]">
          <Card className="fusion-glass rounded-2xl border-transparent">
            <CardHeader>
              <CardTitle>ABAC Policy</CardTitle>
              <CardDescription>Create attribute policies with explicit ALLOW or DENY effects.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="grid gap-2">
                <Label>Dimension</Label>
                <Input value={abacForm.dimension} onChange={(event) => setAbacForm({ ...abacForm, dimension: event.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-2">
                  <Label>Effect</Label>
                  <Select value={abacForm.effect} onValueChange={(value) => setAbacForm({ ...abacForm, effect: value as 'ALLOW' | 'DENY' })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALLOW">Allow</SelectItem>
                      <SelectItem value="DENY">Deny</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label>Priority</Label>
                  <Input type="number" value={abacForm.priority} onChange={(event) => setAbacForm({ ...abacForm, priority: event.target.value })} />
                </div>
              </div>
              <JsonTextarea label="Conditions JSON" value={abacForm.conditions} onChange={(value) => setAbacForm({ ...abacForm, conditions: value })} />
              <Button type="button" onClick={submitAbac} disabled={abacMutation.isPending}>
                <Save className="mr-2 size-4" />
                {abacMutation.isPending ? 'Saving...' : 'Create ABAC Policy'}
              </Button>
            </CardContent>
          </Card>

          <Card className="fusion-glass rounded-2xl border-transparent">
            <CardHeader>
              <CardTitle>ABAC Policies</CardTitle>
              <CardDescription>{data?.abacPolicies.length ?? 0} policies ordered by priority.</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Dimension</TableHead>
                    <TableHead>Effect</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead>Conditions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(data?.abacPolicies ?? []).length > 0 ? data?.abacPolicies.map((policy) => (
                    <TableRow key={policy.id}>
                      <TableCell>{policy.dimension}</TableCell>
                      <TableCell><Badge variant={policy.effect === 'ALLOW' ? 'secondary' : 'destructive'}>{policy.effect}</Badge></TableCell>
                      <TableCell>{policy.priority}</TableCell>
                      <TableCell><pre className="max-h-24 overflow-auto rounded-md bg-muted p-2 text-xs">{asJson(policy.conditions)}</pre></TableCell>
                    </TableRow>
                  )) : <EmptyRows colSpan={4} label="No ABAC policies have been created yet." />}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="fields" className="grid gap-4 xl:grid-cols-[25rem_1fr]">
          <Card className="fusion-glass rounded-2xl border-transparent">
            <CardHeader>
              <CardTitle>Field Access Policy</CardTitle>
              <CardDescription>Control masking and visibility for sensitive HR fields.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="grid gap-2">
                <Label>Field Path</Label>
                <Input value={fieldPolicyForm.fieldPath} onChange={(event) => setFieldPolicyForm({ ...fieldPolicyForm, fieldPath: event.target.value })} />
              </div>
              <div className="grid gap-2">
                <Label>Data Classification</Label>
                <Input value={fieldPolicyForm.dataClassification} onChange={(event) => setFieldPolicyForm({ ...fieldPolicyForm, dataClassification: event.target.value })} />
              </div>
              <JsonTextarea label="Role Decisions JSON" value={fieldPolicyForm.roleDecisions} onChange={(value) => setFieldPolicyForm({ ...fieldPolicyForm, roleDecisions: value })} />
              <div className="grid gap-3 md:grid-cols-3">
                <Input value={fieldPolicyForm.selfServiceDecision} onChange={(event) => setFieldPolicyForm({ ...fieldPolicyForm, selfServiceDecision: event.target.value })} placeholder="Self service" />
                <Input value={fieldPolicyForm.managerDecision} onChange={(event) => setFieldPolicyForm({ ...fieldPolicyForm, managerDecision: event.target.value })} placeholder="Manager" />
                <Input value={fieldPolicyForm.maskingRule} onChange={(event) => setFieldPolicyForm({ ...fieldPolicyForm, maskingRule: event.target.value })} placeholder="Masking rule" />
              </div>
              <Button type="button" onClick={submitFieldPolicy} disabled={fieldPolicyMutation.isPending}>
                <Save className="mr-2 size-4" />
                {fieldPolicyMutation.isPending ? 'Saving...' : 'Create Field Policy'}
              </Button>
            </CardContent>
          </Card>

          <Card className="fusion-glass rounded-2xl border-transparent">
            <CardHeader>
              <CardTitle>Field Access Policies</CardTitle>
              <CardDescription>{data?.fieldAccessPolicies.length ?? 0} field-level controls.</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Field</TableHead>
                    <TableHead>Classification</TableHead>
                    <TableHead>Self</TableHead>
                    <TableHead>Manager</TableHead>
                    <TableHead>Role Decisions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(data?.fieldAccessPolicies ?? []).length > 0 ? data?.fieldAccessPolicies.map((policy) => (
                    <TableRow key={policy.id}>
                      <TableCell className="font-mono text-xs">{policy.fieldPath}</TableCell>
                      <TableCell>{policy.dataClassification}</TableCell>
                      <TableCell>{policy.selfServiceDecision ?? '-'}</TableCell>
                      <TableCell>{policy.managerDecision ?? '-'}</TableCell>
                      <TableCell><pre className="max-h-24 overflow-auto rounded-md bg-muted p-2 text-xs">{asJson(policy.roleDecisions)}</pre></TableCell>
                    </TableRow>
                  )) : <EmptyRows colSpan={5} label="No field access policies have been created yet." />}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sod" className="grid gap-4 xl:grid-cols-[25rem_1fr]">
          <Card className="fusion-glass rounded-2xl border-transparent">
            <CardHeader>
              <CardTitle>SoD Rule</CardTitle>
              <CardDescription>Create segregation-of-duties rules for incompatible roles or permissions.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="grid gap-2">
                <Label>Code</Label>
                <Input value={sodForm.code} onChange={(event) => setSodForm({ ...sodForm, code: event.target.value })} placeholder="PAYROLL_APPROVAL_SPLIT" />
              </div>
              <div className="grid gap-2">
                <Label>Description</Label>
                <Input value={sodForm.description} onChange={(event) => setSodForm({ ...sodForm, description: event.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-2">
                  <Label>Enforcement Point</Label>
                  <Input value={sodForm.enforcementPoint} onChange={(event) => setSodForm({ ...sodForm, enforcementPoint: event.target.value })} />
                </div>
                <div className="grid gap-2">
                  <Label>Break Glass</Label>
                  <Select value={sodForm.breakGlassAllowed} onValueChange={(value) => setSodForm({ ...sodForm, breakGlassAllowed: value })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="false">Not Allowed</SelectItem>
                      <SelectItem value="true">Allowed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <JsonTextarea label="Incompatible Role Pairs JSON" value={sodForm.incompatibleRolePairs} onChange={(value) => setSodForm({ ...sodForm, incompatibleRolePairs: value })} />
              <JsonTextarea label="Incompatible Permission Pairs JSON" value={sodForm.incompatiblePermissionPairs} onChange={(value) => setSodForm({ ...sodForm, incompatiblePermissionPairs: value })} rows={3} />
              <Button type="button" onClick={submitSodRule} disabled={sodMutation.isPending}>
                <Save className="mr-2 size-4" />
                {sodMutation.isPending ? 'Saving...' : 'Create SoD Rule'}
              </Button>
            </CardContent>
          </Card>

          <Card className="fusion-glass rounded-2xl border-transparent">
            <CardHeader>
              <CardTitle>SoD Rules</CardTitle>
              <CardDescription>{data?.sodRules.length ?? 0} segregation rules.</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Code</TableHead>
                    <TableHead>Enforcement</TableHead>
                    <TableHead>Break Glass</TableHead>
                    <TableHead>Role Pairs</TableHead>
                    <TableHead>Permission Pairs</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(data?.sodRules ?? []).length > 0 ? data?.sodRules.map((rule) => (
                    <TableRow key={rule.id}>
                      <TableCell>
                        <p className="font-mono text-xs">{rule.code}</p>
                        <p className="text-xs text-muted-foreground">{rule.description ?? '-'}</p>
                      </TableCell>
                      <TableCell>{rule.enforcementPoint ?? '-'}</TableCell>
                      <TableCell>{rule.breakGlassAllowed ? <Badge variant="secondary">Allowed</Badge> : <Badge variant="outline">Blocked</Badge>}</TableCell>
                      <TableCell><pre className="max-h-24 overflow-auto rounded-md bg-muted p-2 text-xs">{asJson(rule.incompatibleRolePairs)}</pre></TableCell>
                      <TableCell><pre className="max-h-24 overflow-auto rounded-md bg-muted p-2 text-xs">{asJson(rule.incompatiblePermissionPairs)}</pre></TableCell>
                    </TableRow>
                  )) : <EmptyRows colSpan={5} label="No SoD rules have been created yet." />}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export type BackendRequiredStatus = {
  status: 'backend-required';
  reason: string;
};

export type RoleView = {
  id: string;
  code: string;
  name: string;
  tier: string;
  description: string | null;
  isSystem: boolean;
  createdAt: string;
};

export type PermissionView = {
  id: string;
  code: string;
  description: string | null;
  domain: string;
  dataClassification: string | null;
  auditOnAccess: boolean;
};

export type RolePermissionView = {
  roleId: string;
  permissionId: string;
  roleCode: string;
  permissionCode: string;
};

export type UserRoleView = {
  id: string;
  userId: string;
  roleId: string;
  roleCode: string;
  assignedBy: string | null;
  assignedAt: string;
  expiresAt: string | null;
};

export type ServiceAccountView = {
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

export type ServiceAccountCredentialLifecycleView = {
  storageMode: 'HASH_ONLY_EXTERNAL_VAULT_READY';
  secretMaterialState: 'ONE_TIME_SECRET_RETURNED' | 'HASH_ONLY_RETAINED' | 'ROTATED_HASH_RETAINED' | 'REVOKED_HASH_RETAINED' | 'EXPIRED_HASH_RETAINED';
  externalVaultBoundary: 'PENDING_EXTERNAL_VAULT_INTEGRATION';
  vaultSecretRef: string | null;
  rotationDueAt: string | null;
};

export type ServiceAccountCredentialView = {
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
  credentialLifecycle: ServiceAccountCredentialLifecycleView;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
};

export type IssuedServiceAccountCredentialView = ServiceAccountCredentialView & {
  oneTimeSecret: string;
};

export type AccessReviewCampaignView = {
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

export type AccessReviewItemView = {
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

export type AccessReviewWorkflowEventView = {
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

export type AbacPolicyView = {
  id: string;
  dimension: string;
  conditions: unknown;
  effect: 'ALLOW' | 'DENY';
  priority: number;
  createdAt: string;
};

export type FieldAccessPolicyView = {
  id: string;
  fieldPath: string;
  dataClassification: string;
  roleDecisions: unknown;
  selfServiceDecision: string | null;
  managerDecision: string | null;
  maskingRule: string | null;
  createdAt: string;
};

export type SodRuleView = {
  id: string;
  code: string;
  description: string | null;
  incompatibleRolePairs: unknown | null;
  incompatiblePermissionPairs: unknown | null;
  enforcementPoint: string | null;
  breakGlassAllowed: boolean;
  createdAt: string;
};

export type SodRemediationAction = 'REMOVE_VIOLATING_ROLE' | 'REMOVE_CONFLICTING_ROLE' | 'DOCUMENT_EXCEPTION';

export type SodRemediationView = {
  ruleId: string;
  ruleCode: string;
  subjectUserId: string;
  action: SodRemediationAction;
  removedRoleId: string | null;
  retainedRoleId: string | null;
  evidence: unknown;
  remediatedBy: string | null;
  remediatedAt: string;
  externalWorkflowBoundary: 'RECORDED_FOR_GRC_OR_TICKETING_HANDOFF';
};

export type AccessGovernanceSummary = {
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

export type CreateRoleDto = {
  code?: string;
  name?: string;
  tier?: string;
  description?: string | null;
  isSystem?: boolean;
};

export type UpdateRoleDto = Partial<CreateRoleDto>;

export type CreatePermissionDto = {
  code?: string;
  description?: string | null;
  domain?: string;
  dataClassification?: string | null;
  auditOnAccess?: boolean;
};

export type UpdatePermissionDto = Partial<CreatePermissionDto>;

export type ReplaceRolePermissionsDto = {
  permissionIds?: string[];
};

export type AssignUserRoleDto = {
  userId?: string;
  roleId?: string;
  expiresAt?: string | null;
};

export type CreateServiceAccountDto = {
  code?: string;
  name?: string;
  ownerWorkerId?: string | null;
  status?: string;
  scopes?: unknown;
  credentialRotationDays?: number;
  lastRotatedAt?: string | null;
  expiresAt?: string | null;
};

export type UpdateServiceAccountDto = Partial<CreateServiceAccountDto>;

export type IssueServiceAccountCredentialDto = {
  name?: string | null;
  scopes?: unknown;
  expiresAt?: string | null;
};

export type RotateServiceAccountCredentialDto = IssueServiceAccountCredentialDto;

export type RevokeServiceAccountCredentialDto = {
  reason?: string | null;
};

export type CreateAccessReviewCampaignDto = {
  code?: string;
  name?: string;
  scope?: unknown;
  reviewerRole?: string;
  status?: string;
  dueAt?: string | null;
};

export type UpdateAccessReviewCampaignDto = Partial<CreateAccessReviewCampaignDto> & {
  launchedAt?: string | null;
  completedAt?: string | null;
};

export type CreateAccessReviewItemDto = {
  campaignId?: string;
  subjectUserId?: string | null;
  subjectWorkerId?: string | null;
  roleId?: string | null;
  permissionId?: string | null;
  serviceAccountId?: string | null;
  reviewerId?: string | null;
  decision?: string;
  evidence?: unknown;
};

export type UpdateAccessReviewItemDto = {
  decision?: string;
  reviewerId?: string | null;
  evidence?: unknown;
};

export type AccessReviewWorkflowCommandDto = {
  message?: string | null;
};

export type CreateAbacPolicyDto = {
  dimension?: string;
  conditions?: unknown;
  effect?: 'ALLOW' | 'DENY';
  priority?: number;
};

export type UpdateAbacPolicyDto = Partial<CreateAbacPolicyDto>;

export type CreateFieldAccessPolicyDto = {
  fieldPath?: string;
  dataClassification?: string;
  roleDecisions?: unknown;
  selfServiceDecision?: string | null;
  managerDecision?: string | null;
  maskingRule?: string | null;
};

export type UpdateFieldAccessPolicyDto = Partial<CreateFieldAccessPolicyDto>;

export type CreateSodRuleDto = {
  code?: string;
  description?: string | null;
  incompatibleRolePairs?: unknown | null;
  incompatiblePermissionPairs?: unknown | null;
  enforcementPoint?: string | null;
  breakGlassAllowed?: boolean;
};

export type UpdateSodRuleDto = Partial<CreateSodRuleDto>;

export type RemediateSodViolationDto = {
  ruleId?: string;
  subjectUserId?: string;
  violatingRoleId?: string;
  conflictingRoleId?: string;
  action?: SodRemediationAction;
  evidence?: unknown;
};

import { Uuid } from '@hcm/shared-kernel';
import type { HrCommandEnvelope, CommandResult } from '@hcm/command-contracts';
import type { HrEventPrivacy } from '@hcm/event-schemas';
import type { HcmPolicyScope } from '../../domains/hcm-setup/hcm-setup.types.js';

/**
 * Pure, dependency-free helper functions shared across the command-bus pipeline
 * steps (see `./steps/`). Nothing here touches the database, cache, or any
 * injected service — every function is a straight extraction of logic that
 * used to live as a private method on `CommandBus`, moved here verbatim so it
 * can be reused (and unit-tested) from multiple steps without duplication.
 *
 * Behavior-preservation note: these are mechanical extractions. Do not
 * "clean up" the logic here without separately verifying every call site.
 */

export function readUuidValue(value: unknown): string | undefined {
  if (value instanceof Uuid) return value.value;
  if (typeof value === 'object' && value !== null && 'value' in value) {
    const raw = (value as { value?: unknown }).value;
    return typeof raw === 'string' ? raw : undefined;
  }
  return typeof value === 'string' ? value : undefined;
}

export function extractPayloadUuid(payload: unknown, key: string): Uuid | undefined {
  if (payload === null || payload === undefined) return undefined;
  if (payload instanceof Uuid) return undefined;
  if (Array.isArray(payload)) {
    for (const item of payload) {
      const found = extractPayloadUuid(item, key);
      if (found) return found;
    }
    return undefined;
  }
  if (typeof payload !== 'object') return undefined;
  const record = payload as Record<string, unknown>;
  const raw = record[key];
  const rawValue = readUuidValue(raw);
  if (rawValue && Uuid.isValid(rawValue)) return new Uuid(rawValue);
  for (const child of Object.values(record)) {
    const found = extractPayloadUuid(child, key);
    if (found) return found;
  }
  return undefined;
}

export function flattenPayloadPaths(value: unknown, prefix = ''): string[] {
  if (value === null || value === undefined || value instanceof Date || value instanceof Uuid) {
    return prefix ? [prefix] : [];
  }
  if (Array.isArray(value)) {
    return value.flatMap((item, index) => flattenPayloadPaths(item, prefix ? `${prefix}.${index}` : String(index)));
  }
  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length === 0) return prefix ? [prefix] : [];
    return entries.flatMap(([key, child]) => flattenPayloadPaths(child, prefix ? `${prefix}.${key}` : key));
  }
  return prefix ? [prefix] : [];
}

export function resolveSubjectWorkerId(
  command: HrCommandEnvelope<unknown>,
  result?: CommandResult<unknown>,
): Uuid | undefined {
  return (
    command.subjectWorkerId ??
    extractPayloadUuid(command.payload, 'subjectWorkerId') ??
    extractPayloadUuid(command.payload, 'workerId') ??
    extractPayloadUuid(command.payload, 'employeeId') ??
    extractPayloadUuid(result?.data, 'subjectWorkerId') ??
    extractPayloadUuid(result?.data, 'workerId') ??
    extractPayloadUuid(result?.data, 'employeeId')
  );
}

export function inferActionFromCommand(commandName: string): string {
  return commandName.split('.').pop() ?? commandName;
}

export function inferCommandType(commandName: string): string {
  const normalizedName = commandName
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/[\s.-]+/g, '_')
    .toUpperCase();
  if (normalizedName.includes('CREATE') || normalizedName.includes('ADD')) return 'CREATE';
  if (normalizedName.includes('UPDATE') || normalizedName.includes('EDIT')) return 'UPDATE';
  if (normalizedName.includes('DELETE') || normalizedName.includes('REMOVE')) return 'DELETE';
  if (normalizedName.includes('APPROVE')) return 'APPROVE';
  return 'READ';
}

export function inferFsmActionCandidates(commandName: string, aggregateType: string): string[] {
  const action = inferActionFromCommand(commandName);
  const candidates = [action];
  const normalizedAggregate = aggregateType.charAt(0).toUpperCase() + aggregateType.slice(1);
  if (action.endsWith(normalizedAggregate) && action.length > normalizedAggregate.length) {
    candidates.push(action.slice(0, -normalizedAggregate.length));
  }
  return [...new Set(candidates)];
}

const PAST_TENSE_VERBS: Array<[RegExp, string]> = [
  [/^Create/i, 'Created'],
  [/^Add/i, 'Added'],
  [/^Activate/i, 'Activated'],
  [/^Apply/i, 'Applied'],
  [/^Approve/i, 'Approved'],
  [/^Archive/i, 'Archived'],
  [/^Calculate/i, 'Calculated'],
  [/^Cancel/i, 'Canceled'],
  [/^Close/i, 'Closed'],
  [/^Complete/i, 'Completed'],
  [/^Delete/i, 'Deleted'],
  [/^Deprecate/i, 'Deprecated'],
  [/^Explain/i, 'Explained'],
  [/^Fail/i, 'Failed'],
  [/^Finalize/i, 'Finalized'],
  [/^Launch/i, 'Launched'],
  [/^Lock/i, 'Locked'],
  [/^Open/i, 'Opened'],
  [/^Publish/i, 'Published'],
  [/^Queue/i, 'Queued'],
  [/^Record/i, 'Recorded'],
  [/^Reject/i, 'Rejected'],
  [/^Review/i, 'Reviewed'],
  [/^Start/i, 'Started'],
  [/^Submit/i, 'Submitted'],
  [/^Update/i, 'Updated'],
  [/^Validate/i, 'Validated'],
];

export function inferPastTenseFromCommand(commandName: string): string {
  const tail = commandName.split('.').pop() ?? commandName;
  return PAST_TENSE_VERBS.find(([pattern]) => pattern.test(tail))?.[1] ?? 'CommandSucceeded';
}

export function inferEventNameFromCommand(commandName: string, aggregateType: string): string {
  return `${aggregateType}${inferPastTenseFromCommand(commandName)}`;
}

export function inferEmployeeDataCategory(aggregateType: string): HrEventPrivacy['employeeDataCategory'] {
  const normalized = aggregateType.toLowerCase();
  if (normalized.includes('payroll') || normalized.includes('payslip')) return 'PAYROLL';
  if (normalized.includes('compensation') || normalized.includes('bonus') || normalized.includes('equity')) return 'COMPENSATION';
  if (normalized.includes('benefits')) return 'BENEFITS';
  if (normalized.includes('performance') || normalized.includes('objective') || normalized.includes('goal')) return 'PERFORMANCE';
  if (normalized.includes('relations') || normalized.includes('disciplinary') || normalized.includes('grievance')) return 'ER_CASE';
  if (normalized.includes('medical') || normalized.includes('wellness') || normalized.includes('eap')) return 'MEDICAL';
  if (normalized.includes('authorization') || normalized.includes('visa') || normalized.includes('immigration') || normalized.includes('i9case') || normalized.includes('everify')) return 'IMMIGRATION';
  if (normalized.includes('survey')) return 'SURVEY';
  return 'PROFILE';
}

export function mapActorType(
  actorType: 'USER' | 'SYSTEM' | 'SERVICE_ACCOUNT' | 'INTEGRATION',
  roles: string[],
): 'SYSTEM' | 'INTEGRATION' | 'EMPLOYEE' | 'MANAGER' | 'HR_ADMIN' | 'HRBP' | 'EXECUTIVE' | 'EXTERNAL' {
  switch (actorType) {
    case 'SYSTEM':
    case 'SERVICE_ACCOUNT':
      return 'SYSTEM';
    case 'INTEGRATION':
      return 'EXTERNAL';
    case 'USER':
    default:
      if (roles.includes('HR_ADMIN')) return 'HR_ADMIN';
      if (roles.includes('WORKFORCE_PLANNING_ADMIN')) return 'HR_ADMIN';
      if (roles.includes('MANAGER')) return 'MANAGER';
      if (roles.includes('HRBP')) return 'HRBP';
      if (roles.includes('EXECUTIVE')) return 'EXECUTIVE';
      return 'EMPLOYEE';
  }
}

export function normalizePolicyToken(value: string): string {
  return value
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/[\s.-]+/g, '_')
    .toUpperCase();
}

export function normalizeFieldPath(value: string): string {
  return value
    .trim()
    .replace(/\.\d+(?=\.|$)/g, '')
    .toLowerCase();
}

export function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export function pluralizeSnakeCase(value: string): string {
  const snake = value
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/[-\s]+/g, '_')
    .toLowerCase();
  if (snake.endsWith('y')) return `${snake.slice(0, -1)}ies`;
  if (snake.endsWith('s')) return snake;
  return `${snake}s`;
}

export function isMissingAggregateTableError(error: unknown): boolean {
  // ONLY a genuinely missing relation (42P01 undefined_table) is tolerated — that is
  // a legitimate "aggregate has no table yet" case. A missing COLUMN (42703) or any
  // other error is a real misconfiguration that must surface, not be swallowed: the
  // failed SELECT has already aborted the command transaction, so swallowing it would
  // silently poison the rest of the pipeline (PROD-2). Match by error code, not the
  // broad "does not exist" message (which also matches undefined_column).
  const maybeDbError = error as { code?: unknown; message?: unknown };
  if (maybeDbError.code === '42P01') return true;
  if (maybeDbError.code !== undefined) return false;
  return (
    typeof maybeDbError.message === 'string' &&
    maybeDbError.message.includes('does not exist') &&
    !maybeDbError.message.includes('column')
  );
}

export function claimsMatch(policyValues: string[] | undefined, actorValues: string[] | undefined): boolean {
  if (!policyValues || policyValues.length === 0) return true;
  const actorSet = new Set(actorValues ?? []);
  return policyValues.some((value) => actorSet.has(value));
}

export function workerScopeMatches(
  policyWorkerIds: string[] | undefined,
  command: HrCommandEnvelope<unknown>,
): boolean {
  if (!policyWorkerIds || policyWorkerIds.length === 0) return true;
  const subjectWorkerId = resolveSubjectWorkerId(command);
  const payloadWorkerId = extractPayloadUuid(command.payload, 'workerId')
    ?? extractPayloadUuid(command.payload, 'employeeId');
  return policyWorkerIds.some((workerId) => (
    workerId === command.actor.actorId.value
    || workerId === subjectWorkerId?.value
    || workerId === command.aggregateId?.value
    || workerId === payloadWorkerId?.value
  ));
}

type ActorScopeClaims = {
  legalEntityIds?: string[];
  countryCodes?: string[];
  branchCodes?: string[];
  departmentIds?: string[];
  orgUnitIds?: string[];
  jobCodes?: string[];
  gradeCodes?: string[];
  locationCodes?: string[];
  employeeTypes?: string[];
  managerWorkerIds?: string[];
};

export function policyScopeMatches(
  scope: HcmPolicyScope | undefined,
  command: HrCommandEnvelope<unknown>,
): boolean {
  if (!scope) return true;
  if (scope.tenantId && scope.tenantId !== command.tenantId.value) return false;

  const now = Date.now();
  if (scope.effectiveFrom && new Date(`${scope.effectiveFrom}T00:00:00.000Z`).getTime() > now) return false;
  if (scope.effectiveUntil && new Date(`${scope.effectiveUntil}T23:59:59.999Z`).getTime() < now) return false;

  const actorScope = command.actor as typeof command.actor & ActorScopeClaims;
  return claimsMatch(scope.countryCodes, actorScope.countryCodes)
    && claimsMatch(scope.legalEntityIds, actorScope.legalEntityIds)
    && claimsMatch(scope.branchCodes, actorScope.branchCodes)
    && claimsMatch(scope.orgUnitIds, actorScope.orgUnitIds)
    && claimsMatch(scope.departmentIds, actorScope.departmentIds)
    && claimsMatch(scope.jobCodes, actorScope.jobCodes)
    && claimsMatch(scope.gradeCodes, actorScope.gradeCodes)
    && claimsMatch(scope.locationCodes, actorScope.locationCodes)
    && claimsMatch(scope.employeeTypes, actorScope.employeeTypes)
    && claimsMatch(scope.managerWorkerIds, actorScope.managerWorkerIds)
    && workerScopeMatches(scope.workerIds, command);
}

export function policyScopeSpecificity(scope: HcmPolicyScope | undefined): number {
  if (!scope) return 0;
  const hasValues = (values: string[] | undefined) => Boolean(values && values.length > 0);
  const specificityTieBreaker = [
    scope.countryCodes,
    scope.legalEntityIds,
    scope.branchCodes,
    scope.orgUnitIds,
    scope.departmentIds,
    scope.locationCodes,
    scope.employeeTypes,
    scope.jobCodes,
    scope.gradeCodes,
    scope.managerWorkerIds,
    scope.workerIds,
  ].filter(hasValues).length;

  if (hasValues(scope.workerIds)) return 1000 + specificityTieBreaker;
  if (hasValues(scope.managerWorkerIds)) return 900 + specificityTieBreaker;
  if (hasValues(scope.jobCodes) || hasValues(scope.gradeCodes)) return 800 + specificityTieBreaker;
  if (
    hasValues(scope.departmentIds)
    || hasValues(scope.orgUnitIds)
    || hasValues(scope.locationCodes)
    || hasValues(scope.branchCodes)
    || hasValues(scope.employeeTypes)
  ) return 700 + specificityTieBreaker;
  if (hasValues(scope.legalEntityIds)) return 600 + specificityTieBreaker;
  if (hasValues(scope.countryCodes)) return 500 + specificityTieBreaker;
  return 100;
}

export function policyScopeEvidence(
  scope: HcmPolicyScope | undefined,
  command: HrCommandEnvelope<unknown>,
): Record<string, unknown> {
  return {
    tenantId: command.tenantId.value,
    ...(scope ?? {}),
  };
}

export function rolesMatch(policyRoles: string[] | undefined, actorRoles: string[]): boolean {
  if (!policyRoles || policyRoles.length === 0) return true;
  const actorRoleSet = new Set(actorRoles);
  return policyRoles.some((role) => actorRoleSet.has(role));
}

export function aggregateTypeMatches(policyAggregateType: string, commandAggregateType: string): boolean {
  return normalizePolicyToken(policyAggregateType) === normalizePolicyToken(commandAggregateType);
}

export function commandActionCandidates(command: HrCommandEnvelope<unknown>): string[] {
  const normalizedCommandName = normalizePolicyToken(command.commandName);
  const normalizedAggregateType = normalizePolicyToken(command.aggregateType);
  const aggregateParts = normalizedAggregateType.split('_').filter(Boolean);
  const commandParts = normalizedCommandName.split('_').filter(Boolean);
  const verb = commandParts[0];
  const aggregateTail = aggregateParts[aggregateParts.length - 1];
  const candidates = new Set<string>([
    command.commandName,
    inferActionFromCommand(command.commandName),
    normalizedCommandName,
    inferCommandType(command.commandName),
  ]);

  if (verb && aggregateTail) {
    candidates.add(`${verb}_${aggregateTail}`);
  }
  if (verb) {
    candidates.add(verb);
  }

  return Array.from(candidates);
}

export function commandActionMatches(policyAction: string, command: HrCommandEnvelope<unknown>): boolean {
  const normalizedPolicyAction = normalizePolicyToken(policyAction);
  return commandActionCandidates(command).some((candidate) => (
    normalizePolicyToken(candidate) === normalizedPolicyAction
  ));
}

export function fieldPathMatchesOverride(payloadPath: string, overrideFieldPath: string): boolean {
  const normalizedPayloadPath = normalizeFieldPath(payloadPath);
  const normalizedOverridePath = normalizeFieldPath(overrideFieldPath);
  return (
    normalizedPayloadPath === normalizedOverridePath
    || normalizedPayloadPath.endsWith(`.${normalizedOverridePath}`)
    || normalizedOverridePath.endsWith(`.${normalizedPayloadPath}`)
    || normalizedPayloadPath.startsWith(`${normalizedOverridePath}.`)
  );
}

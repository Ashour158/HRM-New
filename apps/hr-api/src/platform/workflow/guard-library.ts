import { Injectable } from '@nestjs/common';
import type { AggregateRoot } from '@hcm/shared-kernel';
import type { HrCommandEnvelope } from '@hcm/command-contracts';
import type { TenantConfig } from '@hcm/platform-core';
import type { DecisionRecord } from '@hcm/policy-engines';

export interface GuardResult {
  passed: boolean;
  reason?: string;
  code?: string;
}

export interface GuardContext {
  command: HrCommandEnvelope<unknown>;
  aggregate?: AggregateRoot;
  tenantConfig?: TenantConfig;
  policyDecision?: DecisionRecord;
}

export type GuardFunction = (context: GuardContext) => Promise<GuardResult>;

/** Policy-decision codes that deny an action (any engine). */
const DENYING_DECISION_CODES = new Set([
  'DENIED',
  'HIDDEN',
  'REJECTED',
  'NON_COMPLIANT',
  'NOT_ELIGIBLE',
  'INVALID',
  'FORBIDDEN',
  'REQUIRES_BREAK_GLASS',
]);

/** Command-name fragments that indicate an approval / sign-off action (for SoD + approval-state guards). */
const APPROVAL_COMMAND_PATTERN = /(APPROVE|PUBLISH|AUTHORIZE|SIGN_?OFF|RATIFY|ENDORSE)/i;

/** Aggregate fields that identify the "maker" for segregation-of-duties checks. */
const MAKER_FIELDS = ['uploadedBy', 'createdBy', 'requestedBy', 'makerId', 'submittedBy', 'raisedBy'];

/** Permissions that grant a manager scope over a subject worker. */
const MANAGER_TEAM_PERMISSIONS = ['TEAM_READ', 'TEAM_MANAGE', 'MANAGER_RELATIONSHIP_READ', 'WORKER_READ'];

/** Safely read an optional field from an aggregate without depending on its concrete type. */
function aggField(aggregate: AggregateRoot | undefined, key: string): unknown {
  if (!aggregate) return undefined;
  return (aggregate as unknown as Record<string, unknown>)[key];
}

function aggStatus(aggregate: AggregateRoot | undefined): string | undefined {
  const status = aggField(aggregate, 'status') ?? aggField(aggregate, 'state');
  return typeof status === 'string' ? status : undefined;
}

@Injectable()
export class GuardLibrary {
  private readonly guards = new Map<string, GuardFunction>();

  constructor() {
    this.registerUniversalGuards();
  }

  register(name: string, guard: GuardFunction): void {
    this.guards.set(name, guard);
  }

  async evaluate(name: string, context: GuardContext): Promise<GuardResult> {
    const guard = this.guards.get(name);
    if (!guard) {
      return { passed: false, reason: `Guard ${name} not found`, code: 'GUARD_NOT_FOUND' };
    }
    return guard(context);
  }

  async evaluateAll(names: string[], context: GuardContext): Promise<GuardResult[]> {
    return Promise.all(names.map((name) => this.evaluate(name, context)));
  }

  private registerUniversalGuards(): void {
    this.register('GUARD_TENANT_ACTIVE', async (ctx) => {
      if (ctx.tenantConfig?.status !== 'ACTIVE') {
        return { passed: false, reason: 'Tenant is not active', code: 'GUARD_TENANT_ACTIVE' };
      }
      return { passed: true, code: 'GUARD_TENANT_ACTIVE' };
    });

    this.register('GUARD_ACTOR_AUTHENTICATED', async (ctx) => {
      if (!ctx.command.actor || !ctx.command.actor.actorId) {
        return { passed: false, reason: 'Actor not authenticated', code: 'GUARD_ACTOR_AUTHENTICATED' };
      }
      return { passed: true, code: 'GUARD_ACTOR_AUTHENTICATED' };
    });

    this.register('GUARD_COMMAND_PERMISSION', async (ctx) => {
      if (!ctx.command.actor.roles.length) {
        return { passed: false, reason: 'Actor has no roles', code: 'GUARD_COMMAND_PERMISSION' };
      }
      return { passed: true, code: 'GUARD_COMMAND_PERMISSION' };
    });

    this.register('GUARD_SUBJECT_WORKER_ACCESS', async (ctx) => {
      if (ctx.command.subjectWorkerId && !ctx.command.actor.permissions.includes('WORKER_READ')) {
        return { passed: false, reason: 'No subject worker access', code: 'GUARD_SUBJECT_WORKER_ACCESS' };
      }
      return { passed: true, code: 'GUARD_SUBJECT_WORKER_ACCESS' };
    });

    this.register('GUARD_FIELD_ACCESS', async (ctx) => {
      // Honour a field-access policy decision when one was resolved for this command.
      const code = ctx.policyDecision?.decisionCode;
      if (code && DENYING_DECISION_CODES.has(code)) {
        return { passed: false, reason: `Field access denied by policy (${code})`, code: 'GUARD_FIELD_ACCESS' };
      }
      return { passed: true, code: 'GUARD_FIELD_ACCESS' };
    });

    this.register('GUARD_SPECIAL_CATEGORY_ACCESS', async (ctx) => {
      if (ctx.command.metadata.hrDataSensitivity === 'SPECIAL_CATEGORY' && !ctx.command.actor.mfaAuthenticated) {
        return { passed: false, reason: 'MFA required for special category', code: 'GUARD_SPECIAL_CATEGORY_ACCESS' };
      }
      return { passed: true, code: 'GUARD_SPECIAL_CATEGORY_ACCESS' };
    });

    this.register('GUARD_MANAGER_RELATIONSHIP_VALID', async (ctx) => {
      // A manager acting on a specific subject worker must hold a team/manager scope
      // permission. (Deep relationship verification is enforced downstream against the
      // org graph; this guard enforces the permission precondition from the envelope.)
      const isManagerPortal = ctx.command.metadata.clientType === 'MANAGER_PORTAL'
        || ctx.command.actor.roles.includes('MANAGER');
      if (isManagerPortal && ctx.command.subjectWorkerId) {
        const hasTeamScope = ctx.command.actor.permissions.some((p) => MANAGER_TEAM_PERMISSIONS.includes(p));
        if (!hasTeamScope) {
          return { passed: false, reason: 'Manager lacks team scope over the subject worker', code: 'GUARD_MANAGER_RELATIONSHIP_VALID' };
        }
      }
      return { passed: true, code: 'GUARD_MANAGER_RELATIONSHIP_VALID' };
    });

    this.register('GUARD_AGGREGATE_EXISTS', async (ctx) => {
      if (ctx.command.aggregateId && !ctx.aggregate) {
        return { passed: false, reason: 'Aggregate not found', code: 'GUARD_AGGREGATE_EXISTS' };
      }
      return { passed: true, code: 'GUARD_AGGREGATE_EXISTS' };
    });

    this.register('GUARD_CURRENT_STATE_ALLOWS_ACTION', async (ctx) => {
      // FSM precondition: when the command declares the state it expects to act on,
      // the loaded aggregate must currently be in that state.
      const expected = ctx.command.expectedState;
      const current = aggStatus(ctx.aggregate);
      if (expected && current && expected !== current) {
        return {
          passed: false,
          reason: `Aggregate is in state ${current}, expected ${expected}`,
          code: 'GUARD_CURRENT_STATE_ALLOWS_ACTION',
        };
      }
      return { passed: true, code: 'GUARD_CURRENT_STATE_ALLOWS_ACTION' };
    });

    this.register('GUARD_EFFECTIVE_DATE_ALLOWED', async (ctx) => {
      if (ctx.command.effectiveDate && ctx.command.effectiveDate < new Date('1900-01-01')) {
        return { passed: false, reason: 'Effective date out of range', code: 'GUARD_EFFECTIVE_DATE_ALLOWED' };
      }
      return { passed: true, code: 'GUARD_EFFECTIVE_DATE_ALLOWED' };
    });

    this.register('GUARD_POLICY_VERSION_ACTIVE', async (ctx) => {
      // When a policy decision drives this command, it must carry an identifiable rule-set
      // version and must not be dated in the future (a not-yet-effective policy).
      const decision = ctx.policyDecision;
      if (decision) {
        if (!decision.ruleSetVersion) {
          return { passed: false, reason: 'Policy decision has no rule-set version', code: 'GUARD_POLICY_VERSION_ACTIVE' };
        }
        if (decision.effectiveDate && decision.effectiveDate.getTime() > Date.now()) {
          return { passed: false, reason: 'Policy version is not yet effective', code: 'GUARD_POLICY_VERSION_ACTIVE' };
        }
      }
      return { passed: true, code: 'GUARD_POLICY_VERSION_ACTIVE' };
    });

    this.register('GUARD_COUNTRY_LABOR_RULE_AVAILABLE', async (ctx) => {
      // If the tenant has a country-policy runtime configured, it must not be disabled.
      // (When no runtime is configured the action is not country-gated and passes.)
      const runtime = ctx.tenantConfig?.settings?.countryPolicyRuntime as
        | { validationEnabled?: boolean; allowedCountryCodes?: string[] }
        | undefined;
      if (runtime && runtime.validationEnabled === false) {
        return { passed: false, reason: 'Country policy runtime is disabled for this tenant', code: 'GUARD_COUNTRY_LABOR_RULE_AVAILABLE' };
      }
      return { passed: true, code: 'GUARD_COUNTRY_LABOR_RULE_AVAILABLE' };
    });

    this.register('GUARD_IDEMPOTENCY_VALID', async (ctx) => {
      // Every command must carry a non-empty idempotency key (the command bus dedupes
      // on it). A missing/blank key would defeat exactly-once processing.
      const key = ctx.command.idempotencyKey;
      if (!key || key.trim().length === 0) {
        return { passed: false, reason: 'Missing idempotency key', code: 'GUARD_IDEMPOTENCY_VALID' };
      }
      return { passed: true, code: 'GUARD_IDEMPOTENCY_VALID' };
    });

    this.register('GUARD_CONCURRENCY_VERSION_MATCH', async (ctx) => {
      if (ctx.command.expectedVersion !== undefined && ctx.aggregate) {
        if (ctx.command.expectedVersion !== ctx.aggregate.version) {
          return { passed: false, reason: 'Optimistic lock version mismatch', code: 'GUARD_CONCURRENCY_VERSION_MATCH' };
        }
      }
      return { passed: true, code: 'GUARD_CONCURRENCY_VERSION_MATCH' };
    });

    this.register('GUARD_APPROVAL_STATE_VALID_IF_REQUIRED', async (ctx) => {
      // An approval/sign-off command may only act on an aggregate that is actually
      // awaiting approval. Guards against approving something already approved or in draft.
      if (APPROVAL_COMMAND_PATTERN.test(ctx.command.commandName)) {
        const current = aggStatus(ctx.aggregate);
        if (current && !/(PENDING|REVIEW|SUBMITTED|AWAITING|PROPOSED)/i.test(current)) {
          return {
            passed: false,
            reason: `Approval not valid from state ${current}`,
            code: 'GUARD_APPROVAL_STATE_VALID_IF_REQUIRED',
          };
        }
      }
      return { passed: true, code: 'GUARD_APPROVAL_STATE_VALID_IF_REQUIRED' };
    });

    this.register('GUARD_SOD_VALID', async (ctx) => {
      // Segregation of duties: on an approval/sign-off command, the approving actor must
      // not be the maker who created/submitted the aggregate.
      if (APPROVAL_COMMAND_PATTERN.test(ctx.command.commandName) && ctx.aggregate) {
        const actorId = ctx.command.actor.actorId.value;
        for (const field of MAKER_FIELDS) {
          const maker = aggField(ctx.aggregate, field);
          const makerId = typeof maker === 'string'
            ? maker
            : (maker as { value?: string } | undefined)?.value;
          if (makerId && makerId === actorId) {
            return {
              passed: false,
              reason: `Segregation of duties: maker (${field}) cannot approve`,
              code: 'GUARD_SOD_VALID',
            };
          }
        }
      }
      return { passed: true, code: 'GUARD_SOD_VALID' };
    });

    this.register('GUARD_NO_BLOCKING_LEGAL_HOLD', async (ctx) => {
      // A subject under an active legal hold cannot be mutated (e.g. erased/terminated)
      // unless the actor wields a break-glass session. Reads the hold flag off the aggregate.
      const onHold = aggField(ctx.aggregate, 'legalHold') === true
        || Boolean(aggField(ctx.aggregate, 'legalHoldId'))
        || aggField(ctx.aggregate, 'legalHoldStatus') === 'ACTIVE';
      if (onHold && !ctx.command.actor.breakGlassSessionId) {
        return { passed: false, reason: 'Blocking legal hold is active on the subject', code: 'GUARD_NO_BLOCKING_LEGAL_HOLD' };
      }
      return { passed: true, code: 'GUARD_NO_BLOCKING_LEGAL_HOLD' };
    });

    this.register('GUARD_AUDIT_READY', async (ctx) => {
      // The audit ledger requires actor, command identity, correlation, and a reason to
      // produce a complete, attributable audit record.
      const c = ctx.command;
      if (!c.actor?.actorId || !c.commandId || !c.correlationId || !c.reason || c.reason.trim().length === 0) {
        return { passed: false, reason: 'Command lacks audit prerequisites (actor/ids/reason)', code: 'GUARD_AUDIT_READY' };
      }
      return { passed: true, code: 'GUARD_AUDIT_READY' };
    });

    this.register('GUARD_OUTBOX_READY', async (ctx) => {
      // If a command produced domain events, the aggregate must expose them so the
      // transactional outbox can publish them; a non-array domainEvents would be lost.
      if (ctx.aggregate) {
        const events = aggField(ctx.aggregate, 'domainEvents');
        if (events !== undefined && !Array.isArray(events)) {
          return { passed: false, reason: 'Aggregate domain events are not publishable', code: 'GUARD_OUTBOX_READY' };
        }
      }
      return { passed: true, code: 'GUARD_OUTBOX_READY' };
    });

    this.register('GUARD_BREAK_GLASS_VALID', async (ctx) => {
      // Break-glass access is emergency access and must be justified: a break-glass
      // session requires a non-empty reason on the command for the audit trail.
      if (ctx.command.actor.breakGlassSessionId) {
        if (!ctx.command.reason || ctx.command.reason.trim().length === 0) {
          return { passed: false, reason: 'Break-glass access requires a justification reason', code: 'GUARD_BREAK_GLASS_VALID' };
        }
      }
      return { passed: true, code: 'GUARD_BREAK_GLASS_VALID' };
    });
  }
}

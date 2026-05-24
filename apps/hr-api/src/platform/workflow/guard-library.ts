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

    this.register('GUARD_FIELD_ACCESS', async () => {
      return { passed: true, code: 'GUARD_FIELD_ACCESS' };
    });

    this.register('GUARD_SPECIAL_CATEGORY_ACCESS', async (ctx) => {
      if (ctx.command.metadata.hrDataSensitivity === 'SPECIAL_CATEGORY' && !ctx.command.actor.mfaAuthenticated) {
        return { passed: false, reason: 'MFA required for special category', code: 'GUARD_SPECIAL_CATEGORY_ACCESS' };
      }
      return { passed: true, code: 'GUARD_SPECIAL_CATEGORY_ACCESS' };
    });

    this.register('GUARD_MANAGER_RELATIONSHIP_VALID', async () => {
      return { passed: true, code: 'GUARD_MANAGER_RELATIONSHIP_VALID' };
    });

    this.register('GUARD_AGGREGATE_EXISTS', async (ctx) => {
      if (ctx.command.aggregateId && !ctx.aggregate) {
        return { passed: false, reason: 'Aggregate not found', code: 'GUARD_AGGREGATE_EXISTS' };
      }
      return { passed: true, code: 'GUARD_AGGREGATE_EXISTS' };
    });

    this.register('GUARD_CURRENT_STATE_ALLOWS_ACTION', async () => {
      return { passed: true, code: 'GUARD_CURRENT_STATE_ALLOWS_ACTION' };
    });

    this.register('GUARD_EFFECTIVE_DATE_ALLOWED', async (ctx) => {
      if (ctx.command.effectiveDate && ctx.command.effectiveDate < new Date('1900-01-01')) {
        return { passed: false, reason: 'Effective date out of range', code: 'GUARD_EFFECTIVE_DATE_ALLOWED' };
      }
      return { passed: true, code: 'GUARD_EFFECTIVE_DATE_ALLOWED' };
    });

    this.register('GUARD_POLICY_VERSION_ACTIVE', async () => {
      return { passed: true, code: 'GUARD_POLICY_VERSION_ACTIVE' };
    });

    this.register('GUARD_COUNTRY_LABOR_RULE_AVAILABLE', async () => {
      return { passed: true, code: 'GUARD_COUNTRY_LABOR_RULE_AVAILABLE' };
    });

    this.register('GUARD_IDEMPOTENCY_VALID', async () => {
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

    this.register('GUARD_APPROVAL_STATE_VALID_IF_REQUIRED', async () => {
      return { passed: true, code: 'GUARD_APPROVAL_STATE_VALID_IF_REQUIRED' };
    });

    this.register('GUARD_SOD_VALID', async () => {
      return { passed: true, code: 'GUARD_SOD_VALID' };
    });

    this.register('GUARD_NO_BLOCKING_LEGAL_HOLD', async () => {
      return { passed: true, code: 'GUARD_NO_BLOCKING_LEGAL_HOLD' };
    });

    this.register('GUARD_AUDIT_READY', async () => {
      return { passed: true, code: 'GUARD_AUDIT_READY' };
    });

    this.register('GUARD_OUTBOX_READY', async () => {
      return { passed: true, code: 'GUARD_OUTBOX_READY' };
    });

    this.register('GUARD_BREAK_GLASS_VALID', async (ctx) => {
      if (ctx.command.actor.breakGlassSessionId) {
        return { passed: true, code: 'GUARD_BREAK_GLASS_VALID' };
      }
      return { passed: true, code: 'GUARD_BREAK_GLASS_VALID' };
    });
  }
}

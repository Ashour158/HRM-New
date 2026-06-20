import { describe, expect, it } from 'vitest';
import { Uuid } from '@hcm/shared-kernel';
import type { HrCommandEnvelope, HrActor } from '@hcm/command-contracts';
import type { AggregateRoot } from '@hcm/shared-kernel';
import type { DecisionRecord } from '@hcm/policy-engines';
import type { TenantConfig } from '@hcm/platform-core';
import { GuardLibrary, type GuardContext } from './guard-library.js';

const ACTOR_ID = '00000000-0000-4000-8000-000000000010';

function actor(overrides: Partial<HrActor> = {}): HrActor {
  return {
    actorType: 'USER',
    actorId: new Uuid(ACTOR_ID),
    roles: ['HR_ADMIN'],
    permissions: ['WORKER_READ'],
    mfaAuthenticated: true,
    ...overrides,
  };
}

function command(overrides: Partial<HrCommandEnvelope<unknown>> = {}): HrCommandEnvelope<unknown> {
  return {
    commandId: Uuid.generate(),
    commandName: 'DoSomething',
    commandSchemaVersion: 1,
    tenantId: Uuid.generate(),
    actor: actor(),
    aggregateType: 'Thing',
    idempotencyKey: 'idem-key-1',
    correlationId: Uuid.generate(),
    reason: 'API request',
    payload: {},
    metadata: { requestHash: 'h', clientType: 'HR_ADMIN' },
    ...overrides,
  };
}

function ctx(overrides: Partial<GuardContext> = {}): GuardContext {
  return { command: command(), ...overrides };
}

const lib = new GuardLibrary();

describe('GuardLibrary — de-stubbed guards', () => {
  it('GUARD_FIELD_ACCESS denies on a denying policy decision', async () => {
    const denied = await lib.evaluate('GUARD_FIELD_ACCESS', ctx({
      policyDecision: { decisionCode: 'DENIED' } as DecisionRecord,
    }));
    expect(denied.passed).toBe(false);
    const ok = await lib.evaluate('GUARD_FIELD_ACCESS', ctx({
      policyDecision: { decisionCode: 'VISIBLE' } as DecisionRecord,
    }));
    expect(ok.passed).toBe(true);
  });

  it('GUARD_CURRENT_STATE_ALLOWS_ACTION enforces expectedState vs aggregate status', async () => {
    const aggregate = { status: 'DRAFT' } as unknown as AggregateRoot;
    const mismatch = await lib.evaluate('GUARD_CURRENT_STATE_ALLOWS_ACTION', ctx({
      command: command({ expectedState: 'APPROVED' }),
      aggregate,
    }));
    expect(mismatch.passed).toBe(false);
    const match = await lib.evaluate('GUARD_CURRENT_STATE_ALLOWS_ACTION', ctx({
      command: command({ expectedState: 'DRAFT' }),
      aggregate,
    }));
    expect(match.passed).toBe(true);
  });

  it('GUARD_SOD_VALID blocks the maker from approving', async () => {
    const aggregate = { uploadedBy: ACTOR_ID } as unknown as AggregateRoot;
    const blocked = await lib.evaluate('GUARD_SOD_VALID', ctx({
      command: command({ commandName: 'ApproveCountryPolicyPack' }),
      aggregate,
    }));
    expect(blocked.passed).toBe(false);

    const other = { uploadedBy: '00000000-0000-4000-8000-000000000099' } as unknown as AggregateRoot;
    const allowed = await lib.evaluate('GUARD_SOD_VALID', ctx({
      command: command({ commandName: 'ApproveCountryPolicyPack' }),
      aggregate: other,
    }));
    expect(allowed.passed).toBe(true);
  });

  it('GUARD_SOD_VALID ignores non-approval commands', async () => {
    const aggregate = { uploadedBy: ACTOR_ID } as unknown as AggregateRoot;
    const res = await lib.evaluate('GUARD_SOD_VALID', ctx({ command: command({ commandName: 'UpdateThing' }), aggregate }));
    expect(res.passed).toBe(true);
  });

  it('GUARD_NO_BLOCKING_LEGAL_HOLD blocks mutation under hold unless break-glass', async () => {
    const aggregate = { legalHold: true } as unknown as AggregateRoot;
    const blocked = await lib.evaluate('GUARD_NO_BLOCKING_LEGAL_HOLD', ctx({ aggregate }));
    expect(blocked.passed).toBe(false);

    const withBreakGlass = await lib.evaluate('GUARD_NO_BLOCKING_LEGAL_HOLD', ctx({
      command: command({ actor: actor({ breakGlassSessionId: 'bg-1' }) }),
      aggregate,
    }));
    expect(withBreakGlass.passed).toBe(true);
  });

  it('GUARD_BREAK_GLASS_VALID requires a reason for break-glass access', async () => {
    const noReason = await lib.evaluate('GUARD_BREAK_GLASS_VALID', ctx({
      command: command({ actor: actor({ breakGlassSessionId: 'bg-1' }), reason: '' }),
    }));
    expect(noReason.passed).toBe(false);

    const withReason = await lib.evaluate('GUARD_BREAK_GLASS_VALID', ctx({
      command: command({ actor: actor({ breakGlassSessionId: 'bg-1' }), reason: 'incident #42' }),
    }));
    expect(withReason.passed).toBe(true);

    const noBreakGlass = await lib.evaluate('GUARD_BREAK_GLASS_VALID', ctx());
    expect(noBreakGlass.passed).toBe(true);
  });

  it('GUARD_IDEMPOTENCY_VALID requires a non-empty key', async () => {
    expect((await lib.evaluate('GUARD_IDEMPOTENCY_VALID', ctx({ command: command({ idempotencyKey: '' }) }))).passed).toBe(false);
    expect((await lib.evaluate('GUARD_IDEMPOTENCY_VALID', ctx())).passed).toBe(true);
  });

  it('GUARD_AUDIT_READY requires a reason', async () => {
    expect((await lib.evaluate('GUARD_AUDIT_READY', ctx({ command: command({ reason: '' }) }))).passed).toBe(false);
    expect((await lib.evaluate('GUARD_AUDIT_READY', ctx())).passed).toBe(true);
  });

  it('GUARD_APPROVAL_STATE_VALID_IF_REQUIRED only allows approval from a pending state', async () => {
    const draft = { status: 'DRAFT' } as unknown as AggregateRoot;
    expect((await lib.evaluate('GUARD_APPROVAL_STATE_VALID_IF_REQUIRED', ctx({
      command: command({ commandName: 'ApproveThing' }), aggregate: draft,
    }))).passed).toBe(false);

    const pending = { status: 'APPROVAL_PENDING' } as unknown as AggregateRoot;
    expect((await lib.evaluate('GUARD_APPROVAL_STATE_VALID_IF_REQUIRED', ctx({
      command: command({ commandName: 'ApproveThing' }), aggregate: pending,
    }))).passed).toBe(true);
  });

  it('GUARD_MANAGER_RELATIONSHIP_VALID requires team scope for manager-portal subject actions', async () => {
    const noScope = await lib.evaluate('GUARD_MANAGER_RELATIONSHIP_VALID', ctx({
      command: command({
        actor: actor({ roles: ['MANAGER'], permissions: [] }),
        metadata: { requestHash: 'h', clientType: 'MANAGER_PORTAL' },
        subjectWorkerId: Uuid.generate(),
      }),
    }));
    expect(noScope.passed).toBe(false);

    const withScope = await lib.evaluate('GUARD_MANAGER_RELATIONSHIP_VALID', ctx({
      command: command({
        actor: actor({ roles: ['MANAGER'], permissions: ['TEAM_READ'] }),
        metadata: { requestHash: 'h', clientType: 'MANAGER_PORTAL' },
        subjectWorkerId: Uuid.generate(),
      }),
    }));
    expect(withScope.passed).toBe(true);
  });

  it('GUARD_COUNTRY_LABOR_RULE_AVAILABLE fails when the tenant runtime is disabled', async () => {
    const disabled = {
      settings: { countryPolicyRuntime: { validationEnabled: false } },
    } as unknown as TenantConfig;
    expect((await lib.evaluate('GUARD_COUNTRY_LABOR_RULE_AVAILABLE', ctx({ tenantConfig: disabled }))).passed).toBe(false);
    expect((await lib.evaluate('GUARD_COUNTRY_LABOR_RULE_AVAILABLE', ctx())).passed).toBe(true);
  });

  it('GUARD_POLICY_VERSION_ACTIVE rejects an unversioned or future policy decision', async () => {
    expect((await lib.evaluate('GUARD_POLICY_VERSION_ACTIVE', ctx({
      policyDecision: { ruleSetVersion: '', effectiveDate: new Date('2020-01-01') } as DecisionRecord,
    }))).passed).toBe(false);
    expect((await lib.evaluate('GUARD_POLICY_VERSION_ACTIVE', ctx({
      policyDecision: { ruleSetVersion: '1.0.0', effectiveDate: new Date('2999-01-01') } as DecisionRecord,
    }))).passed).toBe(false);
    expect((await lib.evaluate('GUARD_POLICY_VERSION_ACTIVE', ctx({
      policyDecision: { ruleSetVersion: '1.0.0', effectiveDate: new Date('2020-01-01') } as DecisionRecord,
    }))).passed).toBe(true);
  });

  it('GUARD_OUTBOX_READY passes when domain events are an array', async () => {
    const good = { domainEvents: [] } as unknown as AggregateRoot;
    expect((await lib.evaluate('GUARD_OUTBOX_READY', ctx({ aggregate: good }))).passed).toBe(true);
    const bad = { domainEvents: 'nope' } as unknown as AggregateRoot;
    expect((await lib.evaluate('GUARD_OUTBOX_READY', ctx({ aggregate: bad }))).passed).toBe(false);
  });
});

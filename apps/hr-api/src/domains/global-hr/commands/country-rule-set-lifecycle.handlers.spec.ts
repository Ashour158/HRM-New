import { describe, expect, it, vi, beforeEach } from 'vitest';
import { Uuid, ValidationError } from '@hcm/shared-kernel';
import type { HrActor, HrCommandEnvelope } from '@hcm/command-contracts';
import { CountryRuleSet } from '../aggregates/country-rule-set.aggregate.js';
import {
  ActivateCountryRuleSetHandler,
  SupersedeCountryRuleSetHandler,
  RetireCountryRuleSetHandler,
} from './country-rule-set-lifecycle.handlers.js';
import type { CountryRuleSetRepository } from '../repositories/country-rule-set.repository.js';
import type { GlobalHrEventsPublisher } from '../events/global-hr-events.publisher.js';
import type { FsmFramework } from '../../../platform/workflow/fsm-framework.js';

const tenantId = new Uuid('00000000-0000-0000-0000-000000000001');
const actorId = new Uuid('00000000-0000-0000-0000-000000000010');
const ruleSetId = new Uuid('00000000-0000-0000-0000-000000000030');

function actor(): HrActor {
  return {
    actorType: 'USER',
    actorId,
    roles: ['HR_ADMIN', 'GLOBAL_HR_ADMIN'],
    permissions: ['GLOBAL_HR_WRITE'],
    email: 'global.hr@example.com',
    mfaAuthenticated: true,
  };
}

function envelope<T>(commandName: string, payload: T): HrCommandEnvelope<T> {
  return {
    commandId: Uuid.generate(),
    commandName,
    commandSchemaVersion: 1,
    tenantId,
    actor: actor(),
    aggregateType: 'CountryRuleSet',
    aggregateId: ruleSetId,
    expectedState: undefined,
    expectedVersion: undefined,
    idempotencyKey: `${commandName}-${Date.now()}`,
    correlationId: Uuid.generate(),
    reason: 'spec',
    payload,
    metadata: { clientType: 'HR_ADMIN' },
  };
}

function fsm() {
  return {
    getAllowedActionsFromState: vi.fn(() => ['SupersedeCountryRuleSet', 'RetireCountryRuleSet']),
  } as unknown as FsmFramework;
}

function publisher() {
  return { publishUncommitted: vi.fn(async () => undefined) } as unknown as GlobalHrEventsPublisher;
}

function draftRuleSet(): CountryRuleSet {
  return new CountryRuleSet({
    id: ruleSetId,
    tenantId,
    countryCode: 'DE',
    ruleSetType: 'WORKS_COUNCIL',
    ruleSetVersion: '2026.1',
    effectiveFrom: new Date('2026-01-01T00:00:00.000Z'),
    rules: {},
    status: 'DRAFT',
    aggregateVersion: 1,
  });
}

function activeRuleSet(): CountryRuleSet {
  return new CountryRuleSet({
    id: ruleSetId,
    tenantId,
    countryCode: 'DE',
    ruleSetType: 'WORKS_COUNCIL',
    ruleSetVersion: '2026.1',
    effectiveFrom: new Date('2026-01-01T00:00:00.000Z'),
    rules: {},
    status: 'ACTIVE',
    aggregateVersion: 2,
  });
}

describe('CountryRuleSet lifecycle command handlers', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('activates a DRAFT rule set and emits CountryRuleSetActivated', async () => {
    const ruleSet = draftRuleSet();
    const repo = { findByIdForTenant: vi.fn(async () => ruleSet), save: vi.fn() } as unknown as CountryRuleSetRepository;
    const eventsPublisher = publisher();
    const handler = new ActivateCountryRuleSetHandler(repo, fsm(), eventsPublisher);

    const result = await handler.handle(envelope('ActivateCountryRuleSet', { ruleSetId }));

    expect(result.success).toBe(true);
    expect(result.newState).toBe('ACTIVE');
    expect(result.eventsEmitted).toContain('CountryRuleSetActivated');
    expect(repo.findByIdForTenant).toHaveBeenCalledWith(ruleSetId, tenantId);
    expect(repo.save).toHaveBeenCalledWith(expect.objectContaining({ status: 'ACTIVE' }));
    expect(eventsPublisher.publishUncommitted).toHaveBeenCalledWith(
      expect.objectContaining({ id: ruleSetId }),
      tenantId,
      expect.anything(),
    );
  });

  it('rejects activating a rule set that is not DRAFT', async () => {
    const ruleSet = activeRuleSet();
    const repo = { findByIdForTenant: vi.fn(async () => ruleSet), save: vi.fn() } as unknown as CountryRuleSetRepository;
    const eventsPublisher = publisher();
    const handler = new ActivateCountryRuleSetHandler(repo, fsm(), eventsPublisher);

    await expect(handler.handle(envelope('ActivateCountryRuleSet', { ruleSetId }))).rejects.toBeInstanceOf(ValidationError);
    expect(repo.save).not.toHaveBeenCalled();
    expect(eventsPublisher.publishUncommitted).not.toHaveBeenCalled();
  });

  it('scopes the lookup to the command tenant, so a rule set owned by another tenant is not found', async () => {
    // The repository itself is responsible for the tenant filter (WHERE tenant_id = ...);
    // simulate that by having the tenant-scoped mock return nothing, exactly as it would
    // for a real cross-tenant id that doesn't match any row for this tenant.
    const repo = { findByIdForTenant: vi.fn(async () => undefined), save: vi.fn() } as unknown as CountryRuleSetRepository;
    const handler = new ActivateCountryRuleSetHandler(repo, fsm(), publisher());

    await expect(handler.handle(envelope('ActivateCountryRuleSet', { ruleSetId }))).rejects.toThrow(
      'Country rule set not found',
    );
    expect(repo.findByIdForTenant).toHaveBeenCalledWith(ruleSetId, tenantId);
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('supersedes an ACTIVE rule set and records the successor', async () => {
    const ruleSet = activeRuleSet();
    const repo = { findByIdForTenant: vi.fn(async () => ruleSet), save: vi.fn() } as unknown as CountryRuleSetRepository;
    const eventsPublisher = publisher();
    const handler = new SupersedeCountryRuleSetHandler(repo, fsm(), eventsPublisher);

    const result = await handler.handle(
      envelope('SupersedeCountryRuleSet', { ruleSetId, supersededBy: '2026.2' }),
    );

    expect(result.success).toBe(true);
    expect(result.newState).toBe('SUPERSEDED');
    expect(result.eventsEmitted).toContain('CountryRuleSetSuperseded');
    expect(repo.findByIdForTenant).toHaveBeenCalledWith(ruleSetId, tenantId);
    expect(repo.save).toHaveBeenCalledWith(expect.objectContaining({ status: 'SUPERSEDED' }));
    expect(eventsPublisher.publishUncommitted).toHaveBeenCalledWith(
      expect.objectContaining({ id: ruleSetId }),
      tenantId,
      expect.anything(),
    );
  });

  it('rejects superseding a DRAFT rule set', async () => {
    const ruleSet = draftRuleSet();
    const repo = { findByIdForTenant: vi.fn(async () => ruleSet), save: vi.fn() } as unknown as CountryRuleSetRepository;
    const eventsPublisher = publisher();
    const handler = new SupersedeCountryRuleSetHandler(repo, fsm(), eventsPublisher);

    await expect(handler.handle(envelope('SupersedeCountryRuleSet', { ruleSetId }))).rejects.toBeInstanceOf(ValidationError);
    expect(eventsPublisher.publishUncommitted).not.toHaveBeenCalled();
  });

  it('retires an ACTIVE rule set', async () => {
    const ruleSet = activeRuleSet();
    const repo = { findByIdForTenant: vi.fn(async () => ruleSet), save: vi.fn() } as unknown as CountryRuleSetRepository;
    const eventsPublisher = publisher();
    const handler = new RetireCountryRuleSetHandler(repo, fsm(), eventsPublisher);

    const result = await handler.handle(envelope('RetireCountryRuleSet', { ruleSetId }));

    expect(result.success).toBe(true);
    expect(result.newState).toBe('RETIRED');
    expect(result.eventsEmitted).toContain('CountryRuleSetRetired');
    expect(repo.findByIdForTenant).toHaveBeenCalledWith(ruleSetId, tenantId);
    expect(eventsPublisher.publishUncommitted).toHaveBeenCalledWith(
      expect.objectContaining({ id: ruleSetId }),
      tenantId,
      expect.anything(),
    );
  });

  it('rejects retiring a rule set that no longer exists', async () => {
    const repo = { findByIdForTenant: vi.fn(async () => undefined), save: vi.fn() } as unknown as CountryRuleSetRepository;
    const eventsPublisher = publisher();
    const handler = new RetireCountryRuleSetHandler(repo, fsm(), eventsPublisher);

    await expect(handler.handle(envelope('RetireCountryRuleSet', { ruleSetId }))).rejects.toThrow('Country rule set not found');
    expect(eventsPublisher.publishUncommitted).not.toHaveBeenCalled();
  });
});

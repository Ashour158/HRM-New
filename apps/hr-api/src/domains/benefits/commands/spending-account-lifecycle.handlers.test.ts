import { describe, expect, it, vi } from 'vitest';
import { Uuid } from '@hcm/shared-kernel';
import type { HrCommandEnvelope } from '@hcm/command-contracts';
import { BenefitsEventsPublisher } from '../events/benefits-events.publisher.js';
import { SpendingAccount } from '../aggregates/spending-account.aggregate.js';
import { RecordSpendingAccountUsageHandler } from './record-spending-account-usage.handler.js';
import { CloseSpendingAccountHandler } from './close-spending-account.handler.js';

const tenantId = new Uuid('00000000-0000-0000-0000-000000000001');
const actorId = new Uuid('00000000-0000-0000-0000-000000000002');
const commandId = new Uuid('00000000-0000-0000-0000-000000000003');
const correlationId = new Uuid('00000000-0000-0000-0000-000000000004');
const workerId = new Uuid('00000000-0000-0000-0000-000000000005');
const accountId = new Uuid('00000000-0000-0000-0000-000000000006');

function command(commandName: string, payload: unknown, aggregateId?: Uuid): HrCommandEnvelope<unknown> {
  return {
    commandId,
    commandName,
    commandSchemaVersion: 1,
    tenantId,
    actor: {
      actorType: 'USER',
      actorId,
      roles: ['BENEFITS_ADMIN'],
      permissions: ['benefits:write'],
      mfaAuthenticated: true,
    },
    aggregateType: 'SpendingAccount',
    aggregateId,
    idempotencyKey: `${commandName}-key`,
    correlationId,
    reason: 'spending account lifecycle test',
    payload,
    metadata: {
      requestHash: `${commandName}-hash`,
      clientType: 'HR_ADMIN',
      hrDataSensitivity: 'LOW',
    },
  };
}

function account(status: SpendingAccount['status'], overrides: Partial<{ usedAmount: number; availableAmount: number }> = {}) {
  return new SpendingAccount({
    id: accountId,
    tenantId,
    workerId,
    accountType: 'HSA',
    annualElection: 2000,
    usedAmount: overrides.usedAmount ?? 0,
    availableAmount: overrides.availableAmount ?? 2000,
    currency: 'USD',
    status,
    aggregateVersion: 1,
  });
}

describe('SpendingAccount lifecycle command handlers', () => {
  it('records usage against an ACTIVE account and reduces the available balance', async () => {
    const existing = account('ACTIVE');
    const repo = { findById: vi.fn(async () => existing), save: vi.fn(async () => undefined) };
    const handler = new RecordSpendingAccountUsageHandler(
      repo as never,
      new BenefitsEventsPublisher(),
      { getAllowedActions: vi.fn(() => ['RecordUsage', 'Suspend', 'Close']) } as never,
    );

    const result = await handler.handle(command('RecordSpendingAccountUsage', { accountId, amount: 300 }, accountId));

    expect(existing.usedAmount).toBe(300);
    expect(existing.availableAmount).toBe(1700);
    expect(result).toEqual(expect.objectContaining({
      newState: 'ACTIVE',
      eventsEmitted: ['SpendingAccountUpdated'],
    }));
    expect(result.data).toEqual(expect.objectContaining({
      accountId: accountId.value,
      usedAmount: 300,
      availableAmount: 1700,
    }));
  });

  it('rejects usage exceeding the available balance', async () => {
    const existing = account('ACTIVE', { usedAmount: 1900, availableAmount: 100 });
    const repo = { findById: vi.fn(async () => existing), save: vi.fn(async () => undefined) };
    const handler = new RecordSpendingAccountUsageHandler(
      repo as never,
      new BenefitsEventsPublisher(),
      { getAllowedActions: vi.fn(() => []) } as never,
    );

    await expect(handler.handle(command('RecordSpendingAccountUsage', { accountId, amount: 500 }, accountId))).rejects.toThrow(
      'Usage amount exceeds available balance',
    );
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('closes an ACTIVE spending account permanently', async () => {
    const existing = account('ACTIVE');
    const repo = { findById: vi.fn(async () => existing), save: vi.fn(async () => undefined) };
    const handler = new CloseSpendingAccountHandler(
      repo as never,
      new BenefitsEventsPublisher(),
      { getAllowedActions: vi.fn(() => []) } as never,
    );

    const result = await handler.handle(command('CloseSpendingAccount', { accountId }, accountId));

    expect(existing.status).toBe('CLOSED');
    expect(result).toEqual(expect.objectContaining({
      newState: 'CLOSED',
      eventsEmitted: ['SpendingAccountClosed'],
    }));
    // BenefitsCarrierConsumer needs accountId/workerId/accountType to stop
    // the carrier-side FSA/HSA contribution -- all must be present.
    expect(result.data).toEqual(expect.objectContaining({
      accountId: accountId.value,
      workerId: workerId.value,
      accountType: 'HSA',
      status: 'CLOSED',
    }));
  });

  it('rejects closing an already-CLOSED (terminal) spending account', async () => {
    const existing = account('CLOSED');
    const repo = { findById: vi.fn(async () => existing), save: vi.fn(async () => undefined) };
    const handler = new CloseSpendingAccountHandler(
      repo as never,
      new BenefitsEventsPublisher(),
      { getAllowedActions: vi.fn(() => []) } as never,
    );

    await expect(handler.handle(command('CloseSpendingAccount', { accountId }, accountId))).rejects.toThrow(
      'Cannot close SpendingAccount from state CLOSED',
    );
  });
});

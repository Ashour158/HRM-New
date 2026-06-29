import { describe, expect, it } from 'vitest';
import { mapTransitionLedgerRow } from './transition-ledger.js';

describe('mapTransitionLedgerRow', () => {
  const row = {
    id: 'ledger-row-pk',
    command_id: 'the-command-id',
    tenant_id: 'tenant-1',
    aggregate_type: 'Offer',
    aggregate_id: 'agg-1',
    from_state: 'SENT',
    to_state: 'ACCEPTED',
    action: 'accept',
    triggered_by: 'actor-1',
    occurred_at: new Date('2026-06-28T00:00:00.000Z'),
    correlation_id: 'corr-1',
    decision_record_id: 'dr-1',
  };

  it('reads commandId from command_id, NOT the row id (regression)', () => {
    const entry = mapTransitionLedgerRow(row);
    expect(entry.commandId as unknown as string).toBe('the-command-id');
    expect(entry.id as unknown as string).toBe('ledger-row-pk');
    expect(entry.commandId).not.toBe(entry.id);
  });

  it('maps the remaining columns and leaves decisionRecordId optional', () => {
    const entry = mapTransitionLedgerRow(row);
    expect(entry.fromState).toBe('SENT');
    expect(entry.toState).toBe('ACCEPTED');
    expect(entry.action).toBe('accept');
    expect(entry.decisionRecordId as unknown as string).toBe('dr-1');

    const noDecision: Partial<typeof row> = { ...row };
    delete noDecision.decision_record_id;
    expect(mapTransitionLedgerRow(noDecision).decisionRecordId).toBeUndefined();
  });
});

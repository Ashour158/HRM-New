import { describe, expect, it } from 'vitest';
import { AttendanceCorrectionRequestRepository } from './attendance-correction-request.repository.js';
import type { AttendanceCorrectionRequestRecord } from '../services/attendance-correction.service.js';

describe('AttendanceCorrectionRequestRepository JSON audit mapping', () => {
  const repo = Object.create(AttendanceCorrectionRequestRepository.prototype) as {
    toInsertRow(record: Omit<AttendanceCorrectionRequestRecord, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }, now: Date): Record<string, unknown>;
    toRecord(row: Record<string, unknown>): AttendanceCorrectionRequestRecord;
  };

  it('serializes audit trail entries for Postgres jsonb writes', () => {
    const now = new Date('2026-06-03T09:00:00.000Z');
    const row = repo.toInsertRow({
      tenantId: '00000000-0000-0000-0000-000000000001',
      workerId: '00000000-0000-0000-0000-000000000012',
      workDate: '2026-06-03',
      correctionType: 'ADD_CLOCK_EVENT',
      requestedEventType: 'CLOCK_IN',
      requestedTimestamp: now,
      reason: 'Location denied',
      status: 'PENDING_MANAGER_REVIEW',
      requestedBy: '00000000-0000-0000-0000-000000000012',
      requestedAt: now,
      auditTrail: [{ action: 'REQUESTED', actorId: '00000000-0000-0000-0000-000000000012', note: 'Location denied', timestamp: now.toISOString() }],
    }, now);

    expect(row.audit_trail).toBe(JSON.stringify([
      { action: 'REQUESTED', actorId: '00000000-0000-0000-0000-000000000012', note: 'Location denied', timestamp: now.toISOString() },
    ]));
  });

  it('hydrates audit trail whether Postgres returns objects or strings', () => {
    const now = new Date('2026-06-03T09:00:00.000Z');
    const hydrated = repo.toRecord({
      id: '00000000-0000-0000-0000-000000000901',
      tenant_id: '00000000-0000-0000-0000-000000000001',
      worker_id: '00000000-0000-0000-0000-000000000012',
      work_date: now,
      correction_type: 'ADD_CLOCK_EVENT',
      requested_event_type: 'CLOCK_IN',
      requested_timestamp: now,
      target_event_id: null,
      reason: 'Location denied',
      status: 'PENDING_MANAGER_REVIEW',
      requested_by: '00000000-0000-0000-0000-000000000012',
      requested_at: now,
      reviewed_by: null,
      reviewed_at: null,
      applied_by: null,
      applied_at: null,
      applied_event_id: null,
      audit_trail: '[{"action":"REQUESTED","actorId":"00000000-0000-0000-0000-000000000012","timestamp":"2026-06-03T09:00:00.000Z"}]',
      aggregate_version: 0,
      created_at: now,
      updated_at: now,
    });

    expect(hydrated.auditTrail).toEqual([
      { action: 'REQUESTED', actorId: '00000000-0000-0000-0000-000000000012', timestamp: '2026-06-03T09:00:00.000Z' },
    ]);
  });
});

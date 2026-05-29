import { describe, expect, it } from 'vitest';
import { AccessControlService } from './access-control.service.js';

describe('AccessControlService time and attendance self-service commands', () => {
  const service = new AccessControlService();

  it('allows employees to record their own attendance event through self service', () => {
    const decision = service.evaluateCommandAccess({
      commandName: 'RecordTimeClockEvent',
      commandType: 'CREATE',
      aggregateType: 'TimeClockEvent',
      payload: {},
    }, {
      actorType: 'EMPLOYEE',
      roles: ['EMPLOYEE'],
    });

    expect(decision.allowed).toBe(true);
  });

  it('allows managers to review attendance correction requests', () => {
    const decision = service.evaluateCommandAccess({
      commandName: 'ReviewAttendanceCorrectionRequest',
      commandType: 'APPROVE',
      aggregateType: 'AttendanceCorrectionRequest',
      payload: {},
    }, {
      actorType: 'MANAGER',
      roles: ['MANAGER'],
    });

    expect(decision.allowed).toBe(true);
  });

  it('does not allow employees to finalize attendance ledgers', () => {
    const decision = service.evaluateCommandAccess({
      commandName: 'FinalizeAttendanceDailyLedger',
      commandType: 'UPDATE',
      aggregateType: 'AttendanceDailyLedger',
      payload: {},
    }, {
      actorType: 'EMPLOYEE',
      roles: ['EMPLOYEE'],
    });

    expect(decision.allowed).toBe(false);
  });

  it('allows HR admins to create performance review cycles', () => {
    const decision = service.evaluateCommandAccess({
      commandName: 'CreatePerformanceReviewCycle',
      commandType: 'CREATE',
      aggregateType: 'PerformanceReviewCycle',
      payload: {},
    }, {
      actorType: 'HR_ADMIN',
      roles: ['HR_ADMIN'],
    });

    expect(decision.allowed).toBe(true);
  });
});

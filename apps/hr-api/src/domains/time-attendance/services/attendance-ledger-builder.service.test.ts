import { describe, expect, it, vi } from 'vitest';
import { Email, Uuid } from '@hcm/shared-kernel';
import { DEFAULT_HCM_SETUP } from '../../hcm-setup/hcm-setup.defaults.js';
import { WorkerProfile } from '../../hr-core/aggregates/worker-profile.aggregate.js';
import { LeavePolicyService } from '../../absence-leave/services/leave-policy.service.js';
import { AttendanceLedgerService } from './attendance-ledger.service.js';
import { AttendanceLedgerBuilderService } from './attendance-ledger-builder.service.js';
import { AttendancePolicyResolutionService } from './attendance-policy-resolution.service.js';

describe('AttendanceLedgerBuilderService', () => {
  const tenantId = new Uuid('00000000-0000-0000-0000-000000000001');
  const workerId = new Uuid('11111111-1111-1111-1111-111111111111');

  function activeWorker() {
    return new WorkerProfile({
      id: workerId,
      tenantId,
      employeeNumber: 'EMP-001',
      status: 'ACTIVE',
      firstName: 'Mona',
      lastName: 'Nader',
      email: new Email('mona@example.com'),
      hireDate: new Date('2024-01-01T00:00:00.000Z'),
      employmentType: 'FULL_TIME',
    });
  }

  it('builds daily ledgers from tenant-scoped workers, clock events, and exceptions', async () => {
    const workerRepo = {
      findByStatusForTenant: vi.fn(async () => [activeWorker()]),
    };
    const personalDataRepo = {
      findByWorker: vi.fn(async () => []),
    };
    const workScheduleRepo = {
      findByWorker: vi.fn(async () => []),
    };
    const timeClockEventRepo = {
      findByWorkerForTenant: vi.fn(async () => []),
    };
    const attendanceExceptionRepo = {
      findByWorkerForTenant: vi.fn(async () => []),
    };
    const absenceRequestRepo = {
      findApprovedOverlapping: vi.fn(async () => []),
    };
    const service = new AttendanceLedgerBuilderService(
      { getSetup: vi.fn(async () => DEFAULT_HCM_SETUP) } as never,
      workerRepo as never,
      personalDataRepo as never,
      workScheduleRepo as never,
      timeClockEventRepo as never,
      attendanceExceptionRepo as never,
      absenceRequestRepo as never,
      new AttendanceLedgerService(),
      new AttendancePolicyResolutionService(),
      new LeavePolicyService(),
    );

    const ledger = await service.buildDailyLedger(tenantId, { date: '2026-05-25' });

    expect(workerRepo.findByStatusForTenant).toHaveBeenCalledWith('ACTIVE', tenantId, { limit: 5000 });
    expect(timeClockEventRepo.findByWorkerForTenant).toHaveBeenCalledWith(tenantId, workerId);
    expect(attendanceExceptionRepo.findByWorkerForTenant).toHaveBeenCalledWith(tenantId, workerId);
    expect(absenceRequestRepo.findApprovedOverlapping).toHaveBeenCalledWith(tenantId, '2026-05-25', '2026-05-25', [workerId.value]);
    expect(ledger.summary.totalEmployees).toBe(1);
  });
});

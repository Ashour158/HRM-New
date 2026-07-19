import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import type { Request } from 'express';
import { Uuid } from '@hcm/shared-kernel';
import { ReportLibraryController } from './report-library.controller.js';
import { AttendanceReportingService } from '../../time-attendance/services/attendance-reporting.service.js';

const tenantId = new Uuid('00000000-0000-0000-0000-000000000001');
const otherTenantId = new Uuid('00000000-0000-0000-0000-000000000999');
const selfWorkerId = new Uuid('00000000-0000-0000-0000-000000000010');
const managerId = new Uuid('00000000-0000-0000-0000-000000000020');
const directReportId = new Uuid('00000000-0000-0000-0000-000000000021');
const otherManagerReportId = new Uuid('00000000-0000-0000-0000-000000000099');

function request(overrides: { roles?: string[]; actorId?: Uuid; email?: string; tenantId?: string } = {}): Request {
  return {
    tenantId: overrides.tenantId ?? tenantId.value,
    actor: {
      actorType: 'USER',
      actorId: overrides.actorId ?? selfWorkerId,
      roles: overrides.roles ?? ['EMPLOYEE'],
      permissions: [],
      mfaAuthenticated: true,
      email: overrides.email ?? 'self@example.com',
    },
  } as unknown as Request;
}

function worker(overrides: Record<string, unknown> = {}) {
  return {
    id: selfWorkerId,
    tenantId,
    employeeNumber: 'EMP-100',
    firstName: 'Sam',
    lastName: 'Rivera',
    email: { toString: () => 'self@example.com' },
    status: 'ACTIVE',
    managerId: undefined,
    ...overrides,
  };
}

function makeController(overrides: {
  workerRepo?: Record<string, ReturnType<typeof vi.fn>>;
  accrualBalanceRepo?: Record<string, ReturnType<typeof vi.fn>>;
  absenceRequestRepo?: Record<string, ReturnType<typeof vi.fn>>;
  entitlementCalculationRepo?: Record<string, ReturnType<typeof vi.fn>>;
  leavePolicyService?: Record<string, ReturnType<typeof vi.fn>>;
  hcmSetupService?: Record<string, ReturnType<typeof vi.fn>>;
  attendanceLedgerBuilder?: Record<string, ReturnType<typeof vi.fn>>;
  attendanceReportingService?: AttendanceReportingService;
  learningAssignmentRepo?: Record<string, ReturnType<typeof vi.fn>>;
  learningCourseRepo?: Record<string, ReturnType<typeof vi.fn>>;
  certificationRepo?: Record<string, ReturnType<typeof vi.fn>>;
  reviewRepo?: Record<string, ReturnType<typeof vi.fn>>;
  goalRepo?: Record<string, ReturnType<typeof vi.fn>>;
} = {}) {
  const workerRepo = overrides.workerRepo ?? {
    findByIdForTenant: vi.fn(async () => worker()),
    findByEmailForTenant: vi.fn(async () => worker()),
    findByManagerForTenant: vi.fn(async () => []),
  };
  const accrualBalanceRepo = overrides.accrualBalanceRepo ?? { findByWorker: vi.fn(async () => []) };
  const absenceRequestRepo = overrides.absenceRequestRepo ?? { findByWorker: vi.fn(async () => []) };
  const entitlementCalculationRepo = overrides.entitlementCalculationRepo ?? { findByWorker: vi.fn(async () => []) };
  const leavePolicyService = overrides.leavePolicyService ?? {
    resolvePolicy: vi.fn(() => ({ code: 'ANNUAL', label: 'Annual Leave', unit: 'DAYS' })),
    amountFromStoredHours: vi.fn((_setup: unknown, _policy: unknown, hours: number) => hours),
  };
  const hcmSetupService = overrides.hcmSetupService ?? {
    getSetup: vi.fn(async () => ({ leavePolicies: [] })),
  };
  const attendanceLedgerBuilder = overrides.attendanceLedgerBuilder ?? {
    buildDailyLedger: vi.fn(async () => ({ workDate: '2026-07-01', rows: [] })),
  };
  const attendanceReportingService = overrides.attendanceReportingService ?? new AttendanceReportingService();
  const learningAssignmentRepo = overrides.learningAssignmentRepo ?? { findByWorker: vi.fn(async () => []) };
  const learningCourseRepo = overrides.learningCourseRepo ?? { findById: vi.fn(async () => undefined) };
  const certificationRepo = overrides.certificationRepo ?? { findByWorker: vi.fn(async () => []) };
  const reviewRepo = overrides.reviewRepo ?? { findByWorker: vi.fn(async () => []) };
  const goalRepo = overrides.goalRepo ?? { findByWorker: vi.fn(async () => []) };

  const controller = new ReportLibraryController(
    workerRepo as never,
    accrualBalanceRepo as never,
    absenceRequestRepo as never,
    entitlementCalculationRepo as never,
    leavePolicyService as never,
    hcmSetupService as never,
    attendanceLedgerBuilder as never,
    attendanceReportingService,
    learningAssignmentRepo as never,
    learningCourseRepo as never,
    certificationRepo as never,
    reviewRepo as never,
    goalRepo as never,
  );

  return {
    controller,
    workerRepo,
    accrualBalanceRepo,
    absenceRequestRepo,
    entitlementCalculationRepo,
    hcmSetupService,
    attendanceLedgerBuilder,
    learningAssignmentRepo,
    learningCourseRepo,
    certificationRepo,
    reviewRepo,
    goalRepo,
  };
}

describe('ReportLibraryController catalog', () => {
  it('returns the full report registry including all three tiers', () => {
    const { controller } = makeController();
    const result = controller.getCatalog();
    const tiers = new Set(result.reports.map((report) => report.tier));
    expect(tiers).toEqual(new Set(['MY', 'TEAM', 'ORG']));
    expect(result.reports.some((report) => report.key === 'my-time-off-balance')).toBe(true);
    expect(result.reports.some((report) => report.key === 'team-attendance-summary')).toBe(true);
  });
});

describe('ReportLibraryController My Reports', () => {
  it('rejects unknown report keys', async () => {
    const { controller } = makeController();
    await expect(controller.runMyReport('not-a-real-report', request())).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects LINK-kind report keys (they are not executable via run)', async () => {
    const { controller } = makeController();
    await expect(controller.runMyReport('my-compensation-payslip', request())).rejects.toBeInstanceOf(BadRequestException);
  });

  it('resolves the caller\'s own worker id server-side - never trusts a client-supplied id', async () => {
    const { controller, workerRepo, accrualBalanceRepo, absenceRequestRepo, entitlementCalculationRepo } = makeController();
    await controller.runMyReport('my-time-off-balance', request());
    expect(workerRepo.findByIdForTenant).toHaveBeenCalledWith(selfWorkerId, tenantId);
    expect(accrualBalanceRepo.findByWorker).toHaveBeenCalledWith(selfWorkerId);
    expect(absenceRequestRepo.findByWorker).toHaveBeenCalledWith(selfWorkerId);
    expect(entitlementCalculationRepo.findByWorker).toHaveBeenCalledWith(selfWorkerId);
  });

  it('falls back to email lookup when the actor id is not a worker id', async () => {
    const workerRepo = {
      findByIdForTenant: vi.fn(async () => undefined),
      findByEmailForTenant: vi.fn(async () => worker()),
      findByManagerForTenant: vi.fn(async () => []),
    };
    const { controller } = makeController({ workerRepo });
    await controller.runMyReport('my-time-off-balance', request({ actorId: new Uuid('00000000-0000-0000-0000-0000000000ee') }));
    expect(workerRepo.findByEmailForTenant).toHaveBeenCalledWith('self@example.com', tenantId);
  });

  it('rejects when no worker profile is linked to the authenticated user', async () => {
    const workerRepo = {
      findByIdForTenant: vi.fn(async () => undefined),
      findByEmailForTenant: vi.fn(async () => undefined),
      findByManagerForTenant: vi.fn(async () => []),
    };
    const { controller } = makeController({ workerRepo });
    await expect(controller.runMyReport('my-time-off-balance', request())).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('builds the attendance summary scoped strictly to the caller\'s own worker id', async () => {
    const { controller, attendanceLedgerBuilder } = makeController();
    const result = await controller.runMyReport('my-attendance-summary', request());
    expect(result.scope).toBe('SELF');
    for (const call of attendanceLedgerBuilder.buildDailyLedger.mock.calls) {
      expect(call[1]).toEqual(expect.objectContaining({ workerId: selfWorkerId.value }));
      expect(call[1].managerId).toBeUndefined();
    }
  });

  it('builds learning progress from the caller\'s own assignments and certifications', async () => {
    const courseId = new Uuid('00000000-0000-0000-0000-000000000301');
    const learningAssignmentRepo = {
      findByWorker: vi.fn(async () => [{
        id: new Uuid('00000000-0000-0000-0000-000000000401'),
        courseId,
        status: 'IN_PROGRESS',
        assignedAt: new Date('2026-06-01T00:00:00.000Z'),
        dueDate: new Date('2026-08-01T00:00:00.000Z'),
      }]),
    };
    const learningCourseRepo = { findById: vi.fn(async () => ({ id: courseId, title: 'Data Privacy Basics' })) };
    const certificationRepo = {
      findByWorker: vi.fn(async () => [{
        id: new Uuid('00000000-0000-0000-0000-000000000501'),
        certificationName: 'PMP',
        status: 'ACTIVE',
        issueDate: new Date('2025-01-01T00:00:00.000Z'),
      }]),
    };
    const { controller } = makeController({ learningAssignmentRepo, learningCourseRepo, certificationRepo });
    const result = await controller.runMyReport('my-learning-progress', request());
    expect(result.assignments).toEqual([expect.objectContaining({ courseTitle: 'Data Privacy Basics', status: 'IN_PROGRESS' })]);
    expect(result.certifications).toEqual([expect.objectContaining({ certificationName: 'PMP', status: 'ACTIVE' })]);
    expect(result.summary.activeCertifications).toBe(1);
  });
});

describe('ReportLibraryController Team Reports', () => {
  function manager(overrides: Record<string, unknown> = {}) {
    return worker({ id: managerId, employeeNumber: 'MGR-1', firstName: 'Lee', lastName: 'Manager', email: { toString: () => 'manager@example.com' }, ...overrides });
  }

  function directReport(overrides: Record<string, unknown> = {}) {
    return worker({ id: directReportId, employeeNumber: 'EMP-200', firstName: 'Dana', lastName: 'Doe', managerId, ...overrides });
  }

  it('rejects non-manager callers before touching any repository', async () => {
    const { controller, workerRepo } = makeController();
    await expect(controller.runTeamReport('team-attendance-summary', request({ roles: ['EMPLOYEE'] })))
      .rejects.toBeInstanceOf(ForbiddenException);
    expect(workerRepo.findByManagerForTenant).not.toHaveBeenCalled();
  });

  it('rejects unknown report keys for managers', async () => {
    const workerRepo = {
      findByIdForTenant: vi.fn(async () => manager()),
      findByEmailForTenant: vi.fn(async () => manager()),
      findByManagerForTenant: vi.fn(async () => []),
    };
    const { controller } = makeController({ workerRepo });
    await expect(controller.runTeamReport('not-a-real-report', request({ roles: ['MANAGER'], actorId: managerId })))
      .rejects.toBeInstanceOf(BadRequestException);
  });

  it('scopes team attendance to the manager\'s own resolved id, not a client-supplied id', async () => {
    const workerRepo = {
      findByIdForTenant: vi.fn(async () => manager()),
      findByEmailForTenant: vi.fn(async () => manager()),
      findByManagerForTenant: vi.fn(async () => [directReport()]),
    };
    const { controller, attendanceLedgerBuilder } = makeController({ workerRepo });
    const result = await controller.runTeamReport('team-attendance-summary', request({ roles: ['MANAGER'], actorId: managerId, email: 'manager@example.com' }));
    expect(result.scope).toBe('TEAM');
    expect(workerRepo.findByManagerForTenant).toHaveBeenCalledWith(managerId, tenantId);
    for (const call of attendanceLedgerBuilder.buildDailyLedger.mock.calls) {
      expect(call[1]).toEqual(expect.objectContaining({ managerId: managerId.value }));
    }
  });

  it('excludes direct reports belonging to a different manager or tenant', async () => {
    const crossManagerReport = worker({
      id: otherManagerReportId,
      employeeNumber: 'EMP-999',
      managerId: new Uuid('00000000-0000-0000-0000-000000000777'),
    });
    const crossTenantReport = worker({ id: directReportId, tenantId: otherTenantId, managerId });
    const workerRepo = {
      findByIdForTenant: vi.fn(async () => manager()),
      findByEmailForTenant: vi.fn(async () => manager()),
      findByManagerForTenant: vi.fn(async () => [crossManagerReport, crossTenantReport]),
    };
    const absenceRequestRepo = { findByWorker: vi.fn(async () => []) };
    const { controller } = makeController({ workerRepo, absenceRequestRepo });
    const result = await controller.runTeamReport('team-leave-calendar', request({ roles: ['MANAGER'], actorId: managerId, email: 'manager@example.com' }));
    expect(result.summary.teamSize).toBe(0);
    expect(absenceRequestRepo.findByWorker).not.toHaveBeenCalled();
  });

  it('builds the leave calendar only from approved/pending upcoming absences of direct reports', async () => {
    const workerRepo = {
      findByIdForTenant: vi.fn(async () => manager()),
      findByEmailForTenant: vi.fn(async () => manager()),
      findByManagerForTenant: vi.fn(async () => [directReport()]),
    };
    const farFuture = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    const farPast = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const absenceRequestRepo = {
      findByWorker: vi.fn(async () => [
        { id: new Uuid('00000000-0000-0000-0000-000000000601'), workerId: directReportId, absenceType: 'ANNUAL', startDate: farFuture, endDate: farFuture, status: 'APPROVED' },
        { id: new Uuid('00000000-0000-0000-0000-000000000602'), workerId: directReportId, absenceType: 'SICK', startDate: farPast, endDate: farPast, status: 'APPROVED' },
        { id: new Uuid('00000000-0000-0000-0000-000000000603'), workerId: directReportId, absenceType: 'ANNUAL', startDate: farFuture, endDate: farFuture, status: 'REJECTED' },
      ]),
    };
    const { controller } = makeController({ workerRepo, absenceRequestRepo });
    const result = await controller.runTeamReport('team-leave-calendar', request({ roles: ['MANAGER'], actorId: managerId, email: 'manager@example.com' }));
    expect(result.upcoming).toHaveLength(1);
    expect(result.upcoming[0]).toEqual(expect.objectContaining({ workerId: directReportId.value, status: 'APPROVED', type: 'ANNUAL' }));
  });

  it('builds the performance distribution only from direct reports\' reviews and goals', async () => {
    const workerRepo = {
      findByIdForTenant: vi.fn(async () => manager()),
      findByEmailForTenant: vi.fn(async () => manager()),
      findByManagerForTenant: vi.fn(async () => [directReport()]),
    };
    const reviewRepo = {
      findByWorker: vi.fn(async () => [{
        id: new Uuid('00000000-0000-0000-0000-000000000701'),
        workerId: directReportId,
        finalRating: 4.6,
        status: 'FINALIZED',
        updatedAt: new Date('2026-05-01T00:00:00.000Z'),
      }]),
    };
    const goalRepo = {
      findByWorker: vi.fn(async () => [
        { id: new Uuid('00000000-0000-0000-0000-000000000801'), workerId: directReportId, status: 'ACHIEVED', targetValue: 100, currentValue: 100 },
        { id: new Uuid('00000000-0000-0000-0000-000000000802'), workerId: directReportId, status: 'IN_PROGRESS', targetValue: 100, currentValue: 40 },
      ]),
    };
    const { controller } = makeController({ workerRepo, reviewRepo, goalRepo });
    const result = await controller.runTeamReport('team-performance-distribution', request({ roles: ['MANAGER'], actorId: managerId, email: 'manager@example.com' }));
    expect(result.workerCount).toBe(1);
    expect(result.averageRating).toBe(4.6);
    expect(result.ratingDistribution).toEqual(expect.arrayContaining([{ band: 'OUTSTANDING', count: 1 }]));
    expect(result.workers[0]).toEqual(expect.objectContaining({ workerId: directReportId.value, openGoals: 1, achievedGoals: 1 }));
  });

  it('rejects inactive managers', async () => {
    const workerRepo = {
      findByIdForTenant: vi.fn(async () => manager({ status: 'TERMINATED' })),
      findByEmailForTenant: vi.fn(async () => manager({ status: 'TERMINATED' })),
      findByManagerForTenant: vi.fn(async () => []),
    };
    const { controller } = makeController({ workerRepo });
    await expect(controller.runTeamReport('team-attendance-summary', request({ roles: ['MANAGER'], actorId: managerId })))
      .rejects.toBeInstanceOf(ForbiddenException);
  });
});

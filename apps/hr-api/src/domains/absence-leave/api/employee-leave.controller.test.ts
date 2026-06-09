import { BadRequestException } from '@nestjs/common';
import { PATH_METADATA } from '@nestjs/common/constants';
import { describe, expect, it, vi } from 'vitest';
import type { Request } from 'express';
import { Uuid } from '@hcm/shared-kernel';
import { EmployeeLeaveController } from './employee-leave.controller.js';
import { AbsenceRequest } from '../aggregates/absence-request.aggregate.js';

const tenantId = new Uuid('00000000-0000-0000-0000-000000000001');
const requestId = new Uuid('00000000-0000-0000-0000-000000000701');
const workerId = new Uuid('00000000-0000-0000-0000-000000000702');
const actorId = new Uuid('00000000-0000-0000-0000-000000000703');

function makePendingAbsence() {
  const absence = AbsenceRequest.create({
    id: requestId,
    tenantId,
    workerId,
    absenceType: 'VACATION',
    startDate: new Date('2026-06-08T00:00:00.000Z'),
    endDate: new Date('2026-06-09T00:00:00.000Z'),
    durationUnit: 'DAYS',
    durationAmount: 2,
  }, Uuid.generate());
  absence.submit(Uuid.generate());
  return absence;
}

function makeRequest(roles = ['HR_ADMIN']): Request {
  return {
    tenantId: tenantId.value,
    actor: {
      actorType: 'USER',
      actorId,
      roles,
      permissions: ['ABSENCE_APPROVE'],
      mfaAuthenticated: true,
      email: 'employee@example.com',
    },
  } as unknown as Request;
}

function commandError(errorMessage = 'Policy validation failed') {
  return {
    success: false,
    errorCode: 'ABSENCE_POLICY_REJECTED',
    errorMessage,
    commandId: Uuid.generate(),
    correlationId: Uuid.generate(),
    stepFailed: 13,
    retryable: false,
  };
}

function makeController(options?: {
  commandBus?: { execute: ReturnType<typeof vi.fn> };
  workerRepo?: Record<string, ReturnType<typeof vi.fn>>;
  absenceRequestRepo?: Record<string, ReturnType<typeof vi.fn>>;
}) {
  const commandBus = options?.commandBus ?? {
    execute: vi.fn().mockResolvedValue({
      success: true,
      auditRecordId: Uuid.generate(),
    }),
  };
  const workerRepo = options?.workerRepo ?? {
    findById: vi.fn().mockResolvedValue(undefined),
    findByEmail: vi.fn(),
    findByManager: vi.fn(),
  };
  const absenceRequestRepo = options?.absenceRequestRepo ?? {
    findById: vi.fn().mockResolvedValue(makePendingAbsence()),
  };
  const controller = new EmployeeLeaveController(
    commandBus as never,
    workerRepo as never,
    absenceRequestRepo as never,
    { findByWorker: vi.fn() } as never,
    { getSetup: vi.fn() } as never,
    {} as never,
  );
  return { controller, commandBus, workerRepo, absenceRequestRepo };
}

describe('EmployeeLeaveController manager leave actions', () => {
  it('exposes manager dashboard through the employee self-service namespace', async () => {
    const manager = {
      id: actorId,
      tenantId,
      firstName: 'Line',
      lastName: 'Manager',
      employeeNumber: 'M-100',
      email: { toString: () => 'manager@example.com' },
      status: 'ACTIVE',
    };
    const directReport = {
      id: workerId,
      tenantId,
      firstName: 'Mona',
      lastName: 'Saleh',
      employeeNumber: 'E-100',
      email: { toString: () => 'employee@example.com' },
      status: 'ACTIVE',
      managerId: actorId,
    };
    const { controller } = makeController({
      workerRepo: {
        findById: vi.fn().mockResolvedValue(manager),
        findByEmail: vi.fn().mockResolvedValue(manager),
        findByManager: vi.fn().mockResolvedValue([directReport]),
      },
      absenceRequestRepo: {
        findById: vi.fn(),
        findByWorker: vi.fn().mockResolvedValue([]),
        findByTenant: vi.fn(),
      },
    });

    const result = await controller.getEmployeeManagerDashboard(makeRequest(['EMPLOYEE', 'MANAGER']));

    expect(result.directReports).toEqual([
      expect.objectContaining({
        id: workerId.value,
        employeeId: 'E-100',
        firstName: 'Mona',
        lastName: 'Saleh',
      }),
    ]);
    expect(result.pendingApprovals.absences).toEqual([]);
  });

  it('passes the visible rejection reason into the command payload for audit trail storage', async () => {
    const { controller, commandBus } = makeController();

    await (controller as unknown as {
      rejectLeaveRequest: (id: string, body: { reason: string }, req: Request) => Promise<unknown>;
    }).rejectLeaveRequest(
      requestId.value,
      { reason: 'Coverage conflict during payroll close' },
      makeRequest(),
    );

    expect(commandBus.execute).toHaveBeenCalledWith(expect.objectContaining({
      commandName: 'RejectAbsenceRequest',
      payload: expect.objectContaining({
        absenceRequestId: requestId,
        rejectionReason: 'Coverage conflict during payroll close',
      }),
    }));
  });

  it('throws a non-2xx error when approving returns a failed command outcome', async () => {
    const { controller } = makeController({
      commandBus: { execute: vi.fn().mockResolvedValue(commandError('Request is not reviewable')) },
    });

    await expect(controller.approveLeaveRequest(requestId.value, makeRequest())).rejects.toBeInstanceOf(BadRequestException);
  });

  it('throws a non-2xx error when rejecting returns a failed command outcome', async () => {
    const { controller } = makeController({
      commandBus: { execute: vi.fn().mockResolvedValue(commandError('Rejection reason is required')) },
    });

    await expect(controller.rejectLeaveRequest(requestId.value, { reason: 'No coverage' }, makeRequest())).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('EmployeeLeaveController employee leave actions', () => {
  it('exposes the enterprise readiness leave request command route', () => {
    expect(Reflect.getMetadata(PATH_METADATA, EmployeeLeaveController.prototype.createEmployeeAbsenceRequest)).toBe('employee/absences/requests');
  });

  it('throws a non-2xx error when employee create returns a failed command outcome', async () => {
    const worker = {
      id: workerId,
      firstName: 'Mona',
      lastName: 'Saleh',
      employeeNumber: 'E-100',
    };
    const { controller } = makeController({
      commandBus: { execute: vi.fn().mockResolvedValue(commandError('Insufficient leave balance')) },
      workerRepo: {
        findById: vi.fn().mockResolvedValue(worker),
        findByEmail: vi.fn().mockResolvedValue(worker),
        findByManager: vi.fn(),
      },
    });

    await expect(controller.createEmployeeAbsence({
      type: 'VACATION',
      startDate: new Date('2026-06-08T00:00:00.000Z'),
      endDate: new Date('2026-06-09T00:00:00.000Z'),
    }, makeRequest(['EMPLOYEE']))).rejects.toBeInstanceOf(BadRequestException);
  });

  it('throws a non-2xx error when employee submit returns a failed command outcome', async () => {
    const worker = {
      id: workerId,
      firstName: 'Mona',
      lastName: 'Saleh',
      employeeNumber: 'E-100',
    };
    const absence = AbsenceRequest.create({
      id: requestId,
      tenantId,
      workerId,
      absenceType: 'VACATION',
      startDate: new Date('2026-06-08T00:00:00.000Z'),
      endDate: new Date('2026-06-09T00:00:00.000Z'),
      durationUnit: 'DAYS',
      durationAmount: 2,
    }, Uuid.generate());
    const { controller } = makeController({
      commandBus: {
        execute: vi.fn()
          .mockResolvedValueOnce({ success: true, data: { absenceRequestId: requestId.value } })
          .mockResolvedValueOnce(commandError('Submit transition denied')),
      },
      workerRepo: {
        findById: vi.fn().mockResolvedValue(worker),
        findByEmail: vi.fn().mockResolvedValue(worker),
        findByManager: vi.fn(),
      },
      absenceRequestRepo: {
        findById: vi.fn().mockResolvedValue(absence),
      },
    });

    await expect(controller.createEmployeeAbsence({
      type: 'VACATION',
      startDate: new Date('2026-06-08T00:00:00.000Z'),
      endDate: new Date('2026-06-09T00:00:00.000Z'),
    }, makeRequest(['EMPLOYEE']))).rejects.toBeInstanceOf(BadRequestException);
  });

  it('returns the create-command policy decision after employee leave submission', async () => {
    const worker = {
      id: workerId,
      firstName: 'Mona',
      lastName: 'Saleh',
      employeeNumber: 'E-100',
    };
    const absence = AbsenceRequest.create({
      id: requestId,
      tenantId,
      workerId,
      absenceType: 'VACATION',
      startDate: new Date('2026-06-08T00:00:00.000Z'),
      endDate: new Date('2026-06-09T00:00:00.000Z'),
      durationUnit: 'DAYS',
      durationAmount: 2,
    }, Uuid.generate());
    const { controller } = makeController({
      commandBus: {
        execute: vi.fn()
          .mockResolvedValueOnce({
            success: true,
            data: {
              absenceRequestId: requestId.value,
              approvalWorkflow: 'MANAGER_THEN_HR',
              requiredDocumentCodes: ['HANDOVER_PLAN'],
              policyDecision: {
                policyCode: 'VACATION',
                matchedRuleCodes: ['LONG_LEAVE_HR_REVIEW'],
              },
            },
          })
          .mockResolvedValueOnce({ success: true, data: { absenceRequestId: requestId.value } }),
      },
      workerRepo: {
        findById: vi.fn().mockResolvedValue(worker),
        findByEmail: vi.fn().mockResolvedValue(worker),
        findByManager: vi.fn(),
      },
      absenceRequestRepo: {
        findById: vi.fn().mockResolvedValue(absence),
      },
    });

    const result = await controller.createEmployeeAbsence({
      type: 'VACATION',
      startDate: new Date('2026-06-08T00:00:00.000Z'),
      endDate: new Date('2026-06-09T00:00:00.000Z'),
    }, makeRequest(['EMPLOYEE']));

    expect(result).toMatchObject({
      approvalWorkflow: 'MANAGER_THEN_HR',
      requiredDocumentCodes: ['HANDOVER_PLAN'],
      policyDecision: {
        policyCode: 'VACATION',
        matchedRuleCodes: ['LONG_LEAVE_HR_REVIEW'],
      },
    });
  });

  it('serializes leave date keys from UTC ISO dates', () => {
    const { controller } = makeController();
    const dto = (controller as unknown as {
      toAbsenceDto: (request: AbsenceRequest, worker?: { firstName: string; lastName: string; employeeNumber: string }) => { startDate: string; endDate: string };
    }).toAbsenceDto(AbsenceRequest.create({
      id: requestId,
      tenantId,
      workerId,
      absenceType: 'VACATION',
      startDate: new Date('2026-06-08T23:30:00.000Z'),
      endDate: new Date('2026-06-09T23:30:00.000Z'),
      durationUnit: 'DAYS',
      durationAmount: 2,
    }, Uuid.generate()));

    expect(dto.startDate).toBe('2026-06-08');
    expect(dto.endDate).toBe('2026-06-09');
  });
});

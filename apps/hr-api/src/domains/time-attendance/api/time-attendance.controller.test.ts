import { BadRequestException, ForbiddenException } from '@nestjs/common';
import type { Request, Response } from 'express';
import { describe, expect, it, vi } from 'vitest';
import { Uuid } from '@hcm/shared-kernel';
import { DEFAULT_HCM_SETUP } from '../../hcm-setup/hcm-setup.defaults.js';
import { AttendanceException } from '../aggregates/attendance-exception.aggregate.js';
import { TimeClockEvent } from '../aggregates/time-clock-event.aggregate.js';
import { AttendanceGeolocationExportService } from '../services/attendance-geolocation-export.service.js';
import { AttendanceReportingService } from '../services/attendance-reporting.service.js';
import { AttendanceSchedulingCommandCenterService } from '../services/attendance-scheduling-command-center.service.js';
import { AttendanceStateService } from '../services/attendance-state.service.js';
import { AttendanceTrustService } from '../services/attendance-trust.service.js';
import { TimeAttendanceController } from './time-attendance.controller.js';

const tenantId = new Uuid('00000000-0000-0000-0000-000000000001');
const workerId = new Uuid('11111111-1111-1111-1111-111111111111');
const eventId = new Uuid('22222222-2222-2222-2222-222222222222');
const actorId = new Uuid('33333333-3333-3333-3333-333333333333');

function requestWithRoles(roles: string[]): Request {
  return {
    tenantId: tenantId.value,
    actor: {
      actorId,
      actorType: roles.includes('EMPLOYEE') ? 'EMPLOYEE' : 'HR_ADMIN',
      roles,
      permissions: [],
      mfaAuthenticated: true,
    },
  } as unknown as Request;
}

function makeResponse(): Response {
  return {
    setHeader: vi.fn(),
    send: vi.fn((body: string) => body),
  } as unknown as Response;
}

function makeController(overrides: {
  commandBus?: { execute: ReturnType<typeof vi.fn> };
  hcmSetupService?: { getSetup: ReturnType<typeof vi.fn> };
  attendanceLedgerBuilder?: { buildDailyLedger: ReturnType<typeof vi.fn> };
  reportingService?: AttendanceReportingService;
  timeClockEventRepo?: {
    findByWorker?: ReturnType<typeof vi.fn>;
    findByWorkerForTenant?: ReturnType<typeof vi.fn>;
    findByWorkersBetween?: ReturnType<typeof vi.fn>;
    findByWorkersBetweenForTenant?: ReturnType<typeof vi.fn>;
  };
  shiftScheduleRepo?: { findByTenantScoped: ReturnType<typeof vi.fn> };
  openShiftRepo?: { findByTenantScoped: ReturnType<typeof vi.fn> };
  coverageGapRepo?: { findByTenantScoped: ReturnType<typeof vi.fn> };
  wfmOvertimeApprovalRepo?: { findByTenant: ReturnType<typeof vi.fn> };
  workerRepo?: {
    findById?: ReturnType<typeof vi.fn>;
    findByEmail?: ReturnType<typeof vi.fn>;
    findByManager?: ReturnType<typeof vi.fn>;
  };
  attendanceExceptionRepo?: { findById: ReturnType<typeof vi.fn> };
} = {}) {
  const commandBus = overrides.commandBus ?? { execute: vi.fn(async () => ({ success: true })) };
  const hcmSetupService = overrides.hcmSetupService ?? { getSetup: vi.fn(async () => DEFAULT_HCM_SETUP) };
  const timeClockEventRepo = overrides.timeClockEventRepo ?? {
    findByWorker: vi.fn(async () => []),
    findByWorkerForTenant: vi.fn(async () => []),
    findByWorkersBetween: vi.fn(async () => []),
    findByWorkersBetweenForTenant: vi.fn(async () => []),
  };
  const attendanceLedgerBuilder = overrides.attendanceLedgerBuilder ?? {
    buildDailyLedger: vi.fn(async () => ({ workDate: '2026-05-25', rows: [] })),
  };
  const shiftScheduleRepo = overrides.shiftScheduleRepo ?? { findByTenantScoped: vi.fn(async () => []) };
  const openShiftRepo = overrides.openShiftRepo ?? { findByTenantScoped: vi.fn(async () => []) };
  const coverageGapRepo = overrides.coverageGapRepo ?? { findByTenantScoped: vi.fn(async () => []) };
  const wfmOvertimeApprovalRepo = overrides.wfmOvertimeApprovalRepo ?? { findByTenant: vi.fn(async () => []) };
  const workerRepo = overrides.workerRepo ?? {
    findById: vi.fn(async () => undefined),
    findByEmail: vi.fn(async () => undefined),
    findByManager: vi.fn(async () => []),
  };
  const attendanceExceptionRepo = overrides.attendanceExceptionRepo ?? { findById: vi.fn(async () => undefined) };

  return new TimeAttendanceController(
    commandBus as never,
    hcmSetupService as never,
    {} as never,
    attendanceLedgerBuilder as never,
    workerRepo as never,
    {} as never,
    {} as never,
    timeClockEventRepo as never,
    attendanceExceptionRepo as never,
    {} as never,
    {} as never,
    {} as never,
    new AttendanceStateService(),
    new AttendanceTrustService(),
    new AttendanceGeolocationExportService(),
    {} as never,
    {} as never,
    {} as never,
    overrides.reportingService ?? new AttendanceReportingService(),
    new AttendanceSchedulingCommandCenterService(),
    shiftScheduleRepo as never,
    openShiftRepo as never,
    coverageGapRepo as never,
    wfmOvertimeApprovalRepo as never,
  );
}

describe('TimeAttendanceController geolocation evidence', () => {
  it('captures structured time-clock geolocation evidence and policy decision metadata', async () => {
    const commandBus = { execute: vi.fn(async (command) => ({ success: true, data: command.payload })) };
    const controller = makeController({ commandBus });

    await controller.recordTimeClockEvent({
      workerId: workerId.value,
      eventType: 'CLOCK_IN',
      timestamp: new Date('2026-05-25T06:30:00.000Z'),
      workplaceCode: 'CAIRO_HQ',
      latitude: 30.0444,
      longitude: 31.2357,
      accuracyMeters: 150,
      deviceId: 'browser-kiosk-1',
      captureMethod: 'WEB_KIOSK',
      captureDeviceKind: 'MAIN_LOBBY_KIOSK',
      captureReference: 'kiosk-session-007',
      verificationStatus: 'VERIFIED',
      captureEvidence: { kioskSessionId: 'kiosk-session-007' },
    }, requestWithRoles(['HR_ADMIN']));

    const command = commandBus.execute.mock.calls[0]?.[0];
    expect(command).toBeDefined();
    expect(command.payload).toMatchObject({
      eventType: 'CLOCK_IN',
      timestamp: new Date('2026-05-25T06:30:00.000Z'),
      latitude: 30.0444,
      longitude: 31.2357,
      accuracyMeters: 150,
      workplaceCode: 'CAIRO_HQ',
      distanceMeters: 0,
      geofenceRadiusMeters: 250,
      geofenceProfileCode: 'CAIRO_HQ_STRICT',
      locationStatus: 'INSIDE_GEOFENCE',
      deviceId: 'browser-kiosk-1',
      deviceTrustLevel: 'STANDARD',
      trustLevel: 'MEDIUM',
      trustScore: 75,
      trustRequiresApproval: false,
      trustReasons: ['LOW_ACCURACY'],
      captureMethod: 'WEB_KIOSK',
      captureDeviceKind: 'MAIN_LOBBY_KIOSK',
      captureReference: 'kiosk-session-007',
      verificationStatus: 'VERIFIED',
    });
    expect(command.payload.workerId.value).toBe(workerId.value);
    expect(command.payload.captureEvidence).toMatchObject({
      kioskSessionId: 'kiosk-session-007',
      geolocation: {
        workplaceCode: 'CAIRO_HQ',
        locationStatus: 'INSIDE_GEOFENCE',
        accuracyMeters: 150,
      },
      trust: {
        trustLevel: 'MEDIUM',
        trustScore: 75,
        requiresApproval: false,
      },
    });

    const location = JSON.parse(command.payload.location);
    expect(location).toMatchObject({
      latitude: 30.0444,
      longitude: 31.2357,
      accuracyMeters: 150,
      workplaceCode: 'CAIRO_HQ',
      locationStatus: 'INSIDE_GEOFENCE',
      trustReasons: ['LOW_ACCURACY'],
    });
  });

  it('rejects missing geolocation when the active workplace policy requires it', async () => {
    const commandBus = { execute: vi.fn(async () => ({ success: true })) };
    const controller = makeController({ commandBus });
    const dto = {
      workerId: workerId.value,
      eventType: 'CLOCK_IN' as const,
      timestamp: new Date('2026-05-25T06:30:00.000Z'),
      workplaceCode: 'CAIRO_HQ',
      deviceId: 'browser-kiosk-1',
    };

    await expect(controller.recordTimeClockEvent(dto, requestWithRoles(['HR_ADMIN']))).rejects.toBeInstanceOf(BadRequestException);
    await expect(controller.recordTimeClockEvent(dto, requestWithRoles(['HR_ADMIN']))).rejects.toThrow(
      'Geolocation is required by the active attendance policy for this workplace',
    );
    expect(commandBus.execute).not.toHaveBeenCalled();
  });

  it('uses client idempotency evidence for employee check-in commands', async () => {
    const commandBus = { execute: vi.fn(async (command) => ({ success: true, data: command.payload })) };
    const controller = makeController({ commandBus });
    const idempotencyKey = 'clock-in-11111111-20260525T063000';
    const dto = {
      workerId: workerId.value,
      timestamp: new Date('2026-05-25T06:30:00.000Z'),
      workplaceCode: 'CAIRO_HQ',
      latitude: 30.0444,
      longitude: 31.2357,
      accuracyMeters: 25,
      deviceId: 'browser',
      idempotencyKey,
    } as Parameters<TimeAttendanceController['checkIn']>[0] & { idempotencyKey: string };

    await controller.checkIn(dto, requestWithRoles(['HR_ADMIN']));

    const command = commandBus.execute.mock.calls[0]?.[0];
    expect(command).toBeDefined();
    expect(command.idempotencyKey).toBe(idempotencyKey);
    expect(command.payload.captureReference).toBe(idempotencyKey);
    expect(command.payload.captureEvidence).toMatchObject({
      idempotency: {
        key: idempotencyKey,
        source: 'BODY',
      },
    });
  });

  it('uses header idempotency evidence for employee check-out commands', async () => {
    const commandBus = { execute: vi.fn(async (command) => ({ success: true, data: command.payload })) };
    const idempotencyKey = 'clock-out-11111111-20260525T153000';
    const previousCheckIn = new TimeClockEvent({
      id: Uuid.generate(),
      tenantId,
      workerId,
      eventType: 'CLOCK_IN',
      timestamp: new Date('2026-05-25T06:30:00.000Z'),
      location: JSON.stringify({ workplaceCode: 'CAIRO_HQ', locationStatus: 'INSIDE_GEOFENCE' }),
      deviceId: 'browser',
      status: 'VALIDATED',
    });
    const timeClockEventRepo = {
      findByWorker: vi.fn(async () => [previousCheckIn]),
      findByWorkerForTenant: vi.fn(async () => [previousCheckIn]),
      findByWorkersBetween: vi.fn(async () => []),
      findByWorkersBetweenForTenant: vi.fn(async () => []),
    };
    const controller = makeController({ commandBus, timeClockEventRepo });
    const req = {
      ...requestWithRoles(['HR_ADMIN']),
      headers: { 'x-idempotency-key': idempotencyKey },
    } as unknown as Request;
    const dto = {
      workerId: workerId.value,
      timestamp: new Date('2026-05-25T15:30:00.000Z'),
      workplaceCode: 'CAIRO_HQ',
      latitude: 30.0444,
      longitude: 31.2357,
      accuracyMeters: 25,
      deviceId: 'browser',
    };

    await controller.checkOut(dto, req);

    const command = commandBus.execute.mock.calls[0]?.[0];
    expect(command).toBeDefined();
    expect(command.idempotencyKey).toBe(idempotencyKey);
    expect(command.payload.captureReference).toBe(idempotencyKey);
    expect(command.payload.captureEvidence).toMatchObject({
      idempotency: {
        key: idempotencyKey,
        source: 'HEADER',
      },
    });
  });

  it('forbids non-privileged users from exporting geolocation evidence', async () => {
    const attendanceLedgerBuilder = { buildDailyLedger: vi.fn() };
    const timeClockEventRepo = { findByWorkersBetweenForTenant: vi.fn() };
    const controller = makeController({ attendanceLedgerBuilder, timeClockEventRepo });

    await expect(controller.exportGeolocationEvidenceCsv(
      '2026-05-25',
      undefined,
      requestWithRoles(['EMPLOYEE']),
      makeResponse(),
    )).rejects.toBeInstanceOf(ForbiddenException);

    expect(attendanceLedgerBuilder.buildDailyLedger).not.toHaveBeenCalled();
    expect(timeClockEventRepo.findByWorkersBetweenForTenant).not.toHaveBeenCalled();
  });

  it('allows HR administrators to export geolocation evidence with privacy headers', async () => {
    const event = new TimeClockEvent({
      id: eventId,
      tenantId,
      workerId,
      eventType: 'CLOCK_IN',
      timestamp: new Date('2026-05-25T06:30:00.000Z'),
      location: JSON.stringify({
        latitude: 30.0444,
        longitude: 31.2357,
        accuracyMeters: 12,
        workplaceCode: 'CAIRO_HQ',
        locationStatus: 'INSIDE_GEOFENCE',
        trustReasons: ['OK'],
      }),
      deviceId: 'browser-kiosk-1',
      status: 'VALIDATED',
    });
    const attendanceLedgerBuilder = {
      buildDailyLedger: vi.fn(async () => ({
        workDate: '2026-05-25',
        rows: [
          {
            worker: {
              workerId: workerId.value,
              employeeId: 'EMP-007',
              name: 'Ahmed Ashour',
              email: 'ahmed@example.com',
              departmentName: 'Engineering',
              workLocationCode: 'CAIRO_HQ',
            },
          },
        ],
      })),
    };
    const timeClockEventRepo = { findByWorkersBetweenForTenant: vi.fn(async () => [event]) };
    const controller = makeController({ attendanceLedgerBuilder, timeClockEventRepo });
    const response = makeResponse();

    await controller.exportGeolocationEvidenceCsv('2026-05-25', 'CAIRO_HQ', requestWithRoles(['HR_ADMIN']), response);

    expect(attendanceLedgerBuilder.buildDailyLedger).toHaveBeenCalledWith(tenantId, { date: '2026-05-25', workplaceCode: 'CAIRO_HQ' });
    expect(timeClockEventRepo.findByWorkersBetweenForTenant).toHaveBeenCalledWith(
      tenantId,
      [workerId],
      new Date('2026-05-24T21:00:00.000Z'),
      new Date('2026-05-25T21:00:00.000Z'),
    );
    expect(response.setHeader).toHaveBeenCalledWith('X-Data-Classification', 'CONFIDENTIAL');
    expect(response.setHeader).toHaveBeenCalledWith('X-Visibility-Scope', 'HR_PAYROLL_ADMIN_ONLY');
    expect(response.send).toHaveBeenCalledWith(expect.stringContaining('"EMP-007","Ahmed Ashour","ahmed@example.com"'));
    expect(response.send).toHaveBeenCalledWith(expect.stringContaining('"30.0444","31.2357","12"'));
  });

  it('uses workplace-scoped workforce repositories for the scheduling command center', async () => {
    const attendanceLedgerBuilder = {
      buildDailyLedger: vi.fn(async () => ({
        workDate: '2026-05-25',
        rows: [],
        exceptionQueue: [],
      })),
    };
    const shiftScheduleRepo = { findByTenantScoped: vi.fn(async () => []) };
    const openShiftRepo = { findByTenantScoped: vi.fn(async () => []) };
    const coverageGapRepo = { findByTenantScoped: vi.fn(async () => []) };
    const wfmOvertimeApprovalRepo = { findByTenant: vi.fn(async () => []) };
    const controller = makeController({
      attendanceLedgerBuilder,
      shiftScheduleRepo,
      openShiftRepo,
      coverageGapRepo,
      wfmOvertimeApprovalRepo,
    });

    const result = await controller.getSchedulingCommandCenter('2026-05-25', 'CAIRO_HQ', requestWithRoles(['HR_ADMIN']));

    expect(attendanceLedgerBuilder.buildDailyLedger).toHaveBeenCalledWith(tenantId, { date: '2026-05-25', workplaceCode: 'CAIRO_HQ' });
    expect(shiftScheduleRepo.findByTenantScoped).toHaveBeenCalledWith(tenantId, 'CAIRO_HQ');
    expect(openShiftRepo.findByTenantScoped).toHaveBeenCalledWith(tenantId, 'CAIRO_HQ');
    expect(coverageGapRepo.findByTenantScoped).toHaveBeenCalledWith(tenantId, 'CAIRO_HQ');
    expect(result.workplaceCode).toBe('CAIRO_HQ');
  });

  it('builds a scoped attendance period view from daily policy-aware ledgers', async () => {
    const attendanceLedgerBuilder = {
      buildDailyLedger: vi.fn(async (_tenant: Uuid, filters?: { date?: string }) => ({
        workDate: filters?.date ?? '2026-05-26',
        rows: [],
        summary: {
          absent: 0,
          exceptions: 0,
          geofenceViolations: 0,
          inProgress: 0,
          late: 0,
          missingCheckout: 0,
          onLeave: 0,
          payrollReady: 0,
          present: 0,
          totalEmployees: 0,
          undertime: 0,
        },
        exceptionQueue: [],
      })),
    };
    const controller = makeController({ attendanceLedgerBuilder });

    const result = await controller.getAttendancePeriodView(
      'WEEKLY',
      'TENANT',
      '2026-05-26',
      undefined,
      undefined,
      'CAIRO_HQ',
      requestWithRoles(['HR_ADMIN']),
    );

    expect(result).toMatchObject({
      periodStart: '2026-05-20',
      periodEnd: '2026-05-26',
      range: 'WEEKLY',
      scope: 'TENANT',
    });
    expect(result.series).toHaveLength(7);
    expect(attendanceLedgerBuilder.buildDailyLedger).toHaveBeenCalledTimes(7);
    expect(attendanceLedgerBuilder.buildDailyLedger).toHaveBeenCalledWith(
      tenantId,
      expect.objectContaining({ date: '2026-05-26', workplaceCode: 'CAIRO_HQ' }),
    );
  });
});

describe('TimeAttendanceController attendance exception command RBAC', () => {
  const exceptionId = new Uuid('55555555-5555-5555-5555-555555555555');
  const otherManagerId = new Uuid('66666666-6666-6666-6666-666666666666');

  function makeException(): AttendanceException {
    return new AttendanceException({
      id: exceptionId,
      tenantId,
      workerId,
      exceptionType: 'MISSING_CHECKOUT',
      description: 'Missing checkout on 2026-05-25',
      detectedAt: new Date('2026-05-25T08:00:00.000Z'),
      status: 'OPEN',
      aggregateVersion: 0,
    });
  }

  function workerRepoWithManager(managerId: Uuid) {
    const targetWorker = { id: workerId, managerId } as unknown as { id: Uuid; managerId: Uuid };
    return {
      findById: vi.fn(async (id: Uuid) => (id.value === workerId.value ? targetWorker : undefined)),
      findByEmail: vi.fn(async () => undefined),
      findByManager: vi.fn(async () => []),
    };
  }

  const handlers: Array<{
    label: string;
    invoke: (controller: TimeAttendanceController, req: Request) => Promise<unknown>;
    commandName: string;
  }> = [
    {
      label: 'review',
      invoke: (controller, req) => controller.reviewAttendanceException(exceptionId.value, req),
      commandName: 'ReviewAttendanceException',
    },
    {
      label: 'resolve',
      invoke: (controller, req) => controller.resolveAttendanceException(exceptionId.value, req),
      commandName: 'ResolveAttendanceException',
    },
    {
      label: 'escalate',
      invoke: (controller, req) => controller.escalateAttendanceException(exceptionId.value, req),
      commandName: 'EscalateAttendanceException',
    },
  ];

  it.each(handlers)('allows an HR/admin-scoped actor to $label any tenant worker\'s attendance exception', async ({ invoke, commandName }) => {
    const commandBus = { execute: vi.fn(async (command) => ({ success: true, data: command.payload })) };
    const attendanceExceptionRepo = { findById: vi.fn(async () => makeException()) };
    const controller = makeController({ commandBus, attendanceExceptionRepo });

    await invoke(controller, requestWithRoles(['HR_ADMIN']));

    expect(commandBus.execute).toHaveBeenCalledTimes(1);
    expect(commandBus.execute.mock.calls[0]?.[0]?.commandName).toBe(commandName);
  });

  it.each(handlers)('allows a manager to $label their direct report\'s attendance exception', async ({ invoke }) => {
    const commandBus = { execute: vi.fn(async () => ({ success: true })) };
    const attendanceExceptionRepo = { findById: vi.fn(async () => makeException()) };
    const workerRepo = workerRepoWithManager(actorId);
    const controller = makeController({ commandBus, attendanceExceptionRepo, workerRepo });

    await invoke(controller, requestWithRoles(['MANAGER']));

    expect(commandBus.execute).toHaveBeenCalledTimes(1);
  });

  it.each(handlers)('rejects a manager who is not that worker\'s manager from $label', async ({ invoke }) => {
    const commandBus = { execute: vi.fn(async () => ({ success: true })) };
    const attendanceExceptionRepo = { findById: vi.fn(async () => makeException()) };
    const workerRepo = workerRepoWithManager(otherManagerId);
    const controller = makeController({ commandBus, attendanceExceptionRepo, workerRepo });

    await expect(invoke(controller, requestWithRoles(['MANAGER']))).rejects.toBeInstanceOf(ForbiddenException);
    expect(commandBus.execute).not.toHaveBeenCalled();
  });

  it.each(handlers)('rejects a non-manager, non-admin actor from $label', async ({ invoke }) => {
    const commandBus = { execute: vi.fn(async () => ({ success: true })) };
    const attendanceExceptionRepo = { findById: vi.fn(async () => makeException()) };
    const controller = makeController({ commandBus, attendanceExceptionRepo });

    await expect(invoke(controller, requestWithRoles(['EMPLOYEE']))).rejects.toBeInstanceOf(ForbiddenException);
    expect(commandBus.execute).not.toHaveBeenCalled();
  });
});

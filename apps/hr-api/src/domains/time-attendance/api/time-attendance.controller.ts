import { Controller, Get, Post, Body, Param, Query, Req, Res, BadRequestException, ForbiddenException, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { randomUUID } from 'crypto';
import { CommandBus } from '../../../platform/command-bus/command-bus.js';
import { Uuid } from '@hcm/shared-kernel';
import { computeRequestHash } from '@hcm/platform-core';
import type { HrCommandEnvelope } from '@hcm/command-contracts';
import { AuthGuard } from '../../../guards/auth.guard.js';
import { HcmSetupService } from '../../hcm-setup/hcm-setup.service.js';
import { WorkerRepository } from '../../hr-core/repositories/worker.repository.js';
import { WorkScheduleRepository } from '../repositories/work-schedule.repository.js';
import { TimesheetRepository } from '../repositories/timesheet.repository.js';
import { TimeClockEventRepository } from '../repositories/time-clock-event.repository.js';
import { AttendanceExceptionRepository } from '../repositories/attendance-exception.repository.js';
import { AttendanceDailyLedgerRepository } from '../repositories/attendance-daily-ledger.repository.js';
import { AttendanceCorrectionRequestRepository } from '../repositories/attendance-correction-request.repository.js';
import { OvertimeApprovalRepository } from '../repositories/overtime-approval.repository.js';
import { AttendanceCalculationService, type AttendanceSession } from '../services/attendance-calculation.service.js';
import { AttendanceStateService } from '../services/attendance-state.service.js';
import { AttendanceLedgerBuilderService } from '../services/attendance-ledger-builder.service.js';
import { AttendanceTrustService } from '../services/attendance-trust.service.js';
import { AttendanceGeolocationExportService } from '../services/attendance-geolocation-export.service.js';
import { AttendanceCloseReadinessService, type AttendanceCloseEmployee } from '../services/attendance-close-readiness.service.js';
import { AttendanceTimesheetProjectionService } from '../services/attendance-timesheet-projection.service.js';
import { AttendanceReminderService } from '../services/attendance-reminder.service.js';
import { AttendanceReportingService } from '../services/attendance-reporting.service.js';
import { AttendanceSchedulingCommandCenterService } from '../services/attendance-scheduling-command-center.service.js';
import { ShiftScheduleRepository } from '../../workforce-management/repositories/shift-schedule.repository.js';
import { OpenShiftRepository } from '../../workforce-management/repositories/open-shift.repository.js';
import { CoverageGapRepository } from '../../workforce-management/repositories/coverage-gap.repository.js';
import { WfmOvertimeApprovalRepository } from '../../workforce-management/repositories/overtime-approval.repository.js';
import type { AttendanceCorrectionStatus } from '../services/attendance-correction.service.js';
import type * as dtos from './dtos.js';
import {
  CheckInOutDtoSchema,
  CreateWorkScheduleDtoSchema, CreateTimesheetDtoSchema, RecordTimeClockEventDtoSchema,
  CreateTimesheetFromLedgerDtoSchema,
  CreateAttendanceExceptionDtoSchema, OnDutyRequestDtoSchema, RequestOvertimeDtoSchema, ZodValidationPipe,
  FinalizeDailyLedgerDtoSchema, CreateAttendanceCorrectionRequestDtoSchema, ReviewAttendanceCorrectionRequestDtoSchema,
  AttendancePeriodCloseQueryDtoSchema, FinalizeAttendancePeriodDtoSchema,
} from './dtos.js';

type ClockLocationPayload = {
  latitude?: number;
  longitude?: number;
  accuracyMeters?: number;
  workplaceCode?: string;
  distanceMeters?: number;
  geofenceRadiusMeters?: number;
  geofenceProfileCode?: string;
  locationStatus?: string;
  deviceTrustLevel?: string;
  trustLevel?: string;
  trustScore?: number;
  trustRequiresApproval?: boolean;
  trustReasons?: string[];
};

type ClockIdempotencyEvidence = {
  key: string;
  source: 'BODY' | 'HEADER';
};

type AttendancePeriodViewRange = 'DAILY' | 'MONTHLY' | 'NINETY_DAYS' | 'WEEKLY';
type AttendancePeriodViewScope = 'SELF' | 'TEAM' | 'TENANT';

function nonBlank(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function requestHeader(req: Request, headerName: string): string | undefined {
  const getHeader = typeof req.get === 'function' ? req.get.bind(req) : undefined;
  const fromGetter = nonBlank(getHeader?.(headerName));
  if (fromGetter) return fromGetter;

  const rawValue = req.headers?.[headerName.toLowerCase()];
  const value = Array.isArray(rawValue) ? rawValue[0] : rawValue;
  return typeof value === 'string' ? nonBlank(value) : undefined;
}

function parseClockLocation(value?: string): ClockLocationPayload {
  if (!value) return {};
  try {
    return JSON.parse(value) as ClockLocationPayload;
  } catch {
    return {};
  }
}

function dateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function enumerateDateKeys(periodStart: string, periodEnd: string): string[] {
  const start = new Date(`${periodStart}T00:00:00.000Z`);
  const end = new Date(`${periodEnd}T00:00:00.000Z`);
  const days: string[] = [];
  for (let cursor = start; cursor.getTime() <= end.getTime(); cursor = new Date(cursor.getTime() + 24 * 60 * 60 * 1000)) {
    days.push(dateKey(cursor));
  }
  return days;
}

function dateOnlyUtc(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function addUtcDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function monthStartUtc(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

function csvCell(value: string | number | boolean | null | undefined): string {
  const text = value === null || value === undefined ? '' : String(value);
  if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

function inferCaptureMethod(dto: {
  captureMethod?: dtos.CheckInOutDto['captureMethod'];
  deviceId?: string;
  latitude?: number;
  longitude?: number;
}): NonNullable<dtos.CheckInOutDto['captureMethod']> {
  if (dto.captureMethod) return dto.captureMethod;
  const deviceId = dto.deviceId?.toLowerCase() ?? '';
  if (deviceId.includes('kiosk')) return 'WEB_KIOSK';
  if (deviceId.includes('rfid') || deviceId.includes('badge')) return 'RFID_CARD';
  if (deviceId.includes('bio')) return 'BIOMETRIC_DEVICE';
  if (deviceId.includes('face')) return 'FACIAL_RECOGNITION';
  if (deviceId.includes('qr')) return 'QR_CODE';
  if (dto.latitude !== undefined && dto.longitude !== undefined) return 'MOBILE_GEOFENCE';
  if (deviceId.includes('correction')) return 'MANUAL_CORRECTION';
  return 'API_IMPORT';
}

@ApiTags('Time & Attendance')
@UseGuards(AuthGuard)
@Controller('time/attendance')
export class TimeAttendanceController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly hcmSetupService: HcmSetupService,
    private readonly attendanceCalculation: AttendanceCalculationService,
    private readonly attendanceLedgerBuilder: AttendanceLedgerBuilderService,
    private readonly workerRepo: WorkerRepository,
    private readonly workScheduleRepo: WorkScheduleRepository,
    private readonly timesheetRepo: TimesheetRepository,
    private readonly timeClockEventRepo: TimeClockEventRepository,
    private readonly attendanceExceptionRepo: AttendanceExceptionRepository,
    private readonly attendanceDailyLedgerRepo: AttendanceDailyLedgerRepository,
    private readonly attendanceCorrectionRepo: AttendanceCorrectionRequestRepository,
    private readonly overtimeApprovalRepo: OvertimeApprovalRepository,
    private readonly attendanceState: AttendanceStateService,
    private readonly attendanceTrust: AttendanceTrustService,
    private readonly geolocationExport: AttendanceGeolocationExportService,
    private readonly closeReadiness: AttendanceCloseReadinessService,
    private readonly timesheetProjection: AttendanceTimesheetProjectionService,
    private readonly reminderService: AttendanceReminderService,
    private readonly reportingService: AttendanceReportingService,
    private readonly schedulingCommandCenter: AttendanceSchedulingCommandCenterService,
    private readonly shiftScheduleRepo: ShiftScheduleRepository,
    private readonly openShiftRepo: OpenShiftRepository,
    private readonly coverageGapRepo: CoverageGapRepository,
    private readonly wfmOvertimeApprovalRepo: WfmOvertimeApprovalRepository,
  ) {}

  private buildCommand<TPayload>(
    commandName: string,
    aggregateType: string,
    payload: TPayload,
    req: Request,
    options?: {
      aggregateId?: Uuid;
      expectedState?: string;
      expectedVersion?: number;
      subjectWorkerId?: Uuid;
      idempotencyKey?: string;
    },
  ): HrCommandEnvelope<TPayload> {
    const tenantId = new Uuid((req['tenantId'] as string | undefined) ?? '00000000-0000-0000-0000-000000000001');
    if (!req.actor) throw new ForbiddenException('Authenticated actor is required');
    return {
      commandId: Uuid.generate(),
      commandName,
      commandSchemaVersion: 1,
      tenantId,
      actor: req.actor,
      aggregateType,
      aggregateId: options?.aggregateId,
      expectedState: options?.expectedState,
      expectedVersion: options?.expectedVersion,
      subjectWorkerId: options?.subjectWorkerId,
      idempotencyKey: options?.idempotencyKey ?? randomUUID(),
      correlationId: Uuid.generate(),
      reason: 'API request',
      payload,
      metadata: { requestHash: computeRequestHash(payload), clientType: 'HR_ADMIN' },
    };
  }

  private clockIdempotency(dto: dtos.CheckInOutDto, req: Request): ClockIdempotencyEvidence | undefined {
    const bodyKey = nonBlank(dto.idempotencyKey) ?? nonBlank(dto.clientRequestId);
    if (bodyKey) return { key: bodyKey, source: 'BODY' };

    const headerKey = requestHeader(req, 'x-idempotency-key') ?? requestHeader(req, 'idempotency-key');
    return headerKey ? { key: headerKey, source: 'HEADER' } : undefined;
  }

  private getTenantId(req: Request): Uuid {
    return new Uuid((req['tenantId'] as string | undefined) ?? '00000000-0000-0000-0000-000000000001');
  }

  private getActorId(req: Request): string {
    const actorId = req.actor?.actorId;
    if (actorId instanceof Uuid) return actorId.value;
    const actorIdLike = actorId as { value?: unknown } | undefined;
    if (typeof actorIdLike?.value === 'string') return actorIdLike.value;
    throw new ForbiddenException('Authenticated actor is required');
  }

  private getActorEmail(req: Request): string | undefined {
    return (req.actor as { email?: string } | undefined)?.email;
  }

  private hasAnyRole(req: Request, roles: string[]): boolean {
    return (req.actor?.roles ?? []).some((role) => roles.includes(role));
  }

  private hasAttendanceAdminScope(req: Request): boolean {
    return this.hasAnyRole(req, ['HR_ADMIN', 'HRBP', 'PAYROLL_ADMIN', 'SUPER_ADMIN']);
  }

  private hasManagerScope(req: Request): boolean {
    return this.hasAnyRole(req, ['MANAGER']);
  }

  private async resolveSelfWorkerId(req: Request): Promise<string | undefined> {
    const actorId = this.getActorId(req);
    try {
      const worker = await this.workerRepo.findById(new Uuid(actorId));
      if (worker) return worker.id.value;
    } catch {
      // Actor IDs from identity providers may be user IDs rather than worker IDs.
    }

    const email = this.getActorEmail(req);
    if (!email) return undefined;
    const worker = await this.workerRepo.findByEmail(email);
    return worker?.id.value;
  }

  private async assertCanAccessWorker(req: Request, workerId: string, options?: { managerAllowed?: boolean }): Promise<void> {
    if (this.hasAttendanceAdminScope(req)) return;
    const actorId = this.getActorId(req);
    const selfWorkerId = await this.resolveSelfWorkerId(req);
    if (selfWorkerId === workerId || actorId === workerId) return;

    if (options?.managerAllowed && this.hasManagerScope(req)) {
      const worker = await this.workerRepo.findById(new Uuid(workerId));
      if (worker?.managerId?.value === actorId || worker?.managerId?.value === selfWorkerId) return;
    }

    throw new ForbiddenException('Attendance access is limited to self, managed team, or authorized HR/payroll roles');
  }

  private async scopedLedgerFilters(
    req: Request,
    filters: { date?: string; managerId?: string; department?: string; workplaceCode?: string; workerId?: string },
  ) {
    if (this.hasAttendanceAdminScope(req)) return filters;
    if (this.hasManagerScope(req)) {
      const managerWorkerId = await this.resolveSelfWorkerId(req);
      return { ...filters, managerId: managerWorkerId ?? this.getActorId(req), workerId: undefined };
    }
    const selfWorkerId = await this.resolveSelfWorkerId(req);
    if (!selfWorkerId) throw new ForbiddenException('No employee profile is linked to the authenticated user');
    return { ...filters, workerId: selfWorkerId, managerId: undefined, department: undefined, workplaceCode: undefined };
  }

  private dayUtcRange(workDate: string, timezoneOffsetMinutes: number): { startAt: Date; endAt: Date } {
    const startAt = new Date(new Date(`${workDate}T00:00:00.000Z`).getTime() - timezoneOffsetMinutes * 60000);
    const endAt = new Date(startAt.getTime() + 24 * 60 * 60 * 1000);
    return { startAt, endAt };
  }

  private async buildClockLocation(dto: dtos.CheckInOutDto, req: Request): Promise<ClockLocationPayload> {
    const setup = await this.hcmSetupService.getSetup(this.getTenantId(req));
    const profile = setup.attendancePolicy.geofenceProfiles?.find((item) => item.active && item.locationCode === dto.workplaceCode);
    const trust = this.attendanceTrust.evaluateClockEvidence({
      policy: setup.attendancePolicy,
      locations: setup.locations,
      workplaceCode: dto.workplaceCode,
      latitude: dto.latitude,
      longitude: dto.longitude,
      accuracyMeters: dto.accuracyMeters,
      deviceId: dto.deviceId,
    });

    const requiresGeolocation = Boolean(setup.attendancePolicy.geofenceEnabled && profile?.requireGeolocation);
    if (requiresGeolocation && (dto.latitude === undefined || dto.longitude === undefined)) {
      throw new BadRequestException('Geolocation is required by the active attendance policy for this workplace');
    }
    if (profile?.blockOutsideGeofence && trust.locationStatus === 'OUTSIDE_GEOFENCE') {
      throw new BadRequestException('Clock event is outside the allowed workplace geofence');
    }

    return {
      latitude: dto.latitude,
      longitude: dto.longitude,
      accuracyMeters: dto.accuracyMeters,
      workplaceCode: dto.workplaceCode,
      distanceMeters: trust.distanceMeters,
      geofenceRadiusMeters: trust.geofenceRadiusMeters,
      geofenceProfileCode: trust.geofenceProfileCode,
      locationStatus: trust.locationStatus,
      deviceTrustLevel: trust.deviceTrustLevel,
      trustLevel: trust.trustLevel,
      trustScore: trust.trustScore,
      trustRequiresApproval: trust.requiresApproval,
      trustReasons: trust.reasons,
    } satisfies ClockLocationPayload;
  }

  private async recordClockEvent(
    dto: dtos.CheckInOutDto,
    eventType: 'CLOCK_IN' | 'CLOCK_OUT',
    req: Request,
  ) {
    await this.assertCanAccessWorker(req, dto.workerId, { managerAllowed: false });
    const state = await this.buildTodayState(dto.workerId, req, dto.timestamp);
    const transition = this.attendanceState.validateNextEvent(state, eventType);
    if (!transition.allowed) throw new BadRequestException(transition.reason);

    const locationEvidence = await this.buildClockLocation(dto, req);
    const captureMethod = inferCaptureMethod(dto);
    const idempotency = this.clockIdempotency(dto, req);
    const captureReference = dto.captureReference ?? idempotency?.key ?? dto.deviceId;
    const payload = {
      workerId: new Uuid(dto.workerId),
      eventType,
      timestamp: dto.timestamp ?? new Date(),
      location: JSON.stringify(locationEvidence),
      latitude: locationEvidence.latitude,
      longitude: locationEvidence.longitude,
      accuracyMeters: locationEvidence.accuracyMeters,
      workplaceCode: locationEvidence.workplaceCode,
      distanceMeters: locationEvidence.distanceMeters,
      geofenceRadiusMeters: locationEvidence.geofenceRadiusMeters,
      geofenceProfileCode: locationEvidence.geofenceProfileCode,
      locationStatus: locationEvidence.locationStatus,
      deviceTrustLevel: locationEvidence.deviceTrustLevel,
      trustLevel: locationEvidence.trustLevel,
      trustScore: locationEvidence.trustScore,
      trustRequiresApproval: locationEvidence.trustRequiresApproval,
      trustReasons: locationEvidence.trustReasons,
      deviceId: dto.deviceId,
      captureMethod,
      captureDeviceKind: dto.captureDeviceKind ?? (captureMethod === 'MOBILE_GEOFENCE' ? 'MOBILE_BROWSER' : undefined),
      captureReference,
      verificationStatus: dto.verificationStatus ?? (locationEvidence.trustRequiresApproval ? 'PENDING' : 'VERIFIED'),
      captureEvidence: {
        ...(dto.captureEvidence ?? {}),
        ...(idempotency ? { idempotency } : {}),
        geolocation: {
          workplaceCode: locationEvidence.workplaceCode,
          locationStatus: locationEvidence.locationStatus,
          distanceMeters: locationEvidence.distanceMeters,
          accuracyMeters: locationEvidence.accuracyMeters,
        },
        trust: {
          trustLevel: locationEvidence.trustLevel,
          trustScore: locationEvidence.trustScore,
          requiresApproval: locationEvidence.trustRequiresApproval,
          reasons: locationEvidence.trustReasons ?? [],
        },
      },
    };
    return this.commandBus.execute(this.buildCommand('RecordTimeClockEvent', 'TimeClockEvent', payload, req, {
      subjectWorkerId: new Uuid(dto.workerId),
      idempotencyKey: idempotency?.key,
    }));
  }

  private async buildTodayState(workerId: string, req: Request, now = new Date()) {
    const setup = await this.hcmSetupService.getSetup(this.getTenantId(req));
    const events = await this.timeClockEventRepo.findByWorkerForTenant(this.getTenantId(req), new Uuid(workerId));
    return this.attendanceState.buildTodayState({
      workerId,
      events,
      policy: setup.attendancePolicy,
      now,
    });
  }

  private toSessions(events: Array<{ eventType: string; timestamp: Date; location?: string }>): AttendanceSession[] {
    const sorted = [...events].sort((left, right) => left.timestamp.getTime() - right.timestamp.getTime());
    const sessions: AttendanceSession[] = [];
    let checkIn: { timestamp: Date; location?: string } | undefined;

    for (const event of sorted) {
      if (event.eventType === 'CLOCK_IN') {
        checkIn = { timestamp: event.timestamp, location: event.location };
      } else if (event.eventType === 'CLOCK_OUT' && checkIn) {
        const location = parseClockLocation(checkIn.location);
        sessions.push({
          checkInAt: checkIn.timestamp,
          checkOutAt: event.timestamp,
          distanceMeters: location.distanceMeters,
          trustScore: location.trustScore,
        });
        checkIn = undefined;
      }
    }

    return sessions;
  }

  private resolveClosePeriod(input: {
    year?: number;
    month?: number;
    periodStart?: string;
    periodEnd?: string;
  }): { periodStart: string; periodEnd: string; year: number; month: number } {
    const now = new Date();
    const year = input.year ?? now.getUTCFullYear();
    const month = input.month ?? now.getUTCMonth() + 1;
    const periodStart = input.periodStart ?? `${year}-${String(month).padStart(2, '0')}-01`;
    const periodEnd = input.periodEnd ?? new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);
    if (new Date(`${periodStart}T00:00:00.000Z`).getTime() > new Date(`${periodEnd}T00:00:00.000Z`).getTime()) {
      throw new BadRequestException('periodStart must be before or equal to periodEnd');
    }
    return { periodStart, periodEnd, year, month };
  }

  private resolveAttendanceViewPeriod(rangeValue?: string, dateValue?: string): {
    periodStart: string;
    periodEnd: string;
    range: AttendancePeriodViewRange;
  } {
    const range = (rangeValue ?? 'WEEKLY').toUpperCase() as AttendancePeriodViewRange;
    if (!['DAILY', 'WEEKLY', 'MONTHLY', 'NINETY_DAYS'].includes(range)) {
      throw new BadRequestException('range must be DAILY, WEEKLY, MONTHLY, or NINETY_DAYS');
    }

    const anchor = dateValue ? new Date(`${dateValue}T00:00:00.000Z`) : new Date();
    if (Number.isNaN(anchor.getTime())) throw new BadRequestException('date must be a valid YYYY-MM-DD value');
    const periodEnd = dateOnlyUtc(anchor);
    const periodStart = range === 'DAILY'
      ? periodEnd
      : range === 'WEEKLY'
        ? dateOnlyUtc(addUtcDays(anchor, -6))
        : range === 'MONTHLY'
          ? dateOnlyUtc(monthStartUtc(anchor))
          : dateOnlyUtc(addUtcDays(anchor, -89));
    return { periodStart, periodEnd, range };
  }

  private resolveAttendanceViewScope(scopeValue?: string): AttendancePeriodViewScope {
    const scope = (scopeValue ?? 'SELF').toUpperCase() as AttendancePeriodViewScope;
    if (!['SELF', 'TEAM', 'TENANT'].includes(scope)) {
      throw new BadRequestException('scope must be SELF, TEAM, or TENANT');
    }
    return scope;
  }

  private async scopedAttendanceViewFilters(
    req: Request,
    scope: AttendancePeriodViewScope,
    date: string,
    filters: { managerId?: string; workerId?: string; workplaceCode?: string },
  ) {
    if (scope === 'TENANT') {
      if (!this.hasAttendanceAdminScope(req)) throw new ForbiddenException('Only HR or payroll administrators can view tenant attendance');
      return { date, workplaceCode: filters.workplaceCode };
    }

    if (scope === 'TEAM') {
      if (!this.hasAttendanceAdminScope(req) && !this.hasManagerScope(req)) {
        throw new ForbiddenException('Only managers, HR, or payroll administrators can view team attendance');
      }
      return this.scopedLedgerFilters(req, { date, managerId: filters.managerId, workplaceCode: filters.workplaceCode });
    }

    const workerId = filters.workerId ?? await this.resolveSelfWorkerId(req);
    if (!workerId) throw new ForbiddenException('No employee profile is linked to the authenticated user');
    await this.assertCanAccessWorker(req, workerId, { managerAllowed: true });
    return { date, workerId, workplaceCode: filters.workplaceCode };
  }

  private async buildPeriodCloseContext(
    req: Request,
    input: { periodStart: string; periodEnd: string; workplaceCode?: string },
  ): Promise<{
    days: string[];
    employees: AttendanceCloseEmployee[];
    snapshots: Awaited<ReturnType<AttendanceDailyLedgerRepository['findByDate']>>;
    corrections: Awaited<ReturnType<AttendanceCorrectionRequestRepository['findQueue']>>;
  }> {
    const tenantId = this.getTenantId(req);
    const days = enumerateDateKeys(input.periodStart, input.periodEnd);
    const ledgers = await Promise.all(days.map((date) => this.attendanceLedgerBuilder.buildDailyLedger(tenantId, {
      date,
      workplaceCode: input.workplaceCode,
    })));
    const employeeByWorkerId = new Map<string, AttendanceCloseEmployee>();
    for (const ledger of ledgers) {
      for (const row of ledger.rows) {
        employeeByWorkerId.set(row.worker.workerId, {
          workerId: row.worker.workerId,
          employeeId: row.worker.employeeId,
          name: row.worker.name,
          departmentName: row.worker.departmentName,
          workLocationCode: row.worker.workLocationCode,
        });
      }
    }
    const expectedWorkerIds = new Set(employeeByWorkerId.keys());
    const snapshots = (await Promise.all(days.map((date) => this.attendanceDailyLedgerRepo.findByDate(tenantId, date))))
      .flat()
      .filter((snapshot) => expectedWorkerIds.has(snapshot.workerId));
    const corrections = (await Promise.all(days.map((date) => this.attendanceCorrectionRepo.findQueue(tenantId, { workDate: date }))))
      .flat()
      .filter((correction) => expectedWorkerIds.has(correction.workerId));
    return {
      days,
      employees: [...employeeByWorkerId.values()].sort((left, right) => left.employeeId.localeCompare(right.employeeId)),
      snapshots,
      corrections,
    };
  }

  private async finalizeDailyLedgerThroughCommand(dto: dtos.FinalizeDailyLedgerDto, req: Request) {
    const outcome = await this.commandBus.execute(this.buildCommand(
      'FinalizeAttendanceDailyLedger',
      'AttendanceDailyLedger',
      dto,
      req,
    ));

    if (!outcome.success || !dto.payrollCycleId) return outcome;
    const data = outcome.data as {
      finalized?: boolean;
      payrollInputs?: Array<{ workerId: string; payrollCycleId: string; inputType: string; amount: number; currency: string; description?: string }>;
    };
    if (!data.finalized || !Array.isArray(data.payrollInputs) || data.payrollInputs.length === 0) return outcome;

    const payrollInputCommands = await Promise.all(data.payrollInputs.map((input) => this.commandBus.execute(this.buildCommand(
      'CreatePayrollInput',
      'PayrollInput',
      {
        workerId: new Uuid(input.workerId),
        payrollCycleId: new Uuid(input.payrollCycleId),
        inputType: input.inputType,
        amount: input.amount,
        currency: input.currency,
        description: input.description,
      },
      req,
      { subjectWorkerId: new Uuid(input.workerId) },
    ))));

    return {
      ...outcome,
      data: {
        ...data,
        payrollInputCommands,
      },
    };
  }

  @Get('policy')
  async getAttendancePolicy(@Req() req: Request) {
    const setup = await this.hcmSetupService.getSetup(this.getTenantId(req));
    return setup.attendancePolicy;
  }

  @Get('workers/:workerId/today-state')
  async getWorkerTodayState(@Param('workerId') workerId: string, @Req() req: Request) {
    await this.assertCanAccessWorker(req, workerId, { managerAllowed: true });
    return this.buildTodayState(workerId, req);
  }

  @Get('daily-ledger')
  async getDailyLedger(
    @Query('date') date: string | undefined,
    @Query('managerId') managerId: string | undefined,
    @Query('department') department: string | undefined,
    @Query('workplaceCode') workplaceCode: string | undefined,
    @Query('workerId') workerId: string | undefined,
    @Req() req: Request,
  ) {
    const filters = await this.scopedLedgerFilters(req, { date, managerId, department, workplaceCode, workerId });
    const ledger = await this.attendanceLedgerBuilder.buildDailyLedger(this.getTenantId(req), filters);
    const lockedSnapshots = await this.attendanceDailyLedgerRepo.findByDate(this.getTenantId(req), ledger.workDate);
    return {
      ...ledger,
      locked: lockedSnapshots.length > 0 && lockedSnapshots.every((snapshot) => snapshot.locked),
      lockedSnapshots,
    };
  }

  @Get('daily-ledger/locked')
  async getLockedDailyLedger(@Query('date') date: string, @Req() req: Request) {
    if (!date) throw new BadRequestException('date is required');
    if (!this.hasAttendanceAdminScope(req)) throw new ForbiddenException('Only HR or payroll administrators can view locked tenant ledgers');
    return {
      workDate: date,
      rows: await this.attendanceDailyLedgerRepo.findByDate(this.getTenantId(req), date),
    };
  }

  @Get('daily-ledger/geolocation-evidence.csv')
  async exportGeolocationEvidenceCsv(
    @Query('date') date: string | undefined,
    @Query('workplaceCode') workplaceCode: string | undefined,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    if (!this.hasAttendanceAdminScope(req)) {
      throw new ForbiddenException('Only HR or payroll administrators can export geolocation evidence');
    }

    const tenantId = this.getTenantId(req);
    const setup = await this.hcmSetupService.getSetup(tenantId);
    const ledger = await this.attendanceLedgerBuilder.buildDailyLedger(tenantId, { date, workplaceCode });
    const timezoneOffsetMinutes = setup.attendancePolicy.timezoneOffsetMinutes ?? 0;
    const range = this.dayUtcRange(ledger.workDate, timezoneOffsetMinutes);
    const workerIds = ledger.rows.map((row) => new Uuid(row.worker.workerId));
    const events = await this.timeClockEventRepo.findByWorkersBetweenForTenant(tenantId, workerIds, range.startAt, range.endAt);
    const csv = this.geolocationExport.buildCsv({
      workDate: ledger.workDate,
      timezoneOffsetMinutes,
      workers: ledger.rows.map((row) => row.worker),
      events,
    });

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="attendance-geolocation-evidence-${ledger.workDate}.csv"`);
    res.setHeader('X-Data-Classification', 'CONFIDENTIAL');
    res.setHeader('X-Visibility-Scope', 'HR_PAYROLL_ADMIN_ONLY');
    return res.send(`\uFEFF${csv}`);
  }

  @Post('daily-ledger/finalize')
  async finalizeDailyLedger(@Body(new ZodValidationPipe(FinalizeDailyLedgerDtoSchema)) dto: dtos.FinalizeDailyLedgerDto, @Req() req: Request) {
    if (!this.hasAttendanceAdminScope(req)) throw new ForbiddenException('Only HR or payroll administrators can finalize attendance ledgers');
    return this.finalizeDailyLedgerThroughCommand(dto, req);
  }

  @Get('period-close/readiness')
  async getPeriodCloseReadiness(
    @Query(new ZodValidationPipe(AttendancePeriodCloseQueryDtoSchema)) query: dtos.AttendancePeriodCloseQueryDto,
    @Req() req: Request,
  ) {
    if (!this.hasAttendanceAdminScope(req)) throw new ForbiddenException('Only HR or payroll administrators can view attendance close readiness');
    const period = this.resolveClosePeriod(query);
    const context = await this.buildPeriodCloseContext(req, {
      periodStart: period.periodStart,
      periodEnd: period.periodEnd,
      workplaceCode: query.workplaceCode,
    });
    return {
      ...period,
      workplaceCode: query.workplaceCode,
      readiness: this.closeReadiness.evaluatePeriod({
        periodStart: period.periodStart,
        periodEnd: period.periodEnd,
        employees: context.employees,
        snapshots: context.snapshots,
        corrections: context.corrections,
      }),
    };
  }

  @Post('period-close/finalize')
  async finalizeAttendancePeriod(
    @Body(new ZodValidationPipe(FinalizeAttendancePeriodDtoSchema)) dto: dtos.FinalizeAttendancePeriodDto,
    @Req() req: Request,
  ) {
    if (!this.hasAttendanceAdminScope(req)) throw new ForbiddenException('Only HR or payroll administrators can close attendance periods');
    if (dto.overrideReadiness && !dto.overrideReason?.trim()) {
      throw new BadRequestException('Override reason is required when bypassing attendance readiness blockers');
    }

    const period = this.resolveClosePeriod(dto);
    const beforeContext = await this.buildPeriodCloseContext(req, {
      periodStart: period.periodStart,
      periodEnd: period.periodEnd,
      workplaceCode: dto.workplaceCode,
    });
    const preflightReadiness = this.closeReadiness.evaluatePeriod({
      periodStart: period.periodStart,
      periodEnd: period.periodEnd,
      employees: beforeContext.employees,
      snapshots: beforeContext.snapshots,
      corrections: beforeContext.corrections,
    });

    const dailyResults = [];
    for (const date of beforeContext.days) {
      const outcome = await this.finalizeDailyLedgerThroughCommand({
        date,
        payrollCycleId: dto.payrollCycleId,
        workplaceCode: dto.workplaceCode,
      }, req);
      const data = ('data' in outcome ? outcome.data : {}) as {
        finalized?: boolean;
        alreadyLocked?: boolean;
        workDate?: string;
        lockedRows?: number;
        blockedRows?: unknown[];
        blockedCorrections?: unknown[];
        payrollInputCommands?: unknown[];
      };
      dailyResults.push({
        workDate: data.workDate ?? date,
        success: outcome.success,
        finalized: Boolean(data.finalized),
        alreadyLocked: Boolean(data.alreadyLocked),
        lockedRows: data.lockedRows ?? 0,
        blockedRows: data.blockedRows ?? [],
        blockedCorrections: data.blockedCorrections ?? [],
        payrollInputCommandCount: data.payrollInputCommands?.length ?? 0,
      });
    }

    const afterContext = await this.buildPeriodCloseContext(req, {
      periodStart: period.periodStart,
      periodEnd: period.periodEnd,
      workplaceCode: dto.workplaceCode,
    });
    const readiness = this.closeReadiness.evaluatePeriod({
      periodStart: period.periodStart,
      periodEnd: period.periodEnd,
      employees: afterContext.employees,
      snapshots: afterContext.snapshots,
      corrections: afterContext.corrections,
    });
    const failedDays = dailyResults.filter((result) => !result.success || !result.finalized);
    const finalized = readiness.canClose && failedDays.length === 0;

    return {
      ...period,
      workplaceCode: dto.workplaceCode,
      payrollCycleId: dto.payrollCycleId,
      finalized,
      status: finalized ? 'CLOSED_TO_PAY' : dailyResults.some((result) => result.finalized) ? 'PARTIALLY_CLOSED' : 'BLOCKED',
      preflightReadiness,
      readiness,
      dailyResults,
      payrollInputCommandCount: dailyResults.reduce((total, result) => total + result.payrollInputCommandCount, 0),
      override: dto.overrideReadiness ? {
        accepted: true,
        reason: dto.overrideReason,
      } : undefined,
    };
  }

  @Get('period-close/evidence.csv')
  async exportPeriodCloseEvidenceCsv(
    @Query(new ZodValidationPipe(AttendancePeriodCloseQueryDtoSchema)) query: dtos.AttendancePeriodCloseQueryDto,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    if (!this.hasAttendanceAdminScope(req)) throw new ForbiddenException('Only HR or payroll administrators can export attendance close evidence');
    const period = this.resolveClosePeriod(query);
    const context = await this.buildPeriodCloseContext(req, {
      periodStart: period.periodStart,
      periodEnd: period.periodEnd,
      workplaceCode: query.workplaceCode,
    });
    const readiness = this.closeReadiness.evaluatePeriod({
      periodStart: period.periodStart,
      periodEnd: period.periodEnd,
      employees: context.employees,
      snapshots: context.snapshots,
      corrections: context.corrections,
    });
    const headers = [
      'recordType',
      'periodStart',
      'periodEnd',
      'workDate',
      'employeeId',
      'employeeName',
      'workerId',
      'status',
      'locked',
      'readyForPayroll',
      'payableMinutes',
      'deductionMinutes',
      'overtimeMinutes',
      'issueCode',
      'message',
    ];
    const snapshotRows = context.snapshots.map((snapshot) => [
      'LOCKED_LEDGER',
      period.periodStart,
      period.periodEnd,
      snapshot.workDate,
      snapshot.employeeId,
      snapshot.workerName,
      snapshot.workerId,
      snapshot.status,
      snapshot.locked,
      snapshot.readyForPayroll,
      snapshot.payableMinutes,
      snapshot.deductionMinutes,
      snapshot.overtimeMinutes,
      '',
      '',
    ]);
    const issueRows = readiness.issues.map((issue) => [
      'READINESS_ISSUE',
      period.periodStart,
      period.periodEnd,
      issue.workDate,
      issue.employeeId ?? '',
      issue.employeeName ?? '',
      issue.workerId,
      issue.severity,
      '',
      '',
      '',
      '',
      '',
      issue.code,
      issue.message,
    ]);
    const csv = [
      headers.join(','),
      ...[...snapshotRows, ...issueRows].map((row) => row.map((value) => csvCell(value)).join(',')),
    ].join('\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="attendance-period-close-evidence-${period.periodStart}-${period.periodEnd}.csv"`);
    res.setHeader('X-Data-Classification', 'CONFIDENTIAL');
    res.setHeader('X-Visibility-Scope', 'HR_PAYROLL_ADMIN_ONLY');
    return res.send(`\uFEFF${csv}`);
  }

  @Get('exception-queue')
  async getExceptionQueue(
    @Query('date') date: string | undefined,
    @Query('managerId') managerId: string | undefined,
    @Query('department') department: string | undefined,
    @Req() req: Request,
  ) {
    const filters = await this.scopedLedgerFilters(req, { date, managerId, department });
    const ledger = await this.attendanceLedgerBuilder.buildDailyLedger(this.getTenantId(req), filters);
    return {
      workDate: ledger.workDate,
      summary: ledger.summary,
      items: ledger.exceptionQueue,
    };
  }

  @Get('payroll-inputs')
  async getPayrollInputs(
    @Query('date') date: string | undefined,
    @Query('workplaceCode') workplaceCode: string | undefined,
    @Req() req: Request,
  ) {
    if (!this.hasAttendanceAdminScope(req)) throw new ForbiddenException('Only HR or payroll administrators can view attendance payroll inputs');
    const ledger = await this.attendanceLedgerBuilder.buildDailyLedger(this.getTenantId(req), { date, workplaceCode });
    return {
      workDate: ledger.workDate,
      rows: ledger.rows.map((row) => ({
        workerId: row.worker.workerId,
        employeeId: row.worker.employeeId,
        name: row.worker.name,
        departmentName: row.worker.departmentName,
        payrollInput: row.payrollInput,
        exceptions: row.exceptions.map((exception) => ({
          code: exception.code,
          status: exception.status,
          payrollImpactMinutes: exception.payrollImpactMinutes,
        })),
      })),
      summary: ledger.summary,
    };
  }

  @Get('reminders')
  async getAttendanceReminders(
    @Query('date') date: string | undefined,
    @Query('managerId') managerId: string | undefined,
    @Query('department') department: string | undefined,
    @Query('workplaceCode') workplaceCode: string | undefined,
    @Query('workerId') workerId: string | undefined,
    @Req() req: Request,
  ) {
    const filters = await this.scopedLedgerFilters(req, { date, managerId, department, workplaceCode, workerId });
    const tenantId = this.getTenantId(req);
    const [setup, ledger] = await Promise.all([
      this.hcmSetupService.getSetup(tenantId),
      this.attendanceLedgerBuilder.buildDailyLedger(tenantId, filters),
    ]);
    return {
      workDate: ledger.workDate,
      reminders: this.reminderService.buildReminders({ ledger, policy: setup.attendancePolicy }),
    };
  }

  @Get('reports/period-view')
  async getAttendancePeriodView(
    @Query('range') rangeValue: string | undefined,
    @Query('scope') scopeValue: string | undefined,
    @Query('date') dateValue: string | undefined,
    @Query('workerId') workerId: string | undefined,
    @Query('managerId') managerId: string | undefined,
    @Query('workplaceCode') workplaceCode: string | undefined,
    @Req() req: Request,
  ) {
    const tenantId = this.getTenantId(req);
    const period = this.resolveAttendanceViewPeriod(rangeValue, dateValue);
    const scope = this.resolveAttendanceViewScope(scopeValue);
    const days = enumerateDateKeys(period.periodStart, period.periodEnd);
    const ledgers = await Promise.all(days.map(async (date) => {
      const filters = await this.scopedAttendanceViewFilters(req, scope, date, { managerId, workerId, workplaceCode });
      return this.attendanceLedgerBuilder.buildDailyLedger(tenantId, filters);
    }));

    return this.reportingService.buildPeriodView({
      periodStart: period.periodStart,
      periodEnd: period.periodEnd,
      range: period.range,
      scope,
      ledgers,
    });
  }

  @Get('reports/summary')
  async getAttendanceReportSummary(
    @Query(new ZodValidationPipe(AttendancePeriodCloseQueryDtoSchema)) query: dtos.AttendancePeriodCloseQueryDto,
    @Req() req: Request,
  ) {
    if (!this.hasAttendanceAdminScope(req) && !this.hasManagerScope(req)) {
      throw new ForbiddenException('Only managers, HR, or payroll administrators can view attendance reports');
    }
    const period = this.resolveClosePeriod(query);
    const days = enumerateDateKeys(period.periodStart, period.periodEnd);
    const ledgers = await Promise.all(days.map(async (date) => {
      const filters = await this.scopedLedgerFilters(req, { date, workplaceCode: query.workplaceCode });
      return this.attendanceLedgerBuilder.buildDailyLedger(this.getTenantId(req), filters);
    }));
    return this.reportingService.buildPeriodSummary({
      periodStart: period.periodStart,
      periodEnd: period.periodEnd,
      ledgers,
    });
  }

  @Get('reports/summary.csv')
  async exportAttendanceReportSummaryCsv(
    @Query(new ZodValidationPipe(AttendancePeriodCloseQueryDtoSchema)) query: dtos.AttendancePeriodCloseQueryDto,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    if (!this.hasAttendanceAdminScope(req) && !this.hasManagerScope(req)) {
      throw new ForbiddenException('Only managers, HR, or payroll administrators can export attendance reports');
    }
    const period = this.resolveClosePeriod(query);
    const days = enumerateDateKeys(period.periodStart, period.periodEnd);
    const ledgers = await Promise.all(days.map(async (date) => {
      const filters = await this.scopedLedgerFilters(req, { date, workplaceCode: query.workplaceCode });
      return this.attendanceLedgerBuilder.buildDailyLedger(this.getTenantId(req), filters);
    }));
    const report = this.reportingService.buildPeriodSummary({
      periodStart: period.periodStart,
      periodEnd: period.periodEnd,
      ledgers,
    });
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="attendance-summary-${period.periodStart}-${period.periodEnd}.csv"`);
    res.setHeader('X-Data-Classification', 'CONFIDENTIAL');
    res.setHeader('X-Visibility-Scope', 'HR_MANAGER_PAYROLL_ADMIN');
    return res.send(`\uFEFF${this.reportingService.toCsv(report)}`);
  }

  @Get('scheduling-command-center')
  async getSchedulingCommandCenter(
    @Query('date') date: string | undefined,
    @Query('workplaceCode') workplaceCode: string | undefined,
    @Req() req: Request,
  ) {
    if (!this.hasAttendanceAdminScope(req)) {
      throw new ForbiddenException('Only HR, payroll, or HRBP roles can view scheduling command center');
    }
    const tenantId = this.getTenantId(req);
    const setup = await this.hcmSetupService.getSetup(tenantId);
    const ledger = await this.attendanceLedgerBuilder.buildDailyLedger(tenantId, { date, workplaceCode });
    const [shiftSchedules, openShifts, coverageGaps, overtimeApprovals] = await Promise.all([
      this.shiftScheduleRepo.findByTenantScoped(tenantId, workplaceCode),
      this.openShiftRepo.findByTenantScoped(tenantId, workplaceCode),
      this.coverageGapRepo.findByTenantScoped(tenantId, workplaceCode),
      this.wfmOvertimeApprovalRepo.findByTenant(tenantId),
    ]);

    return this.schedulingCommandCenter.build({
      setup,
      ledger,
      shiftSchedules,
      openShifts,
      coverageGaps,
      overtimeApprovals,
      workplaceCode,
    });
  }

  @Get('correction-requests')
  async getCorrectionRequests(
    @Query('workerId') workerId: string | undefined,
    @Query('status') status: string | undefined,
    @Query('date') date: string | undefined,
    @Req() req: Request,
  ) {
    const tenantId = this.getTenantId(req);
    if (workerId) {
      await this.assertCanAccessWorker(req, workerId, { managerAllowed: true });
      return this.attendanceCorrectionRepo.findByWorker(tenantId, new Uuid(workerId));
    }
    const queue = await this.attendanceCorrectionRepo.findQueue(tenantId, {
      status: status as AttendanceCorrectionStatus | undefined,
      workDate: date,
    });
    if (this.hasAttendanceAdminScope(req)) return queue;
    if (this.hasManagerScope(req)) {
      const directReports = await this.workerRepo.findByManager(new Uuid(this.getActorId(req)));
      const directReportIds = new Set(directReports.map((worker) => worker.id.value));
      return queue.filter((request) => directReportIds.has(request.workerId));
    }
    const selfWorkerId = await this.resolveSelfWorkerId(req);
    if (!selfWorkerId) throw new ForbiddenException('No employee profile is linked to the authenticated user');
    return queue.filter((request) => request.workerId === selfWorkerId);
  }

  @Post('correction-requests')
  async createCorrectionRequest(
    @Body(new ZodValidationPipe(CreateAttendanceCorrectionRequestDtoSchema)) dto: dtos.CreateAttendanceCorrectionRequestDto,
    @Req() req: Request,
  ) {
    await this.assertCanAccessWorker(req, dto.workerId, { managerAllowed: false });
    return this.commandBus.execute(this.buildCommand(
      'CreateAttendanceCorrectionRequest',
      'AttendanceCorrectionRequest',
      { ...dto, workerId: new Uuid(dto.workerId) },
      req,
      { subjectWorkerId: new Uuid(dto.workerId) },
    ));
  }

  @Post('correction-requests/:id/commands/review')
  async reviewCorrectionRequest(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(ReviewAttendanceCorrectionRequestDtoSchema)) dto: dtos.ReviewAttendanceCorrectionRequestDto,
    @Req() req: Request,
  ) {
    const request = await this.attendanceCorrectionRepo.findById(new Uuid(id));
    if (!request) throw new BadRequestException('Correction request not found');
    if (!this.hasAttendanceAdminScope(req)) {
      await this.assertCanAccessWorker(req, request.workerId, { managerAllowed: true });
      if (!this.hasManagerScope(req)) throw new ForbiddenException('Only managers or HR can review attendance corrections');
    }
    return this.commandBus.execute(this.buildCommand(
      'ReviewAttendanceCorrectionRequest',
      'AttendanceCorrectionRequest',
      { correctionRequestId: new Uuid(id), decision: dto.decision, note: dto.note },
      req,
      {
        aggregateId: new Uuid(id),
        expectedState: request.status,
        expectedVersion: 0,
        subjectWorkerId: new Uuid(request.workerId),
      },
    ));
  }

  @Post('correction-requests/:id/commands/apply')
  async applyCorrectionRequest(@Param('id') id: string, @Req() req: Request) {
    const request = await this.attendanceCorrectionRepo.findById(new Uuid(id));
    if (!request) throw new BadRequestException('Correction request not found');
    if (!this.hasAttendanceAdminScope(req)) throw new ForbiddenException('Only HR or payroll administrators can apply attendance corrections');
    return this.commandBus.execute(this.buildCommand(
      'ApplyAttendanceCorrectionRequest',
      'AttendanceCorrectionRequest',
      { correctionRequestId: new Uuid(id) },
      req,
      {
        aggregateId: new Uuid(id),
        expectedState: request.status,
        expectedVersion: 0,
        subjectWorkerId: new Uuid(request.workerId),
      },
    ));
  }

  @Post('check-in')
  async checkIn(@Body(new ZodValidationPipe(CheckInOutDtoSchema)) dto: dtos.CheckInOutDto, @Req() req: Request) {
    return this.recordClockEvent(dto, 'CLOCK_IN', req);
  }

  @Post('check-out')
  async checkOut(@Body(new ZodValidationPipe(CheckInOutDtoSchema)) dto: dtos.CheckInOutDto, @Req() req: Request) {
    return this.recordClockEvent(dto, 'CLOCK_OUT', req);
  }

  @Post('on-duty-requests')
  async requestOnDuty(@Body(new ZodValidationPipe(OnDutyRequestDtoSchema)) dto: dtos.OnDutyRequestDto, @Req() req: Request) {
    await this.assertCanAccessWorker(req, dto.workerId, { managerAllowed: false });
    const description = JSON.stringify({
      startAt: dto.startAt.toISOString(),
      endAt: dto.endAt.toISOString(),
      reason: dto.reason,
      location: dto.location,
    });
    return this.commandBus.execute(this.buildCommand(
      'CreateAttendanceException',
      'AttendanceException',
      {
        workerId: new Uuid(dto.workerId),
        exceptionType: 'ON_DUTY_REQUEST',
        description,
        detectedAt: new Date(),
      },
      req,
      { subjectWorkerId: new Uuid(dto.workerId) },
    ));
  }

  @Get('workers/:workerId/monthly-summary')
  async getWorkerMonthlySummary(
    @Param('workerId') workerId: string,
    @Query('year') year: string | undefined,
    @Query('month') month: string | undefined,
    @Req() req: Request,
  ) {
    await this.assertCanAccessWorker(req, workerId, { managerAllowed: true });
    const targetYear = year ? Number(year) : new Date().getUTCFullYear();
    const targetMonth = month ? Number(month) : new Date().getUTCMonth() + 1;
    const setup = await this.hcmSetupService.getSetup(this.getTenantId(req));
    const events = await this.timeClockEventRepo.findByWorkerForTenant(this.getTenantId(req), new Uuid(workerId));
    const days = new Map<string, typeof events>();

    for (const event of events) {
      const timestamp = event.timestamp;
      if (timestamp.getUTCFullYear() !== targetYear || timestamp.getUTCMonth() + 1 !== targetMonth) continue;
      const day = timestamp.toISOString().slice(0, 10);
      days.set(day, [...(days.get(day) ?? []), event]);
    }

    const calculations = [...days.entries()].map(([workDate, dayEvents]) => this.attendanceCalculation.calculateDay({
      workDate,
      sessions: this.toSessions(dayEvents.map((event) => ({
        eventType: event.eventType,
        timestamp: event.timestamp,
        location: event.location,
      }))),
      policy: setup.attendancePolicy,
      timezoneOffsetMinutes: setup.attendancePolicy.timezoneOffsetMinutes,
    }));

    return {
      workerId,
      year: targetYear,
      month: targetMonth,
      days: calculations,
      summary: this.attendanceCalculation.summarizeMonth(calculations),
    };
  }

  /* Work Schedules */
  @Post('work-schedules')
  async createWorkSchedule(@Body(new ZodValidationPipe(CreateWorkScheduleDtoSchema)) dto: dtos.CreateWorkScheduleDto, @Req() req: Request) {
    if (!this.hasAttendanceAdminScope(req)) throw new ForbiddenException('Only HR administrators can create work schedules');
    return this.commandBus.execute(this.buildCommand('CreateWorkSchedule', 'WorkSchedule', { ...dto, workerId: new Uuid(dto.workerId) }, req, {
      subjectWorkerId: new Uuid(dto.workerId),
    }));
  }

  @Post('work-schedules/:id/commands/activate')
  async activateWorkSchedule(@Param('id') id: string, @Req() req: Request) {
    const ws = await this.workScheduleRepo.findById(new Uuid(id));
    if (!ws) throw new BadRequestException('Work schedule not found');
    return this.commandBus.execute(this.buildCommand('ActivateWorkSchedule', 'WorkSchedule', { workScheduleId: new Uuid(id) }, req, { aggregateId: new Uuid(id), expectedState: ws.status, expectedVersion: ws.aggregateVersion }));
  }

  @Post('work-schedules/:id/commands/expire')
  async expireWorkSchedule(@Param('id') id: string, @Req() req: Request) {
    const ws = await this.workScheduleRepo.findById(new Uuid(id));
    if (!ws) throw new BadRequestException('Work schedule not found');
    return this.commandBus.execute(this.buildCommand('ExpireWorkSchedule', 'WorkSchedule', { workScheduleId: new Uuid(id) }, req, { aggregateId: new Uuid(id), expectedState: ws.status, expectedVersion: ws.aggregateVersion }));
  }

  @Get('work-schedules/:id')
  async getWorkSchedule(@Param('id') id: string) {
    return this.workScheduleRepo.findById(new Uuid(id));
  }

  @Get('work-schedules/worker/:workerId')
  async getWorkSchedulesByWorker(@Param('workerId') workerId: string, @Req() req: Request) {
    await this.assertCanAccessWorker(req, workerId, { managerAllowed: true });
    return this.workScheduleRepo.findByWorker(new Uuid(workerId));
  }

  /* Timesheets */
  @Get('timesheets/from-ledger/preview')
  async previewTimesheetFromLedger(
    @Query('workerId') workerId: string,
    @Query('periodStart') periodStart: string,
    @Query('periodEnd') periodEnd: string,
    @Req() req: Request,
  ) {
    if (!workerId || !periodStart || !periodEnd) throw new BadRequestException('workerId, periodStart, and periodEnd are required');
    await this.assertCanAccessWorker(req, workerId, { managerAllowed: true });
    const snapshots = await this.attendanceDailyLedgerRepo.findByWorker(this.getTenantId(req), new Uuid(workerId), { dateFrom: periodStart, dateTo: periodEnd });
    return this.timesheetProjection.projectWorkerTimesheet({
      workerId,
      periodStart,
      periodEnd,
      snapshots,
    });
  }

  @Post('timesheets/from-ledger')
  async createTimesheetFromLedger(
    @Body(new ZodValidationPipe(CreateTimesheetFromLedgerDtoSchema)) dto: dtos.CreateTimesheetFromLedgerDto,
    @Req() req: Request,
  ) {
    await this.assertCanAccessWorker(req, dto.workerId, { managerAllowed: false });
    const projection = await this.previewTimesheetFromLedger(dto.workerId, dto.periodStart, dto.periodEnd, req);
    if (projection.blockedReasons.length > 0) {
      throw new BadRequestException(projection.blockedReasons.join(' '));
    }
    const created = await this.commandBus.execute(this.buildCommand('CreateTimesheet', 'Timesheet', {
      workerId: new Uuid(dto.workerId),
      periodStart: new Date(`${dto.periodStart}T00:00:00.000Z`),
      periodEnd: new Date(`${dto.periodEnd}T00:00:00.000Z`),
      entries: projection.entries,
    }, req, {
      subjectWorkerId: new Uuid(dto.workerId),
    }));
    if (!created.success || !dto.submit) return { projection, command: created };
    const timesheetId = (created.data as { timesheetId?: string }).timesheetId;
    if (!timesheetId) return { projection, command: created };
    const timesheet = await this.timesheetRepo.findById(new Uuid(timesheetId));
    if (!timesheet) return { projection, command: created };
    const submitted = await this.commandBus.execute(this.buildCommand('SubmitTimesheet', 'Timesheet', { timesheetId: timesheet.id }, req, {
      aggregateId: timesheet.id,
      expectedState: timesheet.status,
      expectedVersion: timesheet.aggregateVersion,
      subjectWorkerId: timesheet.workerId,
    }));
    return { projection, command: submitted };
  }

  @Post('timesheets')
  async createTimesheet(@Body(new ZodValidationPipe(CreateTimesheetDtoSchema)) dto: dtos.CreateTimesheetDto, @Req() req: Request) {
    await this.assertCanAccessWorker(req, dto.workerId, { managerAllowed: false });
    return this.commandBus.execute(this.buildCommand('CreateTimesheet', 'Timesheet', { ...dto, workerId: new Uuid(dto.workerId) }, req, {
      subjectWorkerId: new Uuid(dto.workerId),
    }));
  }

  @Post('timesheets/:id/commands/submit')
  async submitTimesheet(@Param('id') id: string, @Req() req: Request) {
    const ts = await this.timesheetRepo.findById(new Uuid(id));
    if (!ts) throw new BadRequestException('Timesheet not found');
    return this.commandBus.execute(this.buildCommand('SubmitTimesheet', 'Timesheet', { timesheetId: new Uuid(id) }, req, { aggregateId: new Uuid(id), expectedState: ts.status, expectedVersion: ts.aggregateVersion }));
  }

  @Post('timesheets/:id/commands/approve')
  async approveTimesheet(@Param('id') id: string, @Req() req: Request) {
    const ts = await this.timesheetRepo.findById(new Uuid(id));
    if (!ts) throw new BadRequestException('Timesheet not found');
    return this.commandBus.execute(this.buildCommand('ApproveTimesheet', 'Timesheet', { timesheetId: new Uuid(id), approvedBy: Uuid.generate() }, req, { aggregateId: new Uuid(id), expectedState: ts.status, expectedVersion: ts.aggregateVersion }));
  }

  @Post('timesheets/:id/commands/reject')
  async rejectTimesheet(@Param('id') id: string, @Req() req: Request) {
    const ts = await this.timesheetRepo.findById(new Uuid(id));
    if (!ts) throw new BadRequestException('Timesheet not found');
    return this.commandBus.execute(this.buildCommand('RejectTimesheet', 'Timesheet', { timesheetId: new Uuid(id) }, req, { aggregateId: new Uuid(id), expectedState: ts.status, expectedVersion: ts.aggregateVersion }));
  }

  @Post('timesheets/:id/commands/correct')
  async correctTimesheet(@Param('id') id: string, @Req() req: Request) {
    const ts = await this.timesheetRepo.findById(new Uuid(id));
    if (!ts) throw new BadRequestException('Timesheet not found');
    return this.commandBus.execute(this.buildCommand('CorrectTimesheet', 'Timesheet', { timesheetId: new Uuid(id) }, req, { aggregateId: new Uuid(id), expectedState: ts.status, expectedVersion: ts.aggregateVersion }));
  }

  @Get('timesheets/:id')
  async getTimesheet(@Param('id') id: string) {
    return this.timesheetRepo.findById(new Uuid(id));
  }

  @Get('timesheets/worker/:workerId')
  async getTimesheetsByWorker(@Param('workerId') workerId: string, @Req() req: Request) {
    await this.assertCanAccessWorker(req, workerId, { managerAllowed: true });
    return this.timesheetRepo.findByWorker(new Uuid(workerId));
  }

  /* Time Clock Events */
  @Post('time-clock-events')
  async recordTimeClockEvent(@Body(new ZodValidationPipe(RecordTimeClockEventDtoSchema)) dto: dtos.RecordTimeClockEventDto, @Req() req: Request) {
    await this.assertCanAccessWorker(req, dto.workerId, { managerAllowed: false });
    const normalizedDto = {
      workerId: dto.workerId,
      workplaceCode: dto.workplaceCode,
      latitude: dto.latitude,
      longitude: dto.longitude,
      accuracyMeters: dto.accuracyMeters,
      deviceId: dto.deviceId,
      timestamp: dto.timestamp,
      captureMethod: dto.captureMethod,
      captureDeviceKind: dto.captureDeviceKind,
      captureReference: dto.captureReference,
      verificationStatus: dto.verificationStatus,
      captureEvidence: dto.captureEvidence,
    };
    const locationEvidence = await this.buildClockLocation(normalizedDto, req);
    const captureMethod = inferCaptureMethod(dto);
    return this.commandBus.execute(this.buildCommand('RecordTimeClockEvent', 'TimeClockEvent', {
      ...dto,
      workerId: new Uuid(dto.workerId),
      location: dto.location ?? JSON.stringify(locationEvidence),
      latitude: locationEvidence.latitude,
      longitude: locationEvidence.longitude,
      accuracyMeters: locationEvidence.accuracyMeters,
      workplaceCode: locationEvidence.workplaceCode,
      distanceMeters: locationEvidence.distanceMeters,
      geofenceRadiusMeters: locationEvidence.geofenceRadiusMeters,
      geofenceProfileCode: locationEvidence.geofenceProfileCode,
      locationStatus: locationEvidence.locationStatus,
      deviceTrustLevel: locationEvidence.deviceTrustLevel,
      trustLevel: locationEvidence.trustLevel,
      trustScore: locationEvidence.trustScore,
      trustRequiresApproval: locationEvidence.trustRequiresApproval,
      trustReasons: locationEvidence.trustReasons,
      captureMethod,
      captureDeviceKind: dto.captureDeviceKind ?? (captureMethod === 'MOBILE_GEOFENCE' ? 'MOBILE_BROWSER' : undefined),
      captureReference: dto.captureReference ?? dto.deviceId,
      verificationStatus: dto.verificationStatus ?? (locationEvidence.trustRequiresApproval ? 'PENDING' : 'VERIFIED'),
      captureEvidence: {
        ...(dto.captureEvidence ?? {}),
        geolocation: {
          workplaceCode: locationEvidence.workplaceCode,
          locationStatus: locationEvidence.locationStatus,
          distanceMeters: locationEvidence.distanceMeters,
          accuracyMeters: locationEvidence.accuracyMeters,
        },
        trust: {
          trustLevel: locationEvidence.trustLevel,
          trustScore: locationEvidence.trustScore,
          requiresApproval: locationEvidence.trustRequiresApproval,
          reasons: locationEvidence.trustReasons ?? [],
        },
      },
    }, req, {
      subjectWorkerId: new Uuid(dto.workerId),
    }));
  }

  @Post('time-clock-events/:id/commands/validate')
  async validateTimeClockEvent(@Param('id') id: string, @Req() req: Request) {
    const ev = await this.timeClockEventRepo.findById(new Uuid(id));
    if (!ev) throw new BadRequestException('Time clock event not found');
    return this.commandBus.execute(this.buildCommand('ValidateTimeClockEvent', 'TimeClockEvent', { timeClockEventId: new Uuid(id) }, req, { aggregateId: new Uuid(id), expectedState: ev.status, expectedVersion: ev.aggregateVersion }));
  }

  @Post('time-clock-events/:id/commands/resolve')
  async resolveTimeClockEvent(@Param('id') id: string, @Req() req: Request) {
    const ev = await this.timeClockEventRepo.findById(new Uuid(id));
    if (!ev) throw new BadRequestException('Time clock event not found');
    return this.commandBus.execute(this.buildCommand('ResolveTimeClockEvent', 'TimeClockEvent', { timeClockEventId: new Uuid(id) }, req, { aggregateId: new Uuid(id), expectedState: ev.status, expectedVersion: ev.aggregateVersion }));
  }

  @Get('time-clock-events/worker/:workerId')
  async getTimeClockEventsByWorker(@Param('workerId') workerId: string, @Req() req: Request) {
    await this.assertCanAccessWorker(req, workerId, { managerAllowed: true });
    return this.timeClockEventRepo.findByWorkerForTenant(this.getTenantId(req), new Uuid(workerId));
  }

  /* Attendance Exceptions */
  @Post('attendance-exceptions')
  async createAttendanceException(@Body(new ZodValidationPipe(CreateAttendanceExceptionDtoSchema)) dto: dtos.CreateAttendanceExceptionDto, @Req() req: Request) {
    await this.assertCanAccessWorker(req, dto.workerId, { managerAllowed: false });
    return this.commandBus.execute(this.buildCommand('CreateAttendanceException', 'AttendanceException', { ...dto, workerId: new Uuid(dto.workerId) }, req, {
      subjectWorkerId: new Uuid(dto.workerId),
    }));
  }

  @Post('attendance-exceptions/:id/commands/review')
  async reviewAttendanceException(@Param('id') id: string, @Req() req: Request) {
    const ex = await this.attendanceExceptionRepo.findById(new Uuid(id));
    if (!ex) throw new BadRequestException('Attendance exception not found');
    return this.commandBus.execute(this.buildCommand('ReviewAttendanceException', 'AttendanceException', { attendanceExceptionId: new Uuid(id) }, req, { aggregateId: new Uuid(id), expectedState: ex.status, expectedVersion: ex.aggregateVersion }));
  }

  @Post('attendance-exceptions/:id/commands/resolve')
  async resolveAttendanceException(@Param('id') id: string, @Req() req: Request) {
    const ex = await this.attendanceExceptionRepo.findById(new Uuid(id));
    if (!ex) throw new BadRequestException('Attendance exception not found');
    return this.commandBus.execute(this.buildCommand('ResolveAttendanceException', 'AttendanceException', { attendanceExceptionId: new Uuid(id), resolvedBy: Uuid.generate() }, req, { aggregateId: new Uuid(id), expectedState: ex.status, expectedVersion: ex.aggregateVersion }));
  }

  @Post('attendance-exceptions/:id/commands/escalate')
  async escalateAttendanceException(@Param('id') id: string, @Req() req: Request) {
    const ex = await this.attendanceExceptionRepo.findById(new Uuid(id));
    if (!ex) throw new BadRequestException('Attendance exception not found');
    return this.commandBus.execute(this.buildCommand('EscalateAttendanceException', 'AttendanceException', { attendanceExceptionId: new Uuid(id) }, req, { aggregateId: new Uuid(id), expectedState: ex.status, expectedVersion: ex.aggregateVersion }));
  }

  @Get('attendance-exceptions/worker/:workerId')
  async getAttendanceExceptionsByWorker(@Param('workerId') workerId: string, @Req() req: Request) {
    await this.assertCanAccessWorker(req, workerId, { managerAllowed: true });
    return this.attendanceExceptionRepo.findByWorkerForTenant(this.getTenantId(req), new Uuid(workerId));
  }

  /* Overtime Approvals */
  @Post('overtime-approvals')
  async requestOvertime(@Body(new ZodValidationPipe(RequestOvertimeDtoSchema)) dto: dtos.RequestOvertimeDto, @Req() req: Request) {
    await this.assertCanAccessWorker(req, dto.workerId, { managerAllowed: false });
    return this.commandBus.execute(this.buildCommand('RequestOvertime', 'OvertimeApproval', { ...dto, workerId: new Uuid(dto.workerId) }, req, {
      subjectWorkerId: new Uuid(dto.workerId),
    }));
  }

  @Post('overtime-approvals/:id/commands/approve')
  async approveOvertime(@Param('id') id: string, @Req() req: Request) {
    const ot = await this.overtimeApprovalRepo.findById(new Uuid(id));
    if (!ot) throw new BadRequestException('Overtime approval not found');
    return this.commandBus.execute(this.buildCommand('ApproveOvertime', 'OvertimeApproval', { overtimeApprovalId: new Uuid(id), approvedBy: Uuid.generate() }, req, { aggregateId: new Uuid(id), expectedState: ot.status, expectedVersion: ot.aggregateVersion }));
  }

  @Post('overtime-approvals/:id/commands/reject')
  async rejectOvertime(@Param('id') id: string, @Req() req: Request) {
    const ot = await this.overtimeApprovalRepo.findById(new Uuid(id));
    if (!ot) throw new BadRequestException('Overtime approval not found');
    return this.commandBus.execute(this.buildCommand('RejectOvertime', 'OvertimeApproval', { overtimeApprovalId: new Uuid(id) }, req, { aggregateId: new Uuid(id), expectedState: ot.status, expectedVersion: ot.aggregateVersion }));
  }

  @Post('overtime-approvals/:id/commands/cancel')
  async cancelOvertime(@Param('id') id: string, @Req() req: Request) {
    const ot = await this.overtimeApprovalRepo.findById(new Uuid(id));
    if (!ot) throw new BadRequestException('Overtime approval not found');
    return this.commandBus.execute(this.buildCommand('CancelOvertime', 'OvertimeApproval', { overtimeApprovalId: new Uuid(id) }, req, { aggregateId: new Uuid(id), expectedState: ot.status, expectedVersion: ot.aggregateVersion }));
  }

  @Get('overtime-approvals/worker/:workerId')
  async getOvertimeApprovalsByWorker(@Param('workerId') workerId: string, @Req() req: Request) {
    await this.assertCanAccessWorker(req, workerId, { managerAllowed: true });
    return this.overtimeApprovalRepo.findByWorker(new Uuid(workerId));
  }
}

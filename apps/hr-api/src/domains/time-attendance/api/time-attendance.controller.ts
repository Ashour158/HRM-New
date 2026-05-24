import { Controller, Get, Post, Body, Param, Req, BadRequestException } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { randomUUID } from 'crypto';
import { CommandBus } from '../../../platform/command-bus/command-bus.js';
import { Uuid } from '@hcm/shared-kernel';
import { computeRequestHash } from '@hcm/platform-core';
import type { HrCommandEnvelope } from '@hcm/command-contracts';
import { WorkScheduleRepository } from '../repositories/work-schedule.repository.js';
import { TimesheetRepository } from '../repositories/timesheet.repository.js';
import { TimeClockEventRepository } from '../repositories/time-clock-event.repository.js';
import { AttendanceExceptionRepository } from '../repositories/attendance-exception.repository.js';
import { OvertimeApprovalRepository } from '../repositories/overtime-approval.repository.js';
import type * as dtos from './dtos.js';
import {
  CreateWorkScheduleDtoSchema, CreateTimesheetDtoSchema, RecordTimeClockEventDtoSchema,
  CreateAttendanceExceptionDtoSchema, RequestOvertimeDtoSchema, ZodValidationPipe,
} from './dtos.js';

@ApiTags('Time & Attendance')
@Controller('time/attendance')
export class TimeAttendanceController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly workScheduleRepo: WorkScheduleRepository,
    private readonly timesheetRepo: TimesheetRepository,
    private readonly timeClockEventRepo: TimeClockEventRepository,
    private readonly attendanceExceptionRepo: AttendanceExceptionRepository,
    private readonly overtimeApprovalRepo: OvertimeApprovalRepository,
  ) {}

  private buildCommand<TPayload>(
    commandName: string,
    aggregateType: string,
    payload: TPayload,
    req: Request,
    options?: { aggregateId?: Uuid; expectedState?: string; expectedVersion?: number; subjectWorkerId?: Uuid },
  ): HrCommandEnvelope<TPayload> {
    const tenantId = new Uuid((req['tenantId'] as string | undefined) ?? '00000000-0000-0000-0000-000000000001');
    return {
      commandId: Uuid.generate(),
      commandName,
      commandSchemaVersion: 1,
      tenantId,
      actor: { actorType: 'SYSTEM', actorId: Uuid.generate(), roles: ['HR_ADMIN'], permissions: ['TIME_ATTENDANCE_WRITE'], mfaAuthenticated: true },
      aggregateType,
      aggregateId: options?.aggregateId,
      expectedState: options?.expectedState,
      expectedVersion: options?.expectedVersion,
      subjectWorkerId: options?.subjectWorkerId,
      idempotencyKey: randomUUID(),
      correlationId: Uuid.generate(),
      reason: 'API request',
      payload,
      metadata: { requestHash: computeRequestHash(payload), clientType: 'HR_ADMIN' },
    };
  }

  /* Work Schedules */
  @Post('work-schedules')
  async createWorkSchedule(@Body(new ZodValidationPipe(CreateWorkScheduleDtoSchema)) dto: dtos.CreateWorkScheduleDto, @Req() req: Request) {
    return this.commandBus.execute(this.buildCommand('CreateWorkSchedule', 'WorkSchedule', dto, req));
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
  async getWorkSchedulesByWorker(@Param('workerId') workerId: string) {
    return this.workScheduleRepo.findByWorker(new Uuid(workerId));
  }

  /* Timesheets */
  @Post('timesheets')
  async createTimesheet(@Body(new ZodValidationPipe(CreateTimesheetDtoSchema)) dto: dtos.CreateTimesheetDto, @Req() req: Request) {
    return this.commandBus.execute(this.buildCommand('CreateTimesheet', 'Timesheet', dto, req));
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
  async getTimesheetsByWorker(@Param('workerId') workerId: string) {
    return this.timesheetRepo.findByWorker(new Uuid(workerId));
  }

  /* Time Clock Events */
  @Post('time-clock-events')
  async recordTimeClockEvent(@Body(new ZodValidationPipe(RecordTimeClockEventDtoSchema)) dto: dtos.RecordTimeClockEventDto, @Req() req: Request) {
    return this.commandBus.execute(this.buildCommand('RecordTimeClockEvent', 'TimeClockEvent', dto, req));
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
  async getTimeClockEventsByWorker(@Param('workerId') workerId: string) {
    return this.timeClockEventRepo.findByWorker(new Uuid(workerId));
  }

  /* Attendance Exceptions */
  @Post('attendance-exceptions')
  async createAttendanceException(@Body(new ZodValidationPipe(CreateAttendanceExceptionDtoSchema)) dto: dtos.CreateAttendanceExceptionDto, @Req() req: Request) {
    return this.commandBus.execute(this.buildCommand('CreateAttendanceException', 'AttendanceException', dto, req));
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
  async getAttendanceExceptionsByWorker(@Param('workerId') workerId: string) {
    return this.attendanceExceptionRepo.findByWorker(new Uuid(workerId));
  }

  /* Overtime Approvals */
  @Post('overtime-approvals')
  async requestOvertime(@Body(new ZodValidationPipe(RequestOvertimeDtoSchema)) dto: dtos.RequestOvertimeDto, @Req() req: Request) {
    return this.commandBus.execute(this.buildCommand('RequestOvertime', 'OvertimeApproval', dto, req));
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
  async getOvertimeApprovalsByWorker(@Param('workerId') workerId: string) {
    return this.overtimeApprovalRepo.findByWorker(new Uuid(workerId));
  }
}

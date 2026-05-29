import { Injectable } from '@nestjs/common';
import { Uuid } from '@hcm/shared-kernel';
import { HcmSetupService } from '../../hcm-setup/hcm-setup.service.js';
import { AbsenceRequestRepository } from '../../absence-leave/repositories/absence-request.repository.js';
import { LeavePolicyService } from '../../absence-leave/services/leave-policy.service.js';
import { PersonalDataRecordRepository } from '../../hr-core/repositories/personal-data-record.repository.js';
import { WorkerRepository } from '../../hr-core/repositories/worker.repository.js';
import { AttendanceExceptionRepository } from '../repositories/attendance-exception.repository.js';
import { TimeClockEventRepository } from '../repositories/time-clock-event.repository.js';
import { WorkScheduleRepository } from '../repositories/work-schedule.repository.js';
import { AttendanceLedgerService, type AttendanceDailyLedger, type AttendanceLedgerWorker } from './attendance-ledger.service.js';
import { AttendancePolicyResolutionService } from './attendance-policy-resolution.service.js';

export interface AttendanceLedgerBuildFilters {
  date?: string;
  department?: string;
  managerId?: string;
  workerId?: string;
  workplaceCode?: string;
}

function localDateKey(date: Date, timezoneOffsetMinutes: number): string {
  return new Date(date.getTime() + timezoneOffsetMinutes * 60000).toISOString().slice(0, 10);
}

function workDateToUtc(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

function isScheduleEffective(schedule: { status: string; startDate: Date; endDate?: Date }, workDate: string): boolean {
  const day = workDateToUtc(workDate).getTime();
  const start = workDateToUtc(schedule.startDate.toISOString().slice(0, 10)).getTime();
  const end = schedule.endDate ? workDateToUtc(schedule.endDate.toISOString().slice(0, 10)).getTime() : Number.POSITIVE_INFINITY;
  return schedule.status === 'ACTIVE' && start <= day && day <= end;
}

function dateKey(value: Date): string {
  return value.toISOString().slice(0, 10);
}

@Injectable()
export class AttendanceLedgerBuilderService {
  constructor(
    private readonly hcmSetupService: HcmSetupService,
    private readonly workerRepo: WorkerRepository,
    private readonly personalDataRepo: PersonalDataRecordRepository,
    private readonly workScheduleRepo: WorkScheduleRepository,
    private readonly timeClockEventRepo: TimeClockEventRepository,
    private readonly attendanceExceptionRepo: AttendanceExceptionRepository,
    private readonly absenceRequestRepo: AbsenceRequestRepository,
    private readonly attendanceLedger: AttendanceLedgerService,
    private readonly policyResolution: AttendancePolicyResolutionService,
    private readonly leavePolicyService: LeavePolicyService,
  ) {}

  async buildDailyLedger(tenantId: Uuid, filters?: AttendanceLedgerBuildFilters): Promise<AttendanceDailyLedger> {
    const setup = await this.hcmSetupService.getSetup(tenantId);
    const workDate = filters?.date ?? localDateKey(new Date(), setup.attendancePolicy.timezoneOffsetMinutes ?? 0);
    const defaultWorkplaceCode = setup.locations.find((location) => location.active)?.code;
    const departmentLabels = new Map(setup.departments.map((department) => [department.code, department.label]));
    const activeWorkers = await this.workerRepo.findActive();

    const workersWithSchedules = await Promise.all(activeWorkers.map(async (worker): Promise<AttendanceLedgerWorker> => {
      const departmentId = worker.departmentId?.value;
      const records = await this.personalDataRepo.findByWorker(worker.id);
      const payloadByCategory = Object.fromEntries(records.map((record) => [record.dataCategory, record.payload ?? {}])) as Record<string, Record<string, unknown>>;
      const contact = payloadByCategory.CONTACT ?? {};
      const workLocation = contact.workLocation as Record<string, unknown> | undefined;
      const workLocationCode = typeof workLocation?.code === 'string' ? workLocation.code : defaultWorkplaceCode;
      const activeSchedule = (await this.workScheduleRepo.findByWorker(worker.id))
        .filter((schedule) => isScheduleEffective(schedule, workDate))
        .sort((left, right) => right.startDate.getTime() - left.startDate.getTime())[0];
      const resolvedPolicy = this.policyResolution.resolveWorkerDay({
        setup,
        workDate,
        worker: {
          workerId: worker.id.value,
          departmentCode: departmentId,
          workplaceCode: workLocationCode,
        },
        activeSchedule,
      });

      return {
        workerId: worker.id.value,
        employeeId: worker.employeeNumber,
        name: `${worker.firstName} ${worker.lastName}`,
        email: worker.email.toString(),
        departmentName: departmentId ? departmentLabels.get(departmentId) ?? departmentId : 'Unassigned',
        managerId: worker.managerId?.value,
        workLocationCode,
        status: worker.status,
        scheduled: resolvedPolicy.scheduled,
        scheduledWorkDays: resolvedPolicy.scheduledWorkDays,
        scheduledDailyMinutes: resolvedPolicy.scheduledDailyMinutes,
        scheduleId: resolvedPolicy.scheduleId,
        scheduleLabel: resolvedPolicy.scheduleLabel,
        shiftCode: resolvedPolicy.shiftCode,
        shiftLabel: resolvedPolicy.shiftLabel,
        holiday: resolvedPolicy.holiday,
        effectivePolicy: resolvedPolicy.effectivePolicy,
        policyEvidence: resolvedPolicy.evidence,
      };
    }));

    const workers = workersWithSchedules.filter((worker) => {
      if (filters?.workerId && worker.workerId !== filters.workerId) return false;
      if (filters?.managerId && worker.managerId !== filters.managerId) return false;
      if (filters?.department && worker.departmentName !== filters.department && worker.departmentName?.toLowerCase() !== filters.department.toLowerCase()) return false;
      if (filters?.workplaceCode && worker.workLocationCode !== filters.workplaceCode) return false;
      return true;
    });

    const approvedLeaves = await this.absenceRequestRepo.findApprovedOverlapping(
      tenantId,
      workDate,
      workDate,
      workers.map((worker) => worker.workerId),
    );
    const leaveByWorkerId = new Map(approvedLeaves.map((leave) => [leave.workerId.value, leave]));
    const workersWithLeave = workers.map((worker) => {
      const leave = leaveByWorkerId.get(worker.workerId);
      if (!leave) return worker;
      return {
        ...worker,
        approvedLeave: {
          absenceRequestId: leave.id.value,
          absenceType: leave.absenceType,
          paid: this.resolveLeavePaid(setup, leave),
          startDate: dateKey(leave.startDate),
          endDate: dateKey(leave.endDate),
        },
      };
    });

    const pairs = await Promise.all(workersWithLeave.map(async (worker) => ({
      workerId: worker.workerId,
      events: await this.timeClockEventRepo.findByWorker(new Uuid(worker.workerId)),
      exceptions: await this.attendanceExceptionRepo.findByWorker(new Uuid(worker.workerId)),
    })));

    return this.attendanceLedger.buildDailyLedger({
      workDate,
      workers: workersWithLeave,
      eventsByWorkerId: new Map(pairs.map((pair) => [pair.workerId, pair.events])),
      exceptionsByWorkerId: new Map(pairs.map((pair) => [pair.workerId, pair.exceptions])),
      policy: setup.attendancePolicy,
      holidays: setup.attendancePolicy.holidays ?? [],
      workDays: setup.attendancePolicy.workDays,
    });
  }

  private resolveLeavePaid(setup: Awaited<ReturnType<HcmSetupService['getSetup']>>, leave: { absenceType: string; paid: boolean }): boolean {
    try {
      return this.leavePolicyService.resolvePolicy(setup, leave.absenceType).paid;
    } catch {
      return leave.paid;
    }
  }
}

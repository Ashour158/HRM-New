import { Injectable } from '@nestjs/common';
import type { Uuid } from '@hcm/shared-kernel';
import { TimeClockEventRepository } from './repositories/time-clock-event.repository.js';
import { AttendanceDailyLedgerRepository, type AttendanceDailyLedgerStoredRecord } from './repositories/attendance-daily-ledger.repository.js';
import {
  AttendanceCalculationService,
  type AttendanceDayCalculation,
  type AttendanceDayCalculationInput,
  type AttendanceMonthlySummary,
  type AttendanceSession,
} from './services/attendance-calculation.service.js';
import type { TimeClockEvent } from './aggregates/time-clock-event.aggregate.js';

// Re-exported so cross-domain consumers (e.g. payroll) can type their variables without
// importing directly from time-attendance's internal repositories/, services/, or
// aggregates/ folders.
export type {
  AttendanceDailyLedgerStoredRecord,
  AttendanceDayCalculation,
  AttendanceDayCalculationInput,
  AttendanceMonthlySummary,
  AttendanceSession,
  TimeClockEvent,
};

/**
 * Public, read-only query surface for the time-attendance domain.
 *
 * Other domains (e.g. payroll, which needs attendance data to build payroll cycles)
 * should depend on this service instead of importing time-attendance's repositories or
 * AttendanceCalculationService directly. Only the read/computation operations that
 * cross-domain consumers actually need are exposed here; write access must go through
 * time-attendance's CommandBus command handlers.
 */
@Injectable()
export class TimeAttendanceDirectoryQueryService {
  constructor(
    private readonly timeClockEventRepo: TimeClockEventRepository,
    private readonly dailyLedgerRepo: AttendanceDailyLedgerRepository,
    private readonly attendanceCalculation: AttendanceCalculationService,
  ) {}

  findTimeClockEventsForWorker(workerId: Uuid): Promise<TimeClockEvent[]> {
    return this.timeClockEventRepo.findByWorker(workerId);
  }

  /** Batch variant of {@link findTimeClockEventsForWorker} — one query for many workers over a date range (avoids N+1). */
  findTimeClockEventsForWorkersBetween(
    tenantId: Uuid,
    workerIds: Uuid[],
    startAt: Date,
    endAt: Date,
  ): Promise<TimeClockEvent[]> {
    return this.timeClockEventRepo.findByWorkersBetweenForTenant(tenantId, workerIds, startAt, endAt);
  }

  findDailyLedgerSnapshotsForWorker(
    tenantId: Uuid,
    workerId: Uuid,
    options?: { dateFrom?: string; dateTo?: string },
  ): Promise<AttendanceDailyLedgerStoredRecord[]> {
    return this.dailyLedgerRepo.findByWorker(tenantId, workerId, options);
  }

  findDailyLedgerSnapshotsForWorkers(
    tenantId: Uuid,
    workerIds: Uuid[],
    options?: { dateFrom?: string; dateTo?: string },
  ): Promise<Map<string, AttendanceDailyLedgerStoredRecord[]>> {
    return this.dailyLedgerRepo.findByWorkers(tenantId, workerIds, options);
  }

  calculateAttendanceDay(input: AttendanceDayCalculationInput): AttendanceDayCalculation {
    return this.attendanceCalculation.calculateDay(input);
  }

  summarizeAttendanceMonth(days: AttendanceDayCalculation[]): AttendanceMonthlySummary {
    return this.attendanceCalculation.summarizeMonth(days);
  }
}

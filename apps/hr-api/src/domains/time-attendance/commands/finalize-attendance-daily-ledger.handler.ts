import { Injectable } from '@nestjs/common';
import type { CommandResult, HrCommandEnvelope } from '@hcm/command-contracts';
// import { Uuid } from '@hcm/shared-kernel';
import { CommandHandler } from '../../../platform/command-bus/command-handler.decorator.js';
import { AttendanceCorrectionRequestRepository } from '../repositories/attendance-correction-request.repository.js';
import { AttendanceDailyLedgerRepository } from '../repositories/attendance-daily-ledger.repository.js';
import { AttendanceFinalizationService } from '../services/attendance-finalization.service.js';
import { AttendanceLedgerBuilderService } from '../services/attendance-ledger-builder.service.js';

@CommandHandler('FinalizeAttendanceDailyLedger')
@Injectable()
export class FinalizeAttendanceDailyLedgerHandler {
  constructor(
    private readonly ledgerBuilder: AttendanceLedgerBuilderService,
    private readonly dailyLedgerRepo: AttendanceDailyLedgerRepository,
    private readonly correctionRepo: AttendanceCorrectionRequestRepository,
    private readonly finalization: AttendanceFinalizationService,
  ) {}

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>> {
    const payload = command.payload as {
      date: string;
      payrollCycleId?: string;
      currency?: string;
      workplaceCode?: string;
    };
    const ledger = await this.ledgerBuilder.buildDailyLedger(command.tenantId, {
      date: payload.date,
      workplaceCode: payload.workplaceCode,
    });
    const ledgerWorkerIds = new Set(ledger.rows.map((row) => row.worker.workerId));
    const existingSnapshots = (await this.dailyLedgerRepo.findByDate(command.tenantId, ledger.workDate))
      .filter((snapshot) => ledgerWorkerIds.has(snapshot.workerId));
    if (ledger.rows.length > 0 && existingSnapshots.length === ledger.rows.length && existingSnapshots.every((snapshot) => snapshot.locked)) {
      return {
        success: true,
        data: {
          finalized: true,
          alreadyLocked: true,
          workDate: ledger.workDate,
          lockedRows: existingSnapshots.length,
          payrollInputs: [],
          snapshots: existingSnapshots,
        },
        commandId: command.commandId,
        correlationId: command.correlationId,
        aggregateId: command.commandId,
        newState: 'LOCKED',
        newVersion: 0,
        allowedNextActions: [],
        eventsEmitted: ['AttendanceDailyLedgerAlreadyLocked'],
        auditRecordId: command.commandId,
        fieldAccessDecisions: {},
      } as CommandResult<unknown>;
    }

    const openCorrections = [
      ...await this.correctionRepo.findQueue(command.tenantId, { workDate: ledger.workDate, status: 'PENDING_MANAGER_REVIEW' }),
      ...await this.correctionRepo.findQueue(command.tenantId, { workDate: ledger.workDate, status: 'APPROVED' }),
    ].filter((request) => ledgerWorkerIds.has(request.workerId));
    if (openCorrections.length > 0) {
      return {
        success: true,
        data: {
          finalized: false,
          workDate: ledger.workDate,
          blockedRows: [],
          blockedCorrections: openCorrections.map((request) => ({
            id: request.id,
            workerId: request.workerId,
            correctionType: request.correctionType,
            status: request.status,
            reason: request.reason,
          })),
        },
        commandId: command.commandId,
        correlationId: command.correlationId,
        aggregateId: command.commandId,
        newState: 'BLOCKED',
        newVersion: 0,
        allowedNextActions: ['FinalizeAttendanceDailyLedger'],
        eventsEmitted: ['AttendanceDailyLedgerFinalizationBlocked'],
        auditRecordId: command.commandId,
        fieldAccessDecisions: {},
      } as CommandResult<unknown>;
    }

    const result = this.finalization.finalizeDailyLedger(ledger, {
      tenantId: command.tenantId.value,
      lockedBy: command.actor.actorId.value,
      payrollCycleId: payload.payrollCycleId,
      currency: payload.currency ?? 'EGP',
    });

    if (!result.canFinalize) {
      return {
        success: true,
        data: {
          finalized: false,
          workDate: ledger.workDate,
          blockedRows: result.blockedRows.map((row) => ({
            workerId: row.worker.workerId,
            employeeId: row.worker.employeeId,
            name: row.worker.name,
            status: row.status,
            exceptions: row.exceptions.map((exception) => exception.code),
          })),
        },
        commandId: command.commandId,
        correlationId: command.correlationId,
        aggregateId: command.commandId,
        newState: 'BLOCKED',
        newVersion: 0,
        allowedNextActions: ['FinalizeAttendanceDailyLedger'],
        eventsEmitted: ['AttendanceDailyLedgerFinalizationBlocked'],
        auditRecordId: command.commandId,
        fieldAccessDecisions: {},
      } as CommandResult<unknown>;
    }

    const savedSnapshots = await this.dailyLedgerRepo.saveMany(result.snapshots);
    return {
      success: true,
      data: {
        finalized: true,
        workDate: ledger.workDate,
        lockedRows: savedSnapshots.length,
        payrollInputs: result.payrollInputs,
        snapshots: savedSnapshots,
      },
      commandId: command.commandId,
      correlationId: command.correlationId,
      aggregateId: command.commandId,
      newState: 'LOCKED',
      newVersion: 0,
      allowedNextActions: [],
      eventsEmitted: ['AttendanceDailyLedgerFinalized'],
      auditRecordId: command.commandId,
      fieldAccessDecisions: {},
    } as CommandResult<unknown>;
  }
}

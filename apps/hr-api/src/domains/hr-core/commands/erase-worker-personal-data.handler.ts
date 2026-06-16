import { Injectable } from '@nestjs/common';
import { CommandHandler } from '../../../platform/command-bus/command-handler.decorator.js';
import type { HrCommandEnvelope, CommandResult } from '@hcm/command-contracts';
import type { EraseWorkerPersonalDataPayload } from '@hcm/command-contracts';
import { Uuid, NotFoundError } from '@hcm/shared-kernel';
import { WorkerRepository } from '../repositories/worker.repository.js';
import { PersonalDataRecordRepository } from '../repositories/personal-data-record.repository.js';
import type { DataCategory } from '../aggregates/personal-data-record.aggregate.js';
import { LegalHoldGuard } from '../../compliance/services/legal-hold-guard.service.js';

/**
 * Handler for the EraseWorkerPersonalData command (right-to-erasure / GDPR).
 *
 * Enforces governance: the erasure is rejected (409 Conflict) when the worker is
 * under an active legal hold. Otherwise every matching personal data record is
 * deleted via the aggregate, clearing any encrypted payload reference.
 */
@CommandHandler('EraseWorkerPersonalData')
@Injectable()
export class EraseWorkerPersonalDataHandler {
  constructor(
    private readonly workerRepo: WorkerRepository,
    private readonly personalDataRepo: PersonalDataRecordRepository,
    private readonly legalHoldGuard: LegalHoldGuard,
  ) {}

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>> {
    const payload = command.payload as EraseWorkerPersonalDataPayload;
    const workerId = payload.workerId instanceof Uuid ? payload.workerId : new Uuid(String(payload.workerId));

    const worker = await this.workerRepo.findByIdForTenant(workerId, command.tenantId);
    if (!worker) {
      throw new NotFoundError('Worker not found');
    }

    // Governance gate: refuse erasure while a legal hold is active.
    await this.legalHoldGuard.assertNotUnderHold(workerId, command.tenantId, 'erase personal data');

    const records = await this.personalDataRepo.findByWorkerForTenant(workerId, command.tenantId);
    const categoryFilter = payload.dataCategories
      ? new Set(payload.dataCategories as DataCategory[])
      : undefined;

    const erasedCategories: string[] = [];
    const eventsEmitted: string[] = [];

    for (const record of records) {
      if (categoryFilter && !categoryFilter.has(record.dataCategory)) continue;
      if (record.state === 'DELETED') continue;
      record.deleteWithConsent(command.correlationId);
      await this.personalDataRepo.save(record);
      erasedCategories.push(record.dataCategory);
      eventsEmitted.push(...record.domainEvents.map((e) => e.eventName));
    }

    return {
      success: true,
      data: { workerId: workerId.value, erasedCategories },
      commandId: command.commandId,
      correlationId: command.correlationId,
      aggregateId: workerId,
      newState: 'ERASED',
      newVersion: worker.aggregateVersion,
      allowedNextActions: [],
      fieldAccessDecisions: {},
      eventsEmitted,
      auditRecordId: command.commandId,
    } as CommandResult<unknown>;
  }
}

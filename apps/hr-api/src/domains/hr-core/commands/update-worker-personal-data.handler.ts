import { Injectable } from '@nestjs/common';
import { CommandHandler } from '../../../platform/command-bus/command-handler.decorator.js';
import type { HrCommandEnvelope, CommandResult } from '@hcm/command-contracts';
import { UpdateWorkerPersonalDataPayload } from '@hcm/command-contracts';
import { Uuid, Email, NotFoundError } from '@hcm/shared-kernel';
import { FsmFramework } from '../../../platform/workflow/fsm-framework.js';
import { WorkerRepository } from '../repositories/worker.repository.js';
import { PersonalDataRecordRepository } from '../repositories/personal-data-record.repository.js';
import { PersonalDataRecord } from '../aggregates/personal-data-record.aggregate.js';
import { WorkerEventsPublisher } from '../events/worker-events.publisher.js';

/**
 * Handler for the UpdateWorkerPersonalData command.
 */
@CommandHandler('UpdateWorkerPersonalData')
@Injectable()
export class UpdateWorkerPersonalDataHandler {
  constructor(
    private readonly workerRepo: WorkerRepository,
    private readonly personalDataRepo: PersonalDataRecordRepository,
    private readonly fsm: FsmFramework,
    private readonly eventPublisher: WorkerEventsPublisher,
  ) {}

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>> {
    const payload = command.payload as UpdateWorkerPersonalDataPayload;

    const worker = await this.workerRepo.findById(payload.workerId);
    if (!worker) {
      throw new NotFoundError('Worker not found');
    }

    const email = payload.email ? new Email(payload.email) : undefined;

    worker.updatePersonalData(
      {
        firstName: payload.firstName,
        lastName: payload.lastName,
        email,
      },
      command.correlationId,
    );
    await this.workerRepo.save(worker);

    let record = await this.personalDataRepo.findByWorkerAndCategory(worker.id, 'BASIC');
    const extraFields: Record<string, unknown> = {};
    if (payload.phoneNumber) extraFields.phoneNumber = payload.phoneNumber;
    if (payload.dateOfBirth) extraFields.dateOfBirth = payload.dateOfBirth.toISOString();

    if (record) {
      if (Object.keys(extraFields).length > 0) {
        record.update(extraFields, command.correlationId);
        await this.personalDataRepo.save(record);
      }
    } else if (Object.keys(extraFields).length > 0) {
      record = PersonalDataRecord.create(
        {
          id: Uuid.generate(),
          tenantId: command.tenantId,
          workerId: worker.id,
          dataCategory: 'BASIC',
          dataClassification: 'CONFIDENTIAL',
          payload: extraFields,
          consentStatus: 'GRANTED',
          state: 'DRAFT',
        },
        command.correlationId,
      );
      await this.personalDataRepo.save(record);
    }

    await this.eventPublisher.publishFromAggregate(worker);

    return {
      success: true,
      data: { workerId: worker.id.value },
      commandId: command.commandId,
      correlationId: command.correlationId,
      aggregateId: worker.id,
      newState: worker.status,
      newVersion: worker.aggregateVersion,
      allowedNextActions: this.fsm.getAllowedActionsFromState(worker.status, 'WorkerProfile'),
      fieldAccessDecisions: {},
      eventsEmitted: worker.domainEvents.map((e) => e.eventName),
      auditRecordId: command.commandId,
    } as CommandResult<unknown>;
  }
}

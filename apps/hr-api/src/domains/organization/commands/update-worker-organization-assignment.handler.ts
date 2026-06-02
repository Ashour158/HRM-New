import { Injectable } from '@nestjs/common';
import { CommandHandler } from '../../../platform/command-bus/command-handler.decorator.js';
import type { CommandHandler as ICommandHandler } from '../../../platform/command-bus/command-bus.js';
import type { HrCommandEnvelope, CommandResult } from '@hcm/command-contracts';
import type { Uuid } from '@hcm/shared-kernel';
import { WorkerRepository } from '../../hr-core/repositories/worker.repository.js';

type UpdateWorkerOrganizationAssignmentPayload = {
  workerId: Uuid;
  legalEntityId?: Uuid | null;
  departmentId?: Uuid | null;
  managerId?: Uuid | null;
  jobTitle?: string | null;
};

@Injectable()
@CommandHandler('UpdateWorkerOrganizationAssignment')
export class UpdateWorkerOrganizationAssignmentHandler implements ICommandHandler {
  commandName = 'UpdateWorkerOrganizationAssignment' as const;

  constructor(private readonly workerRepo: WorkerRepository) {}

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>> {
    const payload = command.payload as UpdateWorkerOrganizationAssignmentPayload;
    const worker = await this.workerRepo.findById(payload.workerId);
    if (!worker) {
      throw new Error('Worker not found');
    }
    if (worker.tenantId.value !== command.tenantId.value) {
      throw new Error('Worker belongs to a different tenant');
    }
    if (command.expectedVersion !== undefined && worker.aggregateVersion !== command.expectedVersion) {
      throw new Error(`Expected worker version ${command.expectedVersion}, found ${worker.aggregateVersion}`);
    }

    worker.updateJobInfo(
      {
        legalEntityId: payload.legalEntityId,
        departmentId: payload.departmentId,
        managerId: payload.managerId,
        jobTitle: payload.jobTitle,
      },
      command.correlationId,
    );
    await this.workerRepo.save(worker);

    const eventsEmitted = worker.domainEvents.map((event) => event.eventName);
    worker.clearDomainEvents();

    return {
      success: true,
      data: {
        workerId: worker.id.value,
        legalEntityId: worker.legalEntityId?.value ?? null,
        departmentId: worker.departmentId?.value ?? null,
        managerId: worker.managerId?.value ?? null,
        jobTitle: worker.jobTitle ?? null,
      },
      commandId: command.commandId,
      correlationId: command.correlationId,
      aggregateId: worker.id,
      newState: worker.status,
      newVersion: worker.aggregateVersion,
      allowedNextActions: [],
      fieldAccessDecisions: {},
      eventsEmitted,
      auditRecordId: command.commandId,
    };
  }
}

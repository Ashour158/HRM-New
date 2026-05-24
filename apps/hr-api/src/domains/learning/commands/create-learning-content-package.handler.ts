import { Injectable } from '@nestjs/common';
import { CommandHandler } from '../../../platform/command-bus/command-handler.decorator.js';
import type { HrCommandEnvelope, CommandResult } from '@hcm/command-contracts';
import { Uuid } from '@hcm/shared-kernel';
import { FsmFramework } from '../../../platform/workflow/fsm-framework.js';
import { LearningContentPackage } from '../aggregates/learning-content-package.aggregate.js';
import { LearningContentPackageRepository } from '../repositories/learning-content-package.repository.js';
import { LearningEventsPublisher } from '../events/learning-events.publisher.js';

@CommandHandler('CreateLearningContentPackage')
@Injectable()
export class CreateLearningContentPackageHandler {
  constructor(
    private readonly repo: LearningContentPackageRepository,
    private readonly fsm: FsmFramework,
    private readonly publisher: LearningEventsPublisher,
  ) {}

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>> {
    const payload = command.payload as {
      packageType: 'SCORM_1_2' | 'SCORM_2004' | 'XAPI';
      title: string;
      version?: string;
      fileUrl?: string;
      manifest?: Record<string, unknown>;
    };
    const ar = LearningContentPackage.create(
      {
        id: Uuid.generate(),
        tenantId: command.tenantId,
        packageType: payload.packageType,
        title: payload.title,
        packageVersion: payload.version,
        fileUrl: payload.fileUrl,
        manifest: payload.manifest,
      },
      command.correlationId,
    );
    await this.repo.save(ar);
    await this.publisher.publishFromAggregate(ar);
    return {
      success: true,
      data: { learningContentPackageId: ar.id.value, status: ar.status },
      commandId: command.commandId,
      correlationId: command.correlationId,
      aggregateId: ar.id,
      newState: ar.status,
      newVersion: ar.aggregateVersion,
      allowedNextActions: this.fsm.getAllowedActionsFromState(ar.status, 'LearningContentPackage'),
      eventsEmitted: ar.domainEvents.map((e) => e.eventName),
      auditRecordId: command.commandId,
    } as CommandResult<unknown>;
  }
}

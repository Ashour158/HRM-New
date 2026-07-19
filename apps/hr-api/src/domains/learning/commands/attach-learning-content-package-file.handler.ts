import { Injectable } from '@nestjs/common';
import { CommandHandler } from '../../../platform/command-bus/command-handler.decorator.js';
import type { HrCommandEnvelope, CommandResult } from '@hcm/command-contracts';
import { Uuid } from '@hcm/shared-kernel';
import { FsmFramework } from '../../../platform/workflow/fsm-framework.js';
import { LearningContentPackageRepository } from '../repositories/learning-content-package.repository.js';
import { LearningEventsPublisher } from '../events/learning-events.publisher.js';

@CommandHandler('AttachLearningContentPackageFile')
@Injectable()
export class AttachLearningContentPackageFileHandler {
  constructor(
    private readonly repo: LearningContentPackageRepository,
    private readonly fsm: FsmFramework,
    private readonly publisher: LearningEventsPublisher,
  ) {}

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>> {
    const payload = command.payload as {
      learningContentPackageId: Uuid;
      fileUrl: string;
      checksum: string;
      sizeBytes: number;
      mimeType: string;
      originalFileName: string;
    };
    const ar = await this.repo.findById(payload.learningContentPackageId);
    if (!ar) throw new Error('Content package not found');

    ar.attachFile({
      fileUrl: payload.fileUrl,
      checksum: payload.checksum,
      sizeBytes: payload.sizeBytes,
      mimeType: payload.mimeType,
      originalFileName: payload.originalFileName,
    }, command.correlationId);
    await this.repo.save(ar);
    await this.publisher.publishFromAggregate(ar);
    return {
      success: true,
      data: {
        learningContentPackageId: ar.id.value,
        status: ar.status,
        fileUrl: ar.fileUrl,
        checksum: ar.checksum,
        sizeBytes: ar.sizeBytes,
      },
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

import { Injectable } from '@nestjs/common';
import { CommandHandler } from '../../../platform/command-bus/command-handler.decorator.js';
import type { HrCommandEnvelope, CommandResult } from '@hcm/command-contracts';
import { Uuid, ValidationError } from '@hcm/shared-kernel';
import { FsmFramework } from '../../../platform/workflow/fsm-framework.js';
import { LearningContentPackageRepository } from '../repositories/learning-content-package.repository.js';
import { LearningEventsPublisher } from '../events/learning-events.publisher.js';
import { parseLearningContentManifest, validateLearningContentPackage } from '../learning-content-validation.js';

@CommandHandler('ValidateLearningContentPackage')
@Injectable()
export class ValidateLearningContentPackageHandler {
  constructor(
    private readonly repo: LearningContentPackageRepository,
    private readonly fsm: FsmFramework,
    private readonly publisher: LearningEventsPublisher,
  ) {}

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>> {
    const payload = command.payload as { learningContentPackageId: Uuid };
    const ar = await this.repo.findById(payload.learningContentPackageId);
    if (!ar) throw new Error('Content package not found');

    // Real content validation. There is no VALIDATION_FAILED state in this FSM, so an
    // invalid package fails the command (fail-closed) rather than advancing to VALIDATED.
    const parsed = (ar.manifest?.parsed as ReturnType<typeof parseLearningContentManifest> | undefined)
      ?? parseLearningContentManifest(ar.packageType, ar.manifest);
    const result = validateLearningContentPackage({
      packageType: ar.packageType,
      fileUrl: ar.fileUrl,
      parsed,
    });
    if (!result.valid) {
      throw new ValidationError(
        `Content package validation failed: ${result.violations.filter((v) => v.severity === 'ERROR').map((v) => v.code).join(', ')}`,
      );
    }
    // Record the validation outcome (incl. any non-blocking warnings) on the manifest.
    ar.manifest = { ...(ar.manifest ?? {}), validation: { decisionCode: result.decisionCode, violations: result.violations } };
    ar.validate(command.correlationId);
    await this.repo.save(ar);
    await this.publisher.publishFromAggregate(ar);
    return {
      success: true,
      data: { learningContentPackageId: ar.id.value, status: ar.status, decisionCode: result.decisionCode, violations: result.violations },
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

import { Injectable } from '@nestjs/common';
import { CommandHandler } from '../../../platform/command-bus/command-handler.decorator.js';
import type { HrCommandEnvelope, CommandResult } from '@hcm/command-contracts';
import { Uuid } from '@hcm/shared-kernel';
import { FsmFramework } from '../../../platform/workflow/fsm-framework.js';
import { toDate, toStringArray, toUuid } from '../../common/uuid-normalizer.js';
import { MisclassificationAssessment } from '../aggregates/misclassification-assessment.aggregate.js';
import { MisclassificationAssessmentRepository } from '../repositories/misclassification-assessment.repository.js';
import { ContingentWorkforceEventsPublisher } from '../events/contingent-workforce-events.publisher.js';

@CommandHandler('CreateMisclassificationAssessment')
@Injectable()
export class CreateMisclassificationAssessmentHandler {
  constructor(
    private readonly repo: MisclassificationAssessmentRepository,
    private readonly fsm: FsmFramework,
    private readonly publisher: ContingentWorkforceEventsPublisher,
  ) {}

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>> {
    const payload = command.payload as { workerId: Uuid | string; assessmentDate: Date | string; riskScore?: number; riskFactors?: string[] };
    const ar = MisclassificationAssessment.create({
      id: Uuid.generate(),
      tenantId: command.tenantId,
      workerId: toUuid(payload.workerId),
      assessmentDate: toDate(payload.assessmentDate),
      riskScore: payload.riskScore,
      riskFactors: toStringArray(payload.riskFactors),
    }, command.correlationId);
    await this.repo.save(ar);
    await this.publisher.publishFromAggregate(ar);
    return {
      success: true,
      data: { misclassificationAssessmentId: ar.id.value, status: ar.status },
      commandId: command.commandId,
      correlationId: command.correlationId,
      aggregateId: ar.id,
      newState: ar.status,
      newVersion: ar.aggregateVersion,
      allowedNextActions: this.fsm.getAllowedActionsFromState(ar.status, 'MisclassificationAssessment'),
      eventsEmitted: ar.domainEvents.map((e) => e.eventName),
      auditRecordId: command.commandId,
    } as CommandResult<unknown>;
  }
}

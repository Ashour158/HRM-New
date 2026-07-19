import { Injectable } from '@nestjs/common';
import { CommandHandler } from '../../../platform/command-bus/command-handler.decorator.js';
import type { HrCommandEnvelope, CommandResult } from '@hcm/command-contracts';
import { NotFoundError, Uuid } from '@hcm/shared-kernel';
import { FsmFramework } from '../../../platform/workflow/fsm-framework.js';
import { toUuid } from '../../common/uuid-normalizer.js';
import { MisclassificationAssessmentRepository } from '../repositories/misclassification-assessment.repository.js';
import { ContingentWorkforceEventsPublisher } from '../events/contingent-workforce-events.publisher.js';
import type { MisclassificationFactorInputs } from '../services/misclassification-scoring.js';

/**
 * Recalculates riskScore/riskFactors from an updated set of structured IRS
 * common-law factor inputs while the assessment is IN_PROGRESS. This is the
 * only supported way to change the score after creation — the aggregate
 * itself derives riskScore/riskFactors from factorInputs, it never accepts
 * them directly.
 */
@CommandHandler('RecalculateMisclassificationScore')
@Injectable()
export class RecalculateMisclassificationScoreHandler {
  constructor(
    private readonly repo: MisclassificationAssessmentRepository,
    private readonly fsm: FsmFramework,
    private readonly publisher: ContingentWorkforceEventsPublisher,
  ) {}

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>> {
    const payload = command.payload as { misclassificationAssessmentId: Uuid | string; factorInputs: MisclassificationFactorInputs };
    const ar = await this.repo.findById(toUuid(payload.misclassificationAssessmentId));
    if (!ar) throw new NotFoundError('Misclassification assessment not found');
    ar.recalculateScore(payload.factorInputs, command.correlationId);
    await this.repo.save(ar);
    await this.publisher.publishFromAggregate(ar);
    return {
      success: true,
      data: { misclassificationAssessmentId: ar.id.value, status: ar.status, riskScore: ar.riskScore, riskFactors: ar.riskFactors },
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

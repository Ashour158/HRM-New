import { Injectable, NotFoundException } from '@nestjs/common';
import { CommandHandler } from '../../../platform/command-bus/command-handler.decorator.js';
import type { HrCommandEnvelope, CommandResult } from '@hcm/command-contracts';
import { Uuid } from '@hcm/shared-kernel';
import { FsmFramework } from '../../../platform/workflow/fsm-framework.js';
import { RequisitionAdverseImpactAnalysisRepository } from '../repositories/requisition-adverse-impact-analysis.repository.js';
import { RecruitingEventsPublisher } from '../events/recruiting-events.publisher.js';

export interface ReviewRequisitionAdverseImpactAnalysisPayload {
  analysisId: string;
  reviewedBy: string;
  reviewNotes?: string;
}

@Injectable()
@CommandHandler('ReviewRequisitionAdverseImpactAnalysis')
export class ReviewRequisitionAdverseImpactAnalysisHandler {
  constructor(
    private readonly analysisRepo: RequisitionAdverseImpactAnalysisRepository,
    private readonly fsm: FsmFramework,
    private readonly eventPublisher: RecruitingEventsPublisher,
  ) {}

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>> {
    const payload = command.payload as ReviewRequisitionAdverseImpactAnalysisPayload;

    const analysis = await this.analysisRepo.findById(new Uuid(payload.analysisId));
    if (!analysis) {
      throw new NotFoundException('Adverse-impact analysis not found');
    }

    analysis.review(new Uuid(payload.reviewedBy), command.correlationId, payload.reviewNotes);
    await this.analysisRepo.save(analysis);
    await this.eventPublisher.publishUncommitted(analysis, command.tenantId, command.correlationId);

    return {
      success: true,
      data: { analysisId: analysis.id.value, status: analysis.status },
      commandId: command.commandId,
      correlationId: command.correlationId,
      aggregateId: analysis.id,
      newState: analysis.status,
      newVersion: analysis.aggregateVersion,
      allowedNextActions: this.fsm.getAllowedActionsFromState(analysis.status, 'RequisitionAdverseImpactAnalysis'),
      fieldAccessDecisions: {},
      eventsEmitted: analysis.domainEvents.map((e) => e.eventName),
      auditRecordId: Uuid.generate(),
    };
  }
}

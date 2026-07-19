import { Injectable, NotFoundException } from '@nestjs/common';
import { CommandHandler } from '../../../platform/command-bus/command-handler.decorator.js';
import type { HrCommandEnvelope, CommandResult } from '@hcm/command-contracts';
import { Uuid } from '@hcm/shared-kernel';
import {
  evaluateRequisitionAdverseImpact,
  type EeoDemographicDimension,
  type FunnelStageGroupCounts,
  type FunnelStageInput,
} from '@hcm/policy-engines';
import { FsmFramework } from '../../../platform/workflow/fsm-framework.js';
import { JobRequisitionRepository } from '../repositories/job-requisition.repository.js';
import { CandidateRepository } from '../repositories/candidate.repository.js';
import { InterviewPlanRepository } from '../repositories/interview-plan.repository.js';
import { OfferRepository } from '../repositories/offer.repository.js';
import { RequisitionAdverseImpactAnalysisRepository } from '../repositories/requisition-adverse-impact-analysis.repository.js';
import { RequisitionAdverseImpactAnalysis } from '../aggregates/requisition-adverse-impact-analysis.aggregate.js';
import { RecruitingEventsPublisher } from '../events/recruiting-events.publisher.js';
import type { Candidate, CandidateEeoSelfIdentification } from '../aggregates/candidate.aggregate.js';

export interface AnalyzeRequisitionAdverseImpactPayload {
  analysisId: string;
  requisitionId: string;
  dimension: EeoDemographicDimension;
  smallCellThreshold?: number;
}

/**
 * Runs an EEOC 4/5ths-rule adverse-impact analysis for a requisition's
 * candidate funnel across two stages:
 *
 *  1. APPLIED_TO_INTERVIEWED — every candidate on the requisition vs. those
 *     with at least one interview plan (a persistent record independent of
 *     the candidate's eventual final status).
 *  2. INTERVIEWED_TO_OFFERED — interviewed candidates vs. those who also
 *     received an offer.
 *
 * Candidates grouped by the requested EEO dimension only when they
 * voluntarily provided that self-identification field (and did not decline
 * to self-identify) — candidates with no self-ID data for the dimension are
 * excluded from every group's counts, never bucketed into a benchmark or
 * flagged group.
 *
 * OUT OF SCOPE: pay-equity analysis on offers (see the separate
 * offer-compensation engine); EEO-1/VETS-4212 report generation.
 */
@Injectable()
@CommandHandler('AnalyzeRequisitionAdverseImpact')
export class AnalyzeRequisitionAdverseImpactHandler {
  constructor(
    private readonly requisitionRepo: JobRequisitionRepository,
    private readonly candidateRepo: CandidateRepository,
    private readonly interviewPlanRepo: InterviewPlanRepository,
    private readonly offerRepo: OfferRepository,
    private readonly analysisRepo: RequisitionAdverseImpactAnalysisRepository,
    private readonly fsm: FsmFramework,
    private readonly eventPublisher: RecruitingEventsPublisher,
  ) {}

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>> {
    const payload = command.payload as AnalyzeRequisitionAdverseImpactPayload;
    const requisitionId = new Uuid(payload.requisitionId);

    // Tenant-scoped: a cross-tenant requisitionId must yield "not found",
    // not another tenant's requisition (and, via the FK-scoped queries
    // below, not another tenant's candidate/interview/offer data either).
    const requisition = await this.requisitionRepo.findByIdForTenant(requisitionId, command.tenantId);
    if (!requisition) {
      throw new NotFoundException('Job requisition not found');
    }

    const [candidates, interviewPlans, offers] = await Promise.all([
      this.candidateRepo.findByRequisitionForTenant(requisitionId, command.tenantId),
      this.interviewPlanRepo.findByRequisitionForTenant(requisitionId, command.tenantId),
      this.offerRepo.findByRequisitionForTenant(requisitionId, command.tenantId),
    ]);

    const interviewedCandidateIds = new Set(interviewPlans.map((p) => p.candidateId.value));
    const offeredCandidateIds = new Set(offers.map((o) => o.candidateId.value));

    const interviewedCandidates = candidates.filter((c) => interviewedCandidateIds.has(c.id.value));

    const stages: FunnelStageInput[] = [
      {
        stageName: 'APPLIED_TO_INTERVIEWED',
        groups: groupCounts(candidates, interviewedCandidateIds, payload.dimension),
      },
      {
        stageName: 'INTERVIEWED_TO_OFFERED',
        groups: groupCounts(interviewedCandidates, offeredCandidateIds, payload.dimension),
      },
    ];

    const engineResult = evaluateRequisitionAdverseImpact({
      requisitionId: requisitionId.value,
      dimension: payload.dimension,
      stages,
      smallCellThreshold: payload.smallCellThreshold,
    });

    const analysis = RequisitionAdverseImpactAnalysis.analyze(
      {
        id: new Uuid(payload.analysisId),
        tenantId: command.tenantId,
        requisitionId,
        result: engineResult,
      },
      command.correlationId,
    );

    await this.analysisRepo.save(analysis);
    await this.eventPublisher.publishUncommitted(analysis, command.tenantId, command.correlationId);

    return {
      success: true,
      data: {
        analysisId: analysis.id.value,
        decisionCode: analysis.decisionCode,
        flaggedStageCount: analysis.flaggedStageCount,
        status: analysis.status,
      },
      commandId: command.commandId,
      correlationId: command.correlationId,
      aggregateId: analysis.id,
      newState: analysis.status,
      newVersion: analysis.aggregateVersion,
      allowedNextActions: this.fsm.getAllowedActionsFromState(analysis.status, 'RequisitionAdverseImpactAnalysis'),
      fieldAccessDecisions: {},
      eventsEmitted: ['RequisitionAdverseImpactAnalysisCreated'],
      auditRecordId: Uuid.generate(),
    };
  }
}

/** Exported for unit testing (see analyze-requisition-adverse-impact.handler.test.ts). */
export function eeoGroupValue(
  candidate: Candidate,
  dimension: EeoDemographicDimension,
): string | undefined {
  const eeo: CandidateEeoSelfIdentification | undefined = candidate.eeoSelfIdentification;
  if (!eeo || eeo.declinedToSelfIdentify) return undefined;
  switch (dimension) {
    case 'RACE_ETHNICITY':
      return eeo.raceEthnicity;
    case 'GENDER_IDENTITY':
      return eeo.genderIdentity;
    case 'VETERAN_STATUS':
      return eeo.veteranStatus;
    case 'DISABILITY_STATUS':
      return eeo.disabilityStatus;
    default:
      return undefined;
  }
}

/** Exported for unit testing (see analyze-requisition-adverse-impact.handler.test.ts). */
export function groupCounts(
  candidatesAtStage: Candidate[],
  advancedIds: Set<string>,
  dimension: EeoDemographicDimension,
): FunnelStageGroupCounts[] {
  const byGroup = new Map<string, { consideredCount: number; advancedCount: number }>();

  for (const candidate of candidatesAtStage) {
    const group = eeoGroupValue(candidate, dimension);
    if (!group) continue; // no voluntary self-ID provided for this dimension — excluded from analysis

    const entry = byGroup.get(group) ?? { consideredCount: 0, advancedCount: 0 };
    entry.consideredCount += 1;
    if (advancedIds.has(candidate.id.value)) entry.advancedCount += 1;
    byGroup.set(group, entry);
  }

  return Array.from(byGroup.entries()).map(([group, counts]) => ({ group, ...counts }));
}

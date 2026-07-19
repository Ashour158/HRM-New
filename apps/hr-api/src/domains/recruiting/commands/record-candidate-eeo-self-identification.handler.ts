import { Injectable, NotFoundException } from '@nestjs/common';
import { CommandHandler } from '../../../platform/command-bus/command-handler.decorator.js';
import type { HrCommandEnvelope, CommandResult } from '@hcm/command-contracts';
import { Uuid } from '@hcm/shared-kernel';
import { FsmFramework } from '../../../platform/workflow/fsm-framework.js';
import { CandidateRepository } from '../repositories/candidate.repository.js';
import { RecruitingEventsPublisher } from '../events/recruiting-events.publisher.js';

/**
 * Voluntary EEO self-identification fields — every field is optional. This is
 * the ONLY command permitted to write `Candidate.eeoSelfIdentification`; it
 * is not bundled into SubmitCandidateApplication because self-ID must remain
 * a separate, voluntary step, never a mandatory part of applying.
 *
 * Write access is restricted at the command-bus layer
 * (`SENSITIVE_FIELD_RULES['candidate.eeoSelfIdentification']` in
 * platform/command-bus/command-bus.ts) to compliance/HR-admin roles and
 * system/service-account intake flows (e.g. a public careers-site self-ID
 * form) — RECRUITER cannot submit this on a candidate's behalf.
 */
export interface RecordCandidateEeoSelfIdentificationPayload {
  candidateId: string;
  raceEthnicity?: string;
  genderIdentity?: string;
  veteranStatus?: string;
  disabilityStatus?: string;
  declinedToSelfIdentify?: boolean;
}

@Injectable()
@CommandHandler('RecordCandidateEeoSelfIdentification')
export class RecordCandidateEeoSelfIdentificationHandler {
  constructor(
    private readonly candidateRepo: CandidateRepository,
    private readonly fsm: FsmFramework,
    private readonly eventPublisher: RecruitingEventsPublisher,
  ) {}

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>> {
    const payload = command.payload as RecordCandidateEeoSelfIdentificationPayload;

    const candidate = await this.candidateRepo.findById(new Uuid(payload.candidateId));
    if (!candidate) {
      throw new NotFoundException('Candidate not found');
    }

    candidate.recordEeoSelfIdentification(
      {
        raceEthnicity: payload.raceEthnicity,
        genderIdentity: payload.genderIdentity,
        veteranStatus: payload.veteranStatus,
        disabilityStatus: payload.disabilityStatus,
        declinedToSelfIdentify: payload.declinedToSelfIdentify,
      },
      command.correlationId,
    );

    await this.candidateRepo.save(candidate);
    await this.eventPublisher.publishUncommitted(candidate, command.tenantId, command.correlationId);

    return {
      success: true,
      data: { candidateId: candidate.id.value, recorded: true },
      commandId: command.commandId,
      correlationId: command.correlationId,
      aggregateId: candidate.id,
      newState: candidate.status,
      newVersion: candidate.aggregateVersion,
      allowedNextActions: this.fsm.getAllowedActionsFromState(candidate.status, 'Candidate'),
      fieldAccessDecisions: {},
      eventsEmitted: ['CandidateEeoSelfIdentificationRecorded'],
      auditRecordId: Uuid.generate(),
    };
  }
}

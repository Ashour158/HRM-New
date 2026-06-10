import { Injectable } from '@nestjs/common';
import { CommandHandler } from '../../../platform/command-bus/command-handler.decorator.js';
import type { CommandHandler as ICommandHandler } from '../../../platform/command-bus/command-bus.js';
import type { HrCommandEnvelope, CommandResult } from '@hcm/command-contracts';
import { Uuid } from '@hcm/shared-kernel';
import { BenefitsEnrollmentRepository } from '../repositories/benefits-enrollment.repository.js';
import { BenefitsEnrollmentFsm } from '../fsm/benefits-enrollment.fsm.js';
import { BenefitsEventsPublisher } from '../events/benefits-events.publisher.js';

@Injectable()
@CommandHandler('MakeEffectiveBenefitsEnrollment')
export class MakeEffectiveBenefitsEnrollmentHandler implements ICommandHandler {
  commandName = 'MakeEffectiveBenefitsEnrollment' as const;

  constructor(
    private readonly repo: BenefitsEnrollmentRepository,
    private readonly publisher: BenefitsEventsPublisher,
    private readonly fsm: BenefitsEnrollmentFsm,
  ) {}

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>> {
    const payload = command.payload as { enrollmentId: Uuid };
    const enrollment = await this.repo.findById(payload.enrollmentId);
    if (!enrollment) throw new Error('BenefitsEnrollment not found');

    enrollment.makeEffective(command.correlationId);
    await this.repo.save(enrollment);
    const eventsEmitted = enrollment.domainEvents.map((e) => e.eventName);
    await this.publisher.publishAll(enrollment, command);

    return {
      success: true,
      data: {
        enrollmentId: enrollment.id.value,
        workerId: enrollment.workerId.value,
        programId: enrollment.programId.value,
        status: enrollment.status,
      },
      commandId: command.commandId,
      correlationId: command.correlationId,
      aggregateId: enrollment.id,
      newState: enrollment.status,
      newVersion: enrollment.aggregateVersion,
      allowedNextActions: this.fsm.getAllowedActions(enrollment.status),
      fieldAccessDecisions: {},
      eventsEmitted,
      auditRecordId: command.commandId,
    };
  }
}

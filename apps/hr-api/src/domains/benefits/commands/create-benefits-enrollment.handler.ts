import { Injectable } from '@nestjs/common';
import { CommandHandler } from '../../../platform/command-bus/command-handler.decorator.js';
import type { CommandHandler as ICommandHandler } from '../../../platform/command-bus/command-bus.js';
import type { HrCommandEnvelope, CommandResult } from '@hcm/command-contracts';
import { Uuid } from '@hcm/shared-kernel';
import { BenefitsEnrollmentRepository } from '../repositories/benefits-enrollment.repository.js';
import { BenefitsProgramRepository } from '../repositories/benefits-program.repository.js';
import { BenefitsEnrollment, type DependentEntry } from '../aggregates/benefits-enrollment.aggregate.js';
import { BenefitsEnrollmentFsm } from '../fsm/benefits-enrollment.fsm.js';
import { BenefitsEventsPublisher } from '../events/benefits-events.publisher.js';

/**
 * Command handler for creating a new BenefitsEnrollment.
 */
@Injectable()
@CommandHandler('CreateBenefitsEnrollment')
export class CreateBenefitsEnrollmentHandler implements ICommandHandler {
  commandName = 'CreateBenefitsEnrollment' as const;

  constructor(
    private readonly repo: BenefitsEnrollmentRepository,
    private readonly programRepo: BenefitsProgramRepository,
    private readonly publisher: BenefitsEventsPublisher,
    private readonly fsm: BenefitsEnrollmentFsm,
  ) {}

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>> {
    const payload = command.payload as {
      enrollmentId: Uuid;
      workerId: Uuid;
      programId: Uuid;
      coverageLevel: string;
      dependents: DependentEntry[];
      effectiveDate: Date;
    };

    const program = await this.programRepo.findById(payload.programId);
    if (!program) throw new Error('BenefitsProgram not found');

    // Snapshot the program's premium rate onto the enrollment at creation time so
    // the employee's contracted rate is stable even if the program's rate changes later.
    const enrollment = BenefitsEnrollment.create({
      id: payload.enrollmentId,
      tenantId: command.tenantId,
      workerId: payload.workerId,
      programId: payload.programId,
      coverageLevel: payload.coverageLevel,
      dependents: payload.dependents,
      effectiveDate: payload.effectiveDate,
      premiumAmount: program.monthlyPremium,
      currency: program.currency,
      correlationId: command.correlationId,
    });
    enrollment.submit(command.correlationId);

    await this.repo.save(enrollment);
    const eventsEmitted = enrollment.domainEvents.map((e) => e.eventName);
    await this.publisher.publishAll(enrollment, command);

    return {
      success: true,
      data: {
        enrollmentId: enrollment.id.value,
        workerId: enrollment.workerId.value,
        programId: enrollment.programId.value,
        premiumAmount: enrollment.premiumAmount,
        currency: enrollment.currency,
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

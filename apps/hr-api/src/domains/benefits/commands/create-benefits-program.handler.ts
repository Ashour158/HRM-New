import { Injectable } from '@nestjs/common';
import { CommandHandler } from '../../../platform/command-bus/command-handler.decorator.js';
import type { CommandHandler as ICommandHandler } from '../../../platform/command-bus/command-bus.js';
import type { HrCommandEnvelope, CommandResult } from '@hcm/command-contracts';
import { Uuid } from '@hcm/shared-kernel';
import { BenefitsProgramRepository } from '../repositories/benefits-program.repository.js';
import { BenefitsProgram } from '../aggregates/benefits-program.aggregate.js';
import { BenefitsProgramFsm } from '../fsm/benefits-program.fsm.js';
import { BenefitsEventsPublisher } from '../events/benefits-events.publisher.js';

/**
 * Command handler for creating a new BenefitsProgram.
 */
@Injectable()
@CommandHandler('CreateBenefitsProgram')
export class CreateBenefitsProgramHandler implements ICommandHandler {
  commandName = 'CreateBenefitsProgram' as const;

  constructor(
    private readonly repo: BenefitsProgramRepository,
    private readonly publisher: BenefitsEventsPublisher,
    private readonly fsm: BenefitsProgramFsm,
  ) {}

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>> {
    const payload = command.payload as {
      programId: Uuid;
      programName: string;
      programType: string;
      carrierId?: Uuid;
      effectiveFrom?: Date;
      effectiveUntil?: Date;
    };

    const program = BenefitsProgram.create({
      id: payload.programId,
      tenantId: command.tenantId,
      programName: payload.programName,
      programType: payload.programType,
      carrierId: payload.carrierId,
      effectiveFrom: payload.effectiveFrom,
      effectiveUntil: payload.effectiveUntil,
      correlationId: command.correlationId,
    });

    await this.repo.save(program);
    const eventsEmitted = program.domainEvents.map((e) => e.eventName);
    await this.publisher.publishAll(program, command);

    return {
      success: true,
      data: { programId: program.id.value, status: program.status },
      commandId: command.commandId,
      correlationId: command.correlationId,
      aggregateId: program.id,
      newState: program.status,
      newVersion: program.aggregateVersion,
      allowedNextActions: this.fsm.getAllowedActions(program.status),
      fieldAccessDecisions: {},
      eventsEmitted,
      auditRecordId: command.commandId,
    };
  }
}

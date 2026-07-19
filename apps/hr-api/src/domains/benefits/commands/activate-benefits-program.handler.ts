import { Injectable, NotFoundException } from '@nestjs/common';
import { CommandHandler } from '../../../platform/command-bus/command-handler.decorator.js';
import type { CommandHandler as ICommandHandler } from '../../../platform/command-bus/command-bus.js';
import type { HrCommandEnvelope, CommandResult } from '@hcm/command-contracts';
import { Uuid } from '@hcm/shared-kernel';
import { BenefitsProgramRepository } from '../repositories/benefits-program.repository.js';
import { BenefitsProgramFsm } from '../fsm/benefits-program.fsm.js';
import { BenefitsEventsPublisher } from '../events/benefits-events.publisher.js';

/**
 * Command handler for activating a BenefitsProgram (DRAFT|SUSPENDED -> ACTIVE).
 */
@Injectable()
@CommandHandler('ActivateBenefitsProgram')
export class ActivateBenefitsProgramHandler implements ICommandHandler {
  commandName = 'ActivateBenefitsProgram' as const;

  constructor(
    private readonly repo: BenefitsProgramRepository,
    private readonly publisher: BenefitsEventsPublisher,
    private readonly fsm: BenefitsProgramFsm,
  ) {}

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>> {
    const payload = command.payload as { benefitsProgramId: Uuid };
    const program = await this.repo.findById(payload.benefitsProgramId);
    if (!program) {
      throw new NotFoundException('BenefitsProgram not found');
    }

    program.activate(command.correlationId);
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

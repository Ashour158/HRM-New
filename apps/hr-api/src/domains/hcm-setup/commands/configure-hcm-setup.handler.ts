import { Injectable } from '@nestjs/common';
import { Uuid } from '@hcm/shared-kernel';
import type { CommandResult, HrCommandEnvelope } from '@hcm/command-contracts';
import { CommandHandler } from '../../../platform/command-bus/command-handler.decorator.js';
import type { CommandHandler as ICommandHandler } from '../../../platform/command-bus/command-bus.js';
import { HcmSetupService } from '../hcm-setup.service.js';
import type { HcmSetupConfig, HcmSetupUpdate } from '../hcm-setup.types.js';

@Injectable()
@CommandHandler('ConfigureHcmSetup')
export class ConfigureHcmSetupHandler implements ICommandHandler {
  readonly commandName = 'ConfigureHcmSetup';

  constructor(private readonly service: HcmSetupService) {}

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<HcmSetupConfig>> {
    const setup = await this.service.updateSetup(command.tenantId, command.payload as HcmSetupUpdate);

    return {
      success: true,
      data: setup,
      commandId: command.commandId,
      correlationId: command.correlationId,
      aggregateId: command.aggregateId ?? command.tenantId,
      newState: 'CONFIGURED',
      newVersion: 1,
      allowedNextActions: ['ReviewSetup', 'ConfigureHcmSetup'],
      fieldAccessDecisions: {},
      eventsEmitted: ['HcmSetupConfigured'],
      auditRecordId: Uuid.generate(),
    };
  }
}

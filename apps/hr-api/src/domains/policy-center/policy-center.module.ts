import { Module } from '@nestjs/common';
import { HcmSetupModule } from '../hcm-setup/hcm-setup.module.js';
import { POLICY_CENTER_COMMAND_HANDLERS } from './commands/policy-center-command.handlers.js';
import { PolicyCenterController } from './policy-center.controller.js';
import { PolicyCenterRepository } from './policy-center.repository.js';
import { PolicyCenterService } from './policy-center.service.js';

@Module({
  imports: [HcmSetupModule],
  controllers: [PolicyCenterController],
  providers: [PolicyCenterRepository, PolicyCenterService, ...POLICY_CENTER_COMMAND_HANDLERS],
  exports: [PolicyCenterService],
})
export class PolicyCenterModule {}

import { Module } from '@nestjs/common';
import { HcmSetupController } from './hcm-setup.controller.js';
import { HcmSetupRepository } from './hcm-setup.repository.js';
import { HcmSetupService } from './hcm-setup.service.js';
import { ConfigureHcmSetupHandler } from './commands/configure-hcm-setup.handler.js';

@Module({
  controllers: [HcmSetupController],
  providers: [HcmSetupService, HcmSetupRepository, ConfigureHcmSetupHandler],
  exports: [HcmSetupService],
})
export class HcmSetupModule {}

import { Module } from '@nestjs/common';
import { HcmSetupController } from './hcm-setup.controller.js';
import { HcmSetupRepository } from './hcm-setup.repository.js';
import { HcmSetupService } from './hcm-setup.service.js';

@Module({
  controllers: [HcmSetupController],
  providers: [HcmSetupService, HcmSetupRepository],
  exports: [HcmSetupService],
})
export class HcmSetupModule {}

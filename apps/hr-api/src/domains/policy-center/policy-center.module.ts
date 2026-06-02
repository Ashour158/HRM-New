import { Module } from '@nestjs/common';
import { HcmSetupModule } from '../hcm-setup/hcm-setup.module.js';
import { PolicyCenterController } from './policy-center.controller.js';
import { PolicyCenterRepository } from './policy-center.repository.js';
import { PolicyCenterService } from './policy-center.service.js';

@Module({
  imports: [HcmSetupModule],
  controllers: [PolicyCenterController],
  providers: [PolicyCenterRepository, PolicyCenterService],
  exports: [PolicyCenterService],
})
export class PolicyCenterModule {}

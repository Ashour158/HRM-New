import { Module } from '@nestjs/common';
import { AccessGovernanceController } from './access-governance.controller.js';
import { AccessGovernanceRepository } from './access-governance.repository.js';
import { AccessGovernanceService } from './access-governance.service.js';

@Module({
  controllers: [AccessGovernanceController],
  providers: [AccessGovernanceRepository, AccessGovernanceService],
  exports: [AccessGovernanceService],
})
export class AccessGovernanceModule {}

import { Module } from '@nestjs/common';
import { PlatformModule } from '../../platform/platform.module.js';
import { AccessGovernanceCommandHandler } from './access-governance-command.handler.js';
import { AccessGovernanceController } from './access-governance.controller.js';
import { AccessGovernanceRepository } from './access-governance.repository.js';
import { AccessGovernanceService } from './access-governance.service.js';

@Module({
  imports: [PlatformModule],
  controllers: [AccessGovernanceController],
  providers: [AccessGovernanceRepository, AccessGovernanceService, AccessGovernanceCommandHandler],
  exports: [AccessGovernanceService],
})
export class AccessGovernanceModule {}

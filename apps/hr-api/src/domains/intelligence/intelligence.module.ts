import { Module } from '@nestjs/common';
import { PlatformModule } from '../../platform/platform.module.js';
import { HrCoreModule } from '../hr-core/hr-core.module.js';
import { IntelligenceController } from './api/intelligence.controller.js';
import { IntelligenceRepository } from './repositories/intelligence.repository.js';
import { IntelligenceService } from './services/intelligence.service.js';

@Module({
  imports: [PlatformModule, HrCoreModule],
  controllers: [IntelligenceController],
  providers: [IntelligenceRepository, IntelligenceService],
  exports: [IntelligenceService, IntelligenceRepository],
})
export class IntelligenceModule {}

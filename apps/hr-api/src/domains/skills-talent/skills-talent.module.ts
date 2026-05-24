import { Module, OnModuleInit } from '@nestjs/common';
import { PlatformModule } from '../../platform/platform.module.js';
import { FsmFramework } from '../../platform/workflow/fsm-framework.js';
import { SkillsTalentController } from './api/skills-talent.controller.js';
import { SkillProfileRepository } from './repositories/skill-profile.repository.js';
import { TalentPoolRepository } from './repositories/talent-pool.repository.js';
import { CareerPathRepository } from './repositories/career-path.repository.js';
import { SuccessionPlanRepository } from './repositories/succession-plan.repository.js';
import { CreateSkillProfileHandler } from './commands/create-skill-profile.handler.js';
import { UpdateSkillProfileHandler } from './commands/update-skill-profile.handler.js';
import { ValidateSkillProfileHandler } from './commands/validate-skill-profile.handler.js';
import { ArchiveSkillProfileHandler } from './commands/archive-skill-profile.handler.js';
import { CreateTalentPoolHandler } from './commands/create-talent-pool.handler.js';
import { UpdateTalentPoolHandler } from './commands/update-talent-pool.handler.js';
import { AddTalentPoolMemberHandler } from './commands/add-talent-pool-member.handler.js';
import { RemoveTalentPoolMemberHandler } from './commands/remove-talent-pool-member.handler.js';
import { CloseTalentPoolHandler } from './commands/close-talent-pool.handler.js';
import { CreateCareerPathHandler } from './commands/create-career-path.handler.js';
import { ActivateCareerPathHandler } from './commands/activate-career-path.handler.js';
import { AchieveCareerPathMilestoneHandler } from './commands/achieve-career-path-milestone.handler.js';
import { ArchiveCareerPathHandler } from './commands/archive-career-path.handler.js';
import { CreateSuccessionPlanHandler } from './commands/create-succession-plan.handler.js';
import { ActivateSuccessionPlanHandler } from './commands/activate-succession-plan.handler.js';
import { ReviewSuccessionPlanHandler } from './commands/review-succession-plan.handler.js';
import { ExecuteSuccessionPlanHandler } from './commands/execute-succession-plan.handler.js';
import { CloseSuccessionPlanHandler } from './commands/close-succession-plan.handler.js';
import { UpdateSuccessionReadinessHandler } from './commands/update-succession-readiness.handler.js';
import { SkillsTalentEventsPublisher } from './events/skills-talent-events.publisher.js';
import { registerSkillProfileFsm } from './fsm/skill-profile.fsm.js';
import { registerTalentPoolFsm } from './fsm/talent-pool.fsm.js';
import { registerCareerPathFsm } from './fsm/career-path.fsm.js';
import { registerSuccessionPlanFsm } from './fsm/succession-plan.fsm.js';

@Module({
  imports: [PlatformModule],
  controllers: [SkillsTalentController],
  providers: [
    SkillProfileRepository,
    TalentPoolRepository,
    CareerPathRepository,
    SuccessionPlanRepository,
    CreateSkillProfileHandler,
    UpdateSkillProfileHandler,
    ValidateSkillProfileHandler,
    ArchiveSkillProfileHandler,
    CreateTalentPoolHandler,
    UpdateTalentPoolHandler,
    AddTalentPoolMemberHandler,
    RemoveTalentPoolMemberHandler,
    CloseTalentPoolHandler,
    CreateCareerPathHandler,
    ActivateCareerPathHandler,
    AchieveCareerPathMilestoneHandler,
    ArchiveCareerPathHandler,
    CreateSuccessionPlanHandler,
    ActivateSuccessionPlanHandler,
    ReviewSuccessionPlanHandler,
    ExecuteSuccessionPlanHandler,
    CloseSuccessionPlanHandler,
    UpdateSuccessionReadinessHandler,
    SkillsTalentEventsPublisher,
  ],
  exports: [SkillProfileRepository, TalentPoolRepository, CareerPathRepository, SuccessionPlanRepository],
})
export class SkillsTalentModule implements OnModuleInit {
  constructor(private readonly fsm: FsmFramework) {}

  onModuleInit(): void {
    registerSkillProfileFsm(this.fsm);
    registerTalentPoolFsm(this.fsm);
    registerCareerPathFsm(this.fsm);
    registerSuccessionPlanFsm(this.fsm);
  }
}

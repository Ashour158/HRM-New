import { Module } from '@nestjs/common';
import { PlatformModule } from '../../platform/platform.module.js';
import { HrAiGovernanceController } from './api/hr-ai-governance.controller.js';
import { HrAiUseCaseFsmRegistrar } from './fsm/hr-ai-use-case.fsm.js';
import { HrAiModelRunFsmRegistrar } from './fsm/hr-ai-model-run.fsm.js';
import { HrAiBiasTestFsmRegistrar } from './fsm/hr-ai-bias-test.fsm.js';
import { HrAiKillSwitchFsmRegistrar } from './fsm/hr-ai-kill-switch.fsm.js';
import { HrAiUseCaseRepository } from './repositories/hr-ai-use-case.repository.js';
import { HrAiModelRunRepository } from './repositories/hr-ai-model-run.repository.js';
import { HrAiBiasTestRepository } from './repositories/hr-ai-bias-test.repository.js';
import { HrAiKillSwitchRepository } from './repositories/hr-ai-kill-switch.repository.js';
import { HrAiUseCaseGuard } from './services/hr-ai-use-case-guard.service.js';
import { RegisterHrAiUseCaseHandler } from './commands/register-hr-ai-use-case.handler.js';
import { ReviewHrAiUseCaseHandler } from './commands/review-hr-ai-use-case.handler.js';
import { ApproveHrAiUseCaseHandler } from './commands/approve-hr-ai-use-case.handler.js';
import { ActivateHrAiUseCaseHandler } from './commands/activate-hr-ai-use-case.handler.js';
import { SuspendHrAiUseCaseHandler } from './commands/suspend-hr-ai-use-case.handler.js';
import { RetireHrAiUseCaseHandler } from './commands/retire-hr-ai-use-case.handler.js';
import { RejectHrAiUseCaseHandler } from './commands/reject-hr-ai-use-case.handler.js';
import { CreateHrAiModelRunHandler } from './commands/create-hr-ai-model-run.handler.js';
import { StartHrAiModelRunHandler } from './commands/start-hr-ai-model-run.handler.js';
import { CompleteHrAiModelRunHandler } from './commands/complete-hr-ai-model-run.handler.js';
import { FailHrAiModelRunHandler } from './commands/fail-hr-ai-model-run.handler.js';
import { PlanHrAiBiasTestHandler } from './commands/plan-hr-ai-bias-test.handler.js';
import { StartHrAiBiasTestHandler } from './commands/start-hr-ai-bias-test.handler.js';
import { CompleteHrAiBiasTestHandler } from './commands/complete-hr-ai-bias-test.handler.js';
import { FailHrAiBiasTestHandler } from './commands/fail-hr-ai-bias-test.handler.js';
import { ArmHrAiKillSwitchHandler } from './commands/arm-hr-ai-kill-switch.handler.js';
import { TriggerHrAiKillSwitchHandler } from './commands/trigger-hr-ai-kill-switch.handler.js';
import { InvestigateHrAiKillSwitchHandler } from './commands/investigate-hr-ai-kill-switch.handler.js';
import { ResolveHrAiKillSwitchHandler } from './commands/resolve-hr-ai-kill-switch.handler.js';
import { RearmHrAiKillSwitchHandler } from './commands/rearm-hr-ai-kill-switch.handler.js';
import { HrAiGovernanceEventsPublisher } from './events/hr-ai-governance-events.publisher.js';

@Module({
  imports: [PlatformModule],
  controllers: [HrAiGovernanceController],
  providers: [
    HrAiUseCaseFsmRegistrar, HrAiModelRunFsmRegistrar, HrAiBiasTestFsmRegistrar, HrAiKillSwitchFsmRegistrar,
    HrAiUseCaseRepository, HrAiModelRunRepository, HrAiBiasTestRepository, HrAiKillSwitchRepository,
    HrAiUseCaseGuard,
    RegisterHrAiUseCaseHandler, ReviewHrAiUseCaseHandler, ApproveHrAiUseCaseHandler, ActivateHrAiUseCaseHandler, SuspendHrAiUseCaseHandler, RetireHrAiUseCaseHandler, RejectHrAiUseCaseHandler,
    CreateHrAiModelRunHandler, StartHrAiModelRunHandler, CompleteHrAiModelRunHandler, FailHrAiModelRunHandler,
    PlanHrAiBiasTestHandler, StartHrAiBiasTestHandler, CompleteHrAiBiasTestHandler, FailHrAiBiasTestHandler,
    ArmHrAiKillSwitchHandler, TriggerHrAiKillSwitchHandler, InvestigateHrAiKillSwitchHandler, ResolveHrAiKillSwitchHandler, RearmHrAiKillSwitchHandler,
    HrAiGovernanceEventsPublisher,
  ],
  exports: [HrAiUseCaseRepository, HrAiModelRunRepository, HrAiBiasTestRepository, HrAiKillSwitchRepository],
})
export class HrAiGovernanceModule {}

import { Module, OnModuleInit } from '@nestjs/common';
import { PlatformModule } from '../../platform/platform.module.js';
import { WellbeingEapController } from './api/wellbeing-eap.controller.js';
import { WellbeingEapEventsPublisher } from './events/wellbeing-eap-events.publisher.js';
import { EapReferralRepository } from './repositories/eap-referral.repository.js';
import { WellnessProgramRepository } from './repositories/wellness-program.repository.js';
import { MentalHealthCaseRepository } from './repositories/mental-health-case.repository.js';
import { FsmFramework } from '../../platform/workflow/fsm-framework.js';
import { registerEapReferralFsm } from './fsm/eap-referral.fsm.js';
import { registerWellnessProgramFsm } from './fsm/wellness-program.fsm.js';
import { registerMentalHealthCaseFsm } from './fsm/mental-health-case.fsm.js';
import { CreateEapReferralHandler } from './commands/create-eap-referral.handler.js';
import { ScheduleEapReferralHandler } from './commands/schedule-eap-referral.handler.js';
import { StartEapReferralHandler } from './commands/start-eap-referral.handler.js';
import { CompleteEapReferralHandler } from './commands/complete-eap-referral.handler.js';
import { CloseEapReferralHandler } from './commands/close-eap-referral.handler.js';
import { CancelEapReferralHandler } from './commands/cancel-eap-referral.handler.js';
import { CreateWellnessProgramHandler } from './commands/create-wellness-program.handler.js';
import { ActivateWellnessProgramHandler } from './commands/activate-wellness-program.handler.js';
import { EnrollWellnessProgramHandler } from './commands/enroll-wellness-program.handler.js';
import { CompleteWellnessProgramHandler } from './commands/complete-wellness-program.handler.js';
import { CancelWellnessProgramHandler } from './commands/cancel-wellness-program.handler.js';
import { ArchiveWellnessProgramHandler } from './commands/archive-wellness-program.handler.js';
import { CreateMentalHealthCaseHandler } from './commands/create-mental-health-case.handler.js';
import { AssignToMentalHealthCaseHandler } from './commands/assign-to-mental-health-case.handler.js';
import { StartMentalHealthCaseHandler } from './commands/start-mental-health-case.handler.js';
import { ResolveMentalHealthCaseHandler } from './commands/resolve-mental-health-case.handler.js';
import { CloseMentalHealthCaseHandler } from './commands/close-mental-health-case.handler.js';

const HANDLERS = [
  CreateEapReferralHandler,
  ScheduleEapReferralHandler,
  StartEapReferralHandler,
  CompleteEapReferralHandler,
  CloseEapReferralHandler,
  CancelEapReferralHandler,
  CreateWellnessProgramHandler,
  ActivateWellnessProgramHandler,
  EnrollWellnessProgramHandler,
  CompleteWellnessProgramHandler,
  CancelWellnessProgramHandler,
  ArchiveWellnessProgramHandler,
  CreateMentalHealthCaseHandler,
  AssignToMentalHealthCaseHandler,
  StartMentalHealthCaseHandler,
  ResolveMentalHealthCaseHandler,
  CloseMentalHealthCaseHandler,
];

const REPOS = [EapReferralRepository, WellnessProgramRepository, MentalHealthCaseRepository];

@Module({
  imports: [PlatformModule],
  controllers: [WellbeingEapController],
  providers: [...REPOS, ...HANDLERS, WellbeingEapEventsPublisher],
  exports: REPOS,
})
export class WellbeingEapModule implements OnModuleInit {
  constructor(private readonly fsm: FsmFramework) {}

  onModuleInit() {
    registerEapReferralFsm(this.fsm);
    registerWellnessProgramFsm(this.fsm);
    registerMentalHealthCaseFsm(this.fsm);
  }
}

import { Inject, Module, OnModuleInit } from '@nestjs/common';
import { PlatformModule } from '../../platform/platform.module.js';
import { FsmFramework } from '../../platform/workflow/fsm-framework.js';
import { EmployeeRelationsController } from './api/employee-relations.controller.js';
import { EmployeeRelationsCaseRepository } from './repositories/employee-relations-case.repository.js';
import { ErInvestigationRepository } from './repositories/er-investigation.repository.js';
import { DisciplinaryActionRepository } from './repositories/disciplinary-action.repository.js';
import { AccommodationCaseRepository } from './repositories/accommodation-case.repository.js';
import { CreateEmployeeRelationsCaseHandler } from './commands/create-employee-relations-case.handler.js';
import { ReviewEmployeeRelationsCaseHandler } from './commands/review-employee-relations-case.handler.js';
import { StartInvestigationEmployeeRelationsCaseHandler } from './commands/start-investigation-employee-relations-case.handler.js';
import { MoveToDisciplinaryEmployeeRelationsCaseHandler } from './commands/move-to-disciplinary-employee-relations-case.handler.js';
import { ResolveEmployeeRelationsCaseHandler } from './commands/resolve-employee-relations-case.handler.js';
import { CloseEmployeeRelationsCaseHandler } from './commands/close-employee-relations-case.handler.js';
import { CreateErInvestigationHandler } from './commands/create-er-investigation.handler.js';
import { StartErInvestigationHandler } from './commands/start-er-investigation.handler.js';
import { ReviewEvidenceErInvestigationHandler } from './commands/review-evidence-er-investigation.handler.js';
import { CompleteErInvestigationHandler } from './commands/complete-er-investigation.handler.js';
import { DraftDisciplinaryActionHandler } from './commands/draft-disciplinary-action.handler.js';
import { ApproveDisciplinaryActionHandler } from './commands/approve-disciplinary-action.handler.js';
import { ExecuteDisciplinaryActionHandler } from './commands/execute-disciplinary-action.handler.js';
import { AppealDisciplinaryActionHandler } from './commands/appeal-disciplinary-action.handler.js';
import { UpholdDisciplinaryActionHandler } from './commands/uphold-disciplinary-action.handler.js';
import { RevokeDisciplinaryActionHandler } from './commands/revoke-disciplinary-action.handler.js';
import { CreateAccommodationCaseHandler } from './commands/create-accommodation-case.handler.js';
import { ReviewAccommodationCaseHandler } from './commands/review-accommodation-case.handler.js';
import { ApproveAccommodationCaseHandler } from './commands/approve-accommodation-case.handler.js';
import { ImplementAccommodationCaseHandler } from './commands/implement-accommodation-case.handler.js';
import { CloseAccommodationCaseHandler } from './commands/close-accommodation-case.handler.js';
import { RejectAccommodationCaseHandler } from './commands/reject-accommodation-case.handler.js';
import { EmployeeRelationsEventsPublisher } from './events/employee-relations-events.publisher.js';
import { registerEmployeeRelationsCaseFsm } from './fsm/employee-relations-case.fsm.js';
import { registerErInvestigationFsm } from './fsm/er-investigation.fsm.js';
import { registerDisciplinaryActionFsm } from './fsm/disciplinary-action.fsm.js';
import { registerAccommodationCaseFsm } from './fsm/accommodation-case.fsm.js';

@Module({
  imports: [PlatformModule],
  controllers: [EmployeeRelationsController],
  providers: [
    EmployeeRelationsCaseRepository,
    ErInvestigationRepository,
    DisciplinaryActionRepository,
    AccommodationCaseRepository,
    CreateEmployeeRelationsCaseHandler,
    ReviewEmployeeRelationsCaseHandler,
    StartInvestigationEmployeeRelationsCaseHandler,
    MoveToDisciplinaryEmployeeRelationsCaseHandler,
    ResolveEmployeeRelationsCaseHandler,
    CloseEmployeeRelationsCaseHandler,
    CreateErInvestigationHandler,
    StartErInvestigationHandler,
    ReviewEvidenceErInvestigationHandler,
    CompleteErInvestigationHandler,
    DraftDisciplinaryActionHandler,
    ApproveDisciplinaryActionHandler,
    ExecuteDisciplinaryActionHandler,
    AppealDisciplinaryActionHandler,
    UpholdDisciplinaryActionHandler,
    RevokeDisciplinaryActionHandler,
    CreateAccommodationCaseHandler,
    ReviewAccommodationCaseHandler,
    ApproveAccommodationCaseHandler,
    ImplementAccommodationCaseHandler,
    CloseAccommodationCaseHandler,
    RejectAccommodationCaseHandler,
    EmployeeRelationsEventsPublisher,
  ],
  exports: [EmployeeRelationsCaseRepository, ErInvestigationRepository, DisciplinaryActionRepository, AccommodationCaseRepository],
})
export class EmployeeRelationsModule implements OnModuleInit {
  constructor(@Inject(FsmFramework) private readonly fsm: FsmFramework) {}

  onModuleInit(): void {
    registerEmployeeRelationsCaseFsm(this.fsm);
    registerErInvestigationFsm(this.fsm);
    registerDisciplinaryActionFsm(this.fsm);
    registerAccommodationCaseFsm(this.fsm);
  }
}

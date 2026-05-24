import { Module, OnModuleInit } from '@nestjs/common';
import { PlatformModule } from '../../platform/platform.module.js';
import { UnionLaborController } from './api/union-labor.controller.js';
import { UnionLaborEventsPublisher } from './events/union-labor-events.publisher.js';
import { UnionRecognitionRepository } from './repositories/union-recognition.repository.js';
import { GrievanceRepository } from './repositories/grievance.repository.js';
import { CollectiveBargainingSessionRepository } from './repositories/collective-bargaining-session.repository.js';
import { FsmFramework } from '../../platform/workflow/fsm-framework.js';
import { registerUnionRecognitionFsm } from './fsm/union-recognition.fsm.js';
import { registerGrievanceFsm } from './fsm/grievance.fsm.js';
import { registerCollectiveBargainingSessionFsm } from './fsm/collective-bargaining-session.fsm.js';
import { CreateUnionRecognitionHandler } from './commands/create-union-recognition.handler.js';
import { NegotiateUnionRecognitionHandler } from './commands/negotiate-union-recognition.handler.js';
import { RatifyUnionRecognitionHandler } from './commands/ratify-union-recognition.handler.js';
import { ActivateUnionRecognitionHandler } from './commands/activate-union-recognition.handler.js';
import { ExpireUnionRecognitionHandler } from './commands/expire-union-recognition.handler.js';
import { RenewUnionRecognitionHandler } from './commands/renew-union-recognition.handler.js';
import { CreateGrievanceHandler } from './commands/create-grievance.handler.js';
import { AcknowledgeGrievanceHandler } from './commands/acknowledge-grievance.handler.js';
import { StartInvestigationGrievanceHandler } from './commands/start-investigation-grievance.handler.js';
import { ResolveGrievanceHandler } from './commands/resolve-grievance.handler.js';
import { ArbitrateGrievanceHandler } from './commands/arbitrate-grievance.handler.js';
import { WithdrawGrievanceHandler } from './commands/withdraw-grievance.handler.js';
import { CreateCollectiveBargainingSessionHandler } from './commands/create-collective-bargaining-session.handler.js';
import { StartCollectiveBargainingSessionHandler } from './commands/start-collective-bargaining-session.handler.js';
import { RecordTentativeAgreementCollectiveBargainingSessionHandler } from './commands/record-tentative-agreement-collective-bargaining-session.handler.js';
import { RatifyCollectiveBargainingSessionHandler } from './commands/ratify-collective-bargaining-session.handler.js';
import { MarkFailedCollectiveBargainingSessionHandler } from './commands/mark-failed-collective-bargaining-session.handler.js';
import { CloseCollectiveBargainingSessionHandler } from './commands/close-collective-bargaining-session.handler.js';

const HANDLERS = [
  CreateUnionRecognitionHandler,
  NegotiateUnionRecognitionHandler,
  RatifyUnionRecognitionHandler,
  ActivateUnionRecognitionHandler,
  ExpireUnionRecognitionHandler,
  RenewUnionRecognitionHandler,
  CreateGrievanceHandler,
  AcknowledgeGrievanceHandler,
  StartInvestigationGrievanceHandler,
  ResolveGrievanceHandler,
  ArbitrateGrievanceHandler,
  WithdrawGrievanceHandler,
  CreateCollectiveBargainingSessionHandler,
  StartCollectiveBargainingSessionHandler,
  RecordTentativeAgreementCollectiveBargainingSessionHandler,
  RatifyCollectiveBargainingSessionHandler,
  MarkFailedCollectiveBargainingSessionHandler,
  CloseCollectiveBargainingSessionHandler,
];

const REPOS = [UnionRecognitionRepository, GrievanceRepository, CollectiveBargainingSessionRepository];

@Module({
  imports: [PlatformModule],
  controllers: [UnionLaborController],
  providers: [...REPOS, ...HANDLERS, UnionLaborEventsPublisher],
  exports: REPOS,
})
export class UnionLaborModule implements OnModuleInit {
  constructor(private readonly fsm: FsmFramework) {}

  onModuleInit() {
    registerUnionRecognitionFsm(this.fsm);
    registerGrievanceFsm(this.fsm);
    registerCollectiveBargainingSessionFsm(this.fsm);
  }
}

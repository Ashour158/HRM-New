import { Module } from '@nestjs/common';
import { PositionControlController } from './api/position-control.controller.js';
import { PositionFsmRegistrar } from './fsm/position.fsm.js';
import { HeadcountRequestFsmRegistrar } from './fsm/headcount-request.fsm.js';
import { PositionRepository } from './repositories/position.repository.js';
import { HeadcountRequestRepository } from './repositories/headcount-request.repository.js';
import { HeadcountBudgetRepository } from './repositories/headcount-budget.repository.js';
import { CreatePositionHandler } from './commands/create-position.handler.js';
import { ActivatePositionHandler } from './commands/activate-position.handler.js';
import { FreezePositionHandler } from './commands/freeze-position.handler.js';
import { UnfreezePositionHandler } from './commands/unfreeze-position.handler.js';
import { FillPositionHandler } from './commands/fill-position.handler.js';
import { VacatePositionHandler } from './commands/vacate-position.handler.js';
import { ClosePositionHandler } from './commands/close-position.handler.js';
import { UpdatePositionHandler } from './commands/update-position.handler.js';
import { SubmitHeadcountRequestHandler } from './commands/submit-headcount-request.handler.js';
import { StartReviewHeadcountRequestHandler } from './commands/start-review-headcount-request.handler.js';
import { ApproveHeadcountRequestHandler } from './commands/approve-headcount-request.handler.js';
import { RejectHeadcountRequestHandler } from './commands/reject-headcount-request.handler.js';
import { CancelHeadcountRequestHandler } from './commands/cancel-headcount-request.handler.js';
import { ConfigureHeadcountBudgetHandler } from './commands/configure-headcount-budget.handler.js';
import { PositionEventsPublisher } from './events/position-events.publisher.js';
import { PositionHeadcountSaga } from './sagas/position-headcount.saga.js';

/**
 * Position Control domain module.
 *
 * Owns Position and HeadcountRequest aggregates. Provides command handlers,
 * repositories, FSM registrations, event publishing, and saga coordination.
 */
@Module({
  controllers: [PositionControlController],
  providers: [
    // FSM registrars
    PositionFsmRegistrar,
    HeadcountRequestFsmRegistrar,
    // Repositories
    PositionRepository,
    HeadcountRequestRepository,
    HeadcountBudgetRepository,
    // Command handlers
    CreatePositionHandler,
    ActivatePositionHandler,
    FreezePositionHandler,
    UnfreezePositionHandler,
    FillPositionHandler,
    VacatePositionHandler,
    ClosePositionHandler,
    UpdatePositionHandler,
    SubmitHeadcountRequestHandler,
    StartReviewHeadcountRequestHandler,
    ApproveHeadcountRequestHandler,
    RejectHeadcountRequestHandler,
    CancelHeadcountRequestHandler,
    ConfigureHeadcountBudgetHandler,
    // Event publisher
    PositionEventsPublisher,
    // Saga
    PositionHeadcountSaga,
  ],
  exports: [PositionRepository, HeadcountRequestRepository, HeadcountBudgetRepository],
})
export class PositionControlModule {}

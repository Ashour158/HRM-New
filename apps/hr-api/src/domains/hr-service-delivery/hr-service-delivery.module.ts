import { Inject, Module, OnModuleInit } from '@nestjs/common';
import { PlatformModule } from '../../platform/platform.module.js';
import { HrCoreModule } from '../hr-core/hr-core.module.js';
import { FsmFramework } from '../../platform/workflow/fsm-framework.js';
import { HrServiceDeliveryController } from './api/hr-service-delivery.controller.js';
import { HrServiceCaseRepository } from './repositories/hr-service-case.repository.js';
import { HrCaseTaskRepository } from './repositories/hr-case-task.repository.js';
import { HrKnowledgeArticleRepository } from './repositories/hr-knowledge-article.repository.js';
import { HrServiceCatalogItemRepository } from './repositories/hr-service-catalog-item.repository.js';
import { HrCaseSlaInstanceRepository } from './repositories/hr-case-sla-instance.repository.js';
import { OpenHrServiceCaseHandler } from './commands/open-hr-service-case.handler.js';
import { MarkInProgressHrServiceCaseHandler } from './commands/mark-in-progress-hr-service-case.handler.js';
import { MarkPendingCustomerHrServiceCaseHandler } from './commands/mark-pending-customer-hr-service-case.handler.js';
import { ResolveHrServiceCaseHandler } from './commands/resolve-hr-service-case.handler.js';
import { CloseHrServiceCaseHandler } from './commands/close-hr-service-case.handler.js';
import { EscalateHrServiceCaseHandler } from './commands/escalate-hr-service-case.handler.js';
import { ReassignHrServiceCaseHandler } from './commands/reassign-hr-service-case.handler.js';
import { CreateHrCaseTaskHandler } from './commands/create-hr-case-task.handler.js';
import { StartHrCaseTaskHandler } from './commands/start-hr-case-task.handler.js';
import { CompleteHrCaseTaskHandler } from './commands/complete-hr-case-task.handler.js';
import { MarkOverdueHrCaseTaskHandler } from './commands/mark-overdue-hr-case-task.handler.js';
import { CancelHrCaseTaskHandler } from './commands/cancel-hr-case-task.handler.js';
import { CreateHrKnowledgeArticleHandler } from './commands/create-hr-knowledge-article.handler.js';
import { PublishHrKnowledgeArticleHandler } from './commands/publish-hr-knowledge-article.handler.js';
import { ArchiveHrKnowledgeArticleHandler } from './commands/archive-hr-knowledge-article.handler.js';
import { CreateHrServiceCatalogItemHandler } from './commands/create-hr-service-catalog-item.handler.js';
import { ActivateHrServiceCatalogItemHandler } from './commands/activate-hr-service-catalog-item.handler.js';
import { SuspendHrServiceCatalogItemHandler } from './commands/suspend-hr-service-catalog-item.handler.js';
import { RetireHrServiceCatalogItemHandler } from './commands/retire-hr-service-catalog-item.handler.js';
import { CreateHrCaseSlaInstanceHandler } from './commands/create-hr-case-sla-instance.handler.js';
import { BreachHrCaseSlaInstanceHandler } from './commands/breach-hr-case-sla-instance.handler.js';
import { MeetHrCaseSlaInstanceHandler } from './commands/meet-hr-case-sla-instance.handler.js';
import { ExemptHrCaseSlaInstanceHandler } from './commands/exempt-hr-case-sla-instance.handler.js';
import { HrServiceDeliveryEventsPublisher } from './events/hr-service-delivery-events.publisher.js';
import { registerHrServiceCaseFsm } from './fsm/hr-service-case.fsm.js';
import { registerHrCaseTaskFsm } from './fsm/hr-case-task.fsm.js';
import { registerHrKnowledgeArticleFsm } from './fsm/hr-knowledge-article.fsm.js';
import { registerHrServiceCatalogItemFsm } from './fsm/hr-service-catalog-item.fsm.js';
import { registerHrCaseSlaInstanceFsm } from './fsm/hr-case-sla-instance.fsm.js';

@Module({
  imports: [PlatformModule, HrCoreModule],
  controllers: [HrServiceDeliveryController],
  providers: [
    HrServiceCaseRepository,
    HrCaseTaskRepository,
    HrKnowledgeArticleRepository,
    HrServiceCatalogItemRepository,
    HrCaseSlaInstanceRepository,
    OpenHrServiceCaseHandler,
    MarkInProgressHrServiceCaseHandler,
    MarkPendingCustomerHrServiceCaseHandler,
    ResolveHrServiceCaseHandler,
    CloseHrServiceCaseHandler,
    EscalateHrServiceCaseHandler,
    ReassignHrServiceCaseHandler,
    CreateHrCaseTaskHandler,
    StartHrCaseTaskHandler,
    CompleteHrCaseTaskHandler,
    MarkOverdueHrCaseTaskHandler,
    CancelHrCaseTaskHandler,
    CreateHrKnowledgeArticleHandler,
    PublishHrKnowledgeArticleHandler,
    ArchiveHrKnowledgeArticleHandler,
    CreateHrServiceCatalogItemHandler,
    ActivateHrServiceCatalogItemHandler,
    SuspendHrServiceCatalogItemHandler,
    RetireHrServiceCatalogItemHandler,
    CreateHrCaseSlaInstanceHandler,
    BreachHrCaseSlaInstanceHandler,
    MeetHrCaseSlaInstanceHandler,
    ExemptHrCaseSlaInstanceHandler,
    HrServiceDeliveryEventsPublisher,
  ],
  exports: [HrServiceCaseRepository, HrCaseTaskRepository, HrKnowledgeArticleRepository, HrServiceCatalogItemRepository, HrCaseSlaInstanceRepository],
})
export class HrServiceDeliveryModule implements OnModuleInit {
  constructor(@Inject(FsmFramework) private readonly fsm: FsmFramework) {}

  onModuleInit(): void {
    registerHrServiceCaseFsm(this.fsm);
    registerHrCaseTaskFsm(this.fsm);
    registerHrKnowledgeArticleFsm(this.fsm);
    registerHrServiceCatalogItemFsm(this.fsm);
    registerHrCaseSlaInstanceFsm(this.fsm);
  }
}

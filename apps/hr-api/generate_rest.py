import pathlib

BASE = pathlib.Path(__file__).parent / "src" / "domains"

def write(p, c):
    p = pathlib.Path(p)
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(c, encoding="utf-8")
    print(f"Wrote {p}")

# ========================================================================
# HRSD Command Handlers
# ========================================================================

# HrServiceCase
write(BASE/"hr-service-delivery/commands/open-hr-service-case.handler.ts", '''import { Injectable } from '@nestjs/common';
import { CommandHandler } from '../../../platform/command-bus/command-handler.decorator.js';
import type { HrCommandEnvelope, CommandResult } from '@hcm/command-contracts';
import { Uuid } from '@hcm/shared-kernel';
import { FsmFramework } from '../../../platform/workflow/fsm-framework.js';
import { HrServiceCase } from '../aggregates/hr-service-case.aggregate.js';
import { HrServiceCaseRepository } from '../repositories/hr-service-case.repository.js';
import { HrServiceDeliveryEventsPublisher } from '../events/hr-service-delivery-events.publisher.js';

@CommandHandler('OpenHrServiceCase')
@Injectable()
export class OpenHrServiceCaseHandler {
  constructor(
    private readonly repo: HrServiceCaseRepository,
    private readonly fsm: FsmFramework,
    private readonly publisher: HrServiceDeliveryEventsPublisher,
  ) {}

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>> {
    const payload = command.payload as {
      caseNumber: string;
      requesterWorkerId: Uuid;
      caseType: string;
      priority: string;
      description: string;
      assignedTo?: Uuid;
      slaDeadline?: Date;
    };
    const ar = HrServiceCase.open(
      { id: Uuid.generate(), tenantId: command.tenantId, ...payload },
      command.correlationId,
    );
    await this.repo.save(ar);
    await this.publisher.publishFromAggregate(ar);
    return {
      success: true,
      data: { hrServiceCaseId: ar.id.value, status: ar.status },
      commandId: command.commandId,
      correlationId: command.correlationId,
      aggregateId: ar.id,
      newState: ar.status,
      newVersion: ar.aggregateVersion,
      allowedNextActions: this.fsm.getAllowedActionsFromState(ar.status, 'HrServiceCase'),
      eventsEmitted: ar.domainEvents.map((e) => e.eventName),
      auditRecordId: command.commandId,
    } as CommandResult<unknown>;
  }
}
''')

write(BASE/"hr-service-delivery/commands/mark-in-progress-hr-service-case.handler.ts", '''import { Injectable } from '@nestjs/common';
import { CommandHandler } from '../../../platform/command-bus/command-handler.decorator.js';
import type { HrCommandEnvelope, CommandResult } from '@hcm/command-contracts';
import { Uuid } from '@hcm/shared-kernel';
import { FsmFramework } from '../../../platform/workflow/fsm-framework.js';
import { HrServiceCaseRepository } from '../repositories/hr-service-case.repository.js';
import { HrServiceDeliveryEventsPublisher } from '../events/hr-service-delivery-events.publisher.js';

@CommandHandler('MarkInProgressHrServiceCase')
@Injectable()
export class MarkInProgressHrServiceCaseHandler {
  constructor(
    private readonly repo: HrServiceCaseRepository,
    private readonly fsm: FsmFramework,
    private readonly publisher: HrServiceDeliveryEventsPublisher,
  ) {}

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>> {
    const payload = command.payload as { hrServiceCaseId: Uuid };
    const ar = await this.repo.findById(payload.hrServiceCaseId);
    if (!ar) throw new Error('HR service case not found');
    ar.markInProgress(command.correlationId);
    await this.repo.save(ar);
    await this.publisher.publishFromAggregate(ar);
    return {
      success: true,
      data: { hrServiceCaseId: ar.id.value, status: ar.status },
      commandId: command.commandId,
      correlationId: command.correlationId,
      aggregateId: ar.id,
      newState: ar.status,
      newVersion: ar.aggregateVersion,
      allowedNextActions: this.fsm.getAllowedActionsFromState(ar.status, 'HrServiceCase'),
      eventsEmitted: ar.domainEvents.map((e) => e.eventName),
      auditRecordId: command.commandId,
    } as CommandResult<unknown>;
  }
}
''')

write(BASE/"hr-service-delivery/commands/mark-pending-customer-hr-service-case.handler.ts", '''import { Injectable } from '@nestjs/common';
import { CommandHandler } from '../../../platform/command-bus/command-handler.decorator.js';
import type { HrCommandEnvelope, CommandResult } from '@hcm/command-contracts';
import { Uuid } from '@hcm/shared-kernel';
import { FsmFramework } from '../../../platform/workflow/fsm-framework.js';
import { HrServiceCaseRepository } from '../repositories/hr-service-case.repository.js';
import { HrServiceDeliveryEventsPublisher } from '../events/hr-service-delivery-events.publisher.js';

@CommandHandler('MarkPendingCustomerHrServiceCase')
@Injectable()
export class MarkPendingCustomerHrServiceCaseHandler {
  constructor(
    private readonly repo: HrServiceCaseRepository,
    private readonly fsm: FsmFramework,
    private readonly publisher: HrServiceDeliveryEventsPublisher,
  ) {}

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>> {
    const payload = command.payload as { hrServiceCaseId: Uuid };
    const ar = await this.repo.findById(payload.hrServiceCaseId);
    if (!ar) throw new Error('HR service case not found');
    ar.markPendingCustomer(command.correlationId);
    await this.repo.save(ar);
    await this.publisher.publishFromAggregate(ar);
    return {
      success: true,
      data: { hrServiceCaseId: ar.id.value, status: ar.status },
      commandId: command.commandId,
      correlationId: command.correlationId,
      aggregateId: ar.id,
      newState: ar.status,
      newVersion: ar.aggregateVersion,
      allowedNextActions: this.fsm.getAllowedActionsFromState(ar.status, 'HrServiceCase'),
      eventsEmitted: ar.domainEvents.map((e) => e.eventName),
      auditRecordId: command.commandId,
    } as CommandResult<unknown>;
  }
}
''')

write(BASE/"hr-service-delivery/commands/resolve-hr-service-case.handler.ts", '''import { Injectable } from '@nestjs/common';
import { CommandHandler } from '../../../platform/command-bus/command-handler.decorator.js';
import type { HrCommandEnvelope, CommandResult } from '@hcm/command-contracts';
import { Uuid } from '@hcm/shared-kernel';
import { FsmFramework } from '../../../platform/workflow/fsm-framework.js';
import { HrServiceCaseRepository } from '../repositories/hr-service-case.repository.js';
import { HrServiceDeliveryEventsPublisher } from '../events/hr-service-delivery-events.publisher.js';

@CommandHandler('ResolveHrServiceCase')
@Injectable()
export class ResolveHrServiceCaseHandler {
  constructor(
    private readonly repo: HrServiceCaseRepository,
    private readonly fsm: FsmFramework,
    private readonly publisher: HrServiceDeliveryEventsPublisher,
  ) {}

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>> {
    const payload = command.payload as { hrServiceCaseId: Uuid };
    const ar = await this.repo.findById(payload.hrServiceCaseId);
    if (!ar) throw new Error('HR service case not found');
    ar.resolve(command.correlationId);
    await this.repo.save(ar);
    await this.publisher.publishFromAggregate(ar);
    return {
      success: true,
      data: { hrServiceCaseId: ar.id.value, status: ar.status },
      commandId: command.commandId,
      correlationId: command.correlationId,
      aggregateId: ar.id,
      newState: ar.status,
      newVersion: ar.aggregateVersion,
      allowedNextActions: this.fsm.getAllowedActionsFromState(ar.status, 'HrServiceCase'),
      eventsEmitted: ar.domainEvents.map((e) => e.eventName),
      auditRecordId: command.commandId,
    } as CommandResult<unknown>;
  }
}
''')

write(BASE/"hr-service-delivery/commands/close-hr-service-case.handler.ts", '''import { Injectable } from '@nestjs/common';
import { CommandHandler } from '../../../platform/command-bus/command-handler.decorator.js';
import type { HrCommandEnvelope, CommandResult } from '@hcm/command-contracts';
import { Uuid } from '@hcm/shared-kernel';
import { FsmFramework } from '../../../platform/workflow/fsm-framework.js';
import { HrServiceCaseRepository } from '../repositories/hr-service-case.repository.js';
import { HrServiceDeliveryEventsPublisher } from '../events/hr-service-delivery-events.publisher.js';

@CommandHandler('CloseHrServiceCase')
@Injectable()
export class CloseHrServiceCaseHandler {
  constructor(
    private readonly repo: HrServiceCaseRepository,
    private readonly fsm: FsmFramework,
    private readonly publisher: HrServiceDeliveryEventsPublisher,
  ) {}

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>> {
    const payload = command.payload as { hrServiceCaseId: Uuid };
    const ar = await this.repo.findById(payload.hrServiceCaseId);
    if (!ar) throw new Error('HR service case not found');
    ar.close(command.correlationId);
    await this.repo.save(ar);
    await this.publisher.publishFromAggregate(ar);
    return {
      success: true,
      data: { hrServiceCaseId: ar.id.value, status: ar.status },
      commandId: command.commandId,
      correlationId: command.correlationId,
      aggregateId: ar.id,
      newState: ar.status,
      newVersion: ar.aggregateVersion,
      allowedNextActions: this.fsm.getAllowedActionsFromState(ar.status, 'HrServiceCase'),
      eventsEmitted: ar.domainEvents.map((e) => e.eventName),
      auditRecordId: command.commandId,
    } as CommandResult<unknown>;
  }
}
''')

# HrCaseTask
write(BASE/"hr-service-delivery/commands/create-hr-case-task.handler.ts", '''import { Injectable } from '@nestjs/common';
import { CommandHandler } from '../../../platform/command-bus/command-handler.decorator.js';
import type { HrCommandEnvelope, CommandResult } from '@hcm/command-contracts';
import { Uuid } from '@hcm/shared-kernel';
import { FsmFramework } from '../../../platform/workflow/fsm-framework.js';
import { HrCaseTask } from '../aggregates/hr-case-task.aggregate.js';
import { HrCaseTaskRepository } from '../repositories/hr-case-task.repository.js';
import { HrServiceDeliveryEventsPublisher } from '../events/hr-service-delivery-events.publisher.js';

@CommandHandler('CreateHrCaseTask')
@Injectable()
export class CreateHrCaseTaskHandler {
  constructor(
    private readonly repo: HrCaseTaskRepository,
    private readonly fsm: FsmFramework,
    private readonly publisher: HrServiceDeliveryEventsPublisher,
  ) {}

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>> {
    const payload = command.payload as { caseId: Uuid; title: string; assignedTo?: Uuid; dueDate?: Date };
    const ar = HrCaseTask.create(
      { id: Uuid.generate(), tenantId: command.tenantId, ...payload },
      command.correlationId,
    );
    await this.repo.save(ar);
    await this.publisher.publishFromAggregate(ar);
    return {
      success: true,
      data: { hrCaseTaskId: ar.id.value, status: ar.status },
      commandId: command.commandId,
      correlationId: command.correlationId,
      aggregateId: ar.id,
      newState: ar.status,
      newVersion: ar.aggregateVersion,
      allowedNextActions: this.fsm.getAllowedActionsFromState(ar.status, 'HrCaseTask'),
      eventsEmitted: ar.domainEvents.map((e) => e.eventName),
      auditRecordId: command.commandId,
    } as CommandResult<unknown>;
  }
}
''')

write(BASE/"hr-service-delivery/commands/start-hr-case-task.handler.ts", '''import { Injectable } from '@nestjs/common';
import { CommandHandler } from '../../../platform/command-bus/command-handler.decorator.js';
import type { HrCommandEnvelope, CommandResult } from '@hcm/command-contracts';
import { Uuid } from '@hcm/shared-kernel';
import { FsmFramework } from '../../../platform/workflow/fsm-framework.js';
import { HrCaseTaskRepository } from '../repositories/hr-case-task.repository.js';
import { HrServiceDeliveryEventsPublisher } from '../events/hr-service-delivery-events.publisher.js';

@CommandHandler('StartHrCaseTask')
@Injectable()
export class StartHrCaseTaskHandler {
  constructor(
    private readonly repo: HrCaseTaskRepository,
    private readonly fsm: FsmFramework,
    private readonly publisher: HrServiceDeliveryEventsPublisher,
  ) {}

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>> {
    const payload = command.payload as { hrCaseTaskId: Uuid };
    const ar = await this.repo.findById(payload.hrCaseTaskId);
    if (!ar) throw new Error('HR case task not found');
    ar.start(command.correlationId);
    await this.repo.save(ar);
    await this.publisher.publishFromAggregate(ar);
    return {
      success: true,
      data: { hrCaseTaskId: ar.id.value, status: ar.status },
      commandId: command.commandId,
      correlationId: command.correlationId,
      aggregateId: ar.id,
      newState: ar.status,
      newVersion: ar.aggregateVersion,
      allowedNextActions: this.fsm.getAllowedActionsFromState(ar.status, 'HrCaseTask'),
      eventsEmitted: ar.domainEvents.map((e) => e.eventName),
      auditRecordId: command.commandId,
    } as CommandResult<unknown>;
  }
}
''')

write(BASE/"hr-service-delivery/commands/complete-hr-case-task.handler.ts", '''import { Injectable } from '@nestjs/common';
import { CommandHandler } from '../../../platform/command-bus/command-handler.decorator.js';
import type { HrCommandEnvelope, CommandResult } from '@hcm/command-contracts';
import { Uuid } from '@hcm/shared-kernel';
import { FsmFramework } from '../../../platform/workflow/fsm-framework.js';
import { HrCaseTaskRepository } from '../repositories/hr-case-task.repository.js';
import { HrServiceDeliveryEventsPublisher } from '../events/hr-service-delivery-events.publisher.js';

@CommandHandler('CompleteHrCaseTask')
@Injectable()
export class CompleteHrCaseTaskHandler {
  constructor(
    private readonly repo: HrCaseTaskRepository,
    private readonly fsm: FsmFramework,
    private readonly publisher: HrServiceDeliveryEventsPublisher,
  ) {}

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>> {
    const payload = command.payload as { hrCaseTaskId: Uuid };
    const ar = await this.repo.findById(payload.hrCaseTaskId);
    if (!ar) throw new Error('HR case task not found');
    ar.complete(command.correlationId);
    await this.repo.save(ar);
    await this.publisher.publishFromAggregate(ar);
    return {
      success: true,
      data: { hrCaseTaskId: ar.id.value, status: ar.status },
      commandId: command.commandId,
      correlationId: command.correlationId,
      aggregateId: ar.id,
      newState: ar.status,
      newVersion: ar.aggregateVersion,
      allowedNextActions: this.fsm.getAllowedActionsFromState(ar.status, 'HrCaseTask'),
      eventsEmitted: ar.domainEvents.map((e) => e.eventName),
      auditRecordId: command.commandId,
    } as CommandResult<unknown>;
  }
}
''')

write(BASE/"hr-service-delivery/commands/mark-overdue-hr-case-task.handler.ts", '''import { Injectable } from '@nestjs/common';
import { CommandHandler } from '../../../platform/command-bus/command-handler.decorator.js';
import type { HrCommandEnvelope, CommandResult } from '@hcm/command-contracts';
import { Uuid } from '@hcm/shared-kernel';
import { FsmFramework } from '../../../platform/workflow/fsm-framework.js';
import { HrCaseTaskRepository } from '../repositories/hr-case-task.repository.js';
import { HrServiceDeliveryEventsPublisher } from '../events/hr-service-delivery-events.publisher.js';

@CommandHandler('MarkOverdueHrCaseTask')
@Injectable()
export class MarkOverdueHrCaseTaskHandler {
  constructor(
    private readonly repo: HrCaseTaskRepository,
    private readonly fsm: FsmFramework,
    private readonly publisher: HrServiceDeliveryEventsPublisher,
  ) {}

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>> {
    const payload = command.payload as { hrCaseTaskId: Uuid };
    const ar = await this.repo.findById(payload.hrCaseTaskId);
    if (!ar) throw new Error('HR case task not found');
    ar.markOverdue(command.correlationId);
    await this.repo.save(ar);
    await this.publisher.publishFromAggregate(ar);
    return {
      success: true,
      data: { hrCaseTaskId: ar.id.value, status: ar.status },
      commandId: command.commandId,
      correlationId: command.correlationId,
      aggregateId: ar.id,
      newState: ar.status,
      newVersion: ar.aggregateVersion,
      allowedNextActions: this.fsm.getAllowedActionsFromState(ar.status, 'HrCaseTask'),
      eventsEmitted: ar.domainEvents.map((e) => e.eventName),
      auditRecordId: command.commandId,
    } as CommandResult<unknown>;
  }
}
''')

write(BASE/"hr-service-delivery/commands/cancel-hr-case-task.handler.ts", '''import { Injectable } from '@nestjs/common';
import { CommandHandler } from '../../../platform/command-bus/command-handler.decorator.js';
import type { HrCommandEnvelope, CommandResult } from '@hcm/command-contracts';
import { Uuid } from '@hcm/shared-kernel';
import { FsmFramework } from '../../../platform/workflow/fsm-framework.js';
import { HrCaseTaskRepository } from '../repositories/hr-case-task.repository.js';
import { HrServiceDeliveryEventsPublisher } from '../events/hr-service-delivery-events.publisher.js';

@CommandHandler('CancelHrCaseTask')
@Injectable()
export class CancelHrCaseTaskHandler {
  constructor(
    private readonly repo: HrCaseTaskRepository,
    private readonly fsm: FsmFramework,
    private readonly publisher: HrServiceDeliveryEventsPublisher,
  ) {}

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>> {
    const payload = command.payload as { hrCaseTaskId: Uuid };
    const ar = await this.repo.findById(payload.hrCaseTaskId);
    if (!ar) throw new Error('HR case task not found');
    ar.cancel(command.correlationId);
    await this.repo.save(ar);
    await this.publisher.publishFromAggregate(ar);
    return {
      success: true,
      data: { hrCaseTaskId: ar.id.value, status: ar.status },
      commandId: command.commandId,
      correlationId: command.correlationId,
      aggregateId: ar.id,
      newState: ar.status,
      newVersion: ar.aggregateVersion,
      allowedNextActions: this.fsm.getAllowedActionsFromState(ar.status, 'HrCaseTask'),
      eventsEmitted: ar.domainEvents.map((e) => e.eventName),
      auditRecordId: command.commandId,
    } as CommandResult<unknown>;
  }
}
''')

# HrKnowledgeArticle
write(BASE/"hr-service-delivery/commands/create-hr-knowledge-article.handler.ts", '''import { Injectable } from '@nestjs/common';
import { CommandHandler } from '../../../platform/command-bus/command-handler.decorator.js';
import type { HrCommandEnvelope, CommandResult } from '@hcm/command-contracts';
import { Uuid } from '@hcm/shared-kernel';
import { FsmFramework } from '../../../platform/workflow/fsm-framework.js';
import { HrKnowledgeArticle } from '../aggregates/hr-knowledge-article.aggregate.js';
import { HrKnowledgeArticleRepository } from '../repositories/hr-knowledge-article.repository.js';
import { HrServiceDeliveryEventsPublisher } from '../events/hr-service-delivery-events.publisher.js';

@CommandHandler('CreateHrKnowledgeArticle')
@Injectable()
export class CreateHrKnowledgeArticleHandler {
  constructor(
    private readonly repo: HrKnowledgeArticleRepository,
    private readonly fsm: FsmFramework,
    private readonly publisher: HrServiceDeliveryEventsPublisher,
  ) {}

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>> {
    const payload = command.payload as { title: string; content: string; category: string; tags?: string[] };
    const ar = HrKnowledgeArticle.create(
      { id: Uuid.generate(), tenantId: command.tenantId, ...payload },
      command.correlationId,
    );
    await this.repo.save(ar);
    await this.publisher.publishFromAggregate(ar);
    return {
      success: true,
      data: { hrKnowledgeArticleId: ar.id.value, status: ar.status },
      commandId: command.commandId,
      correlationId: command.correlationId,
      aggregateId: ar.id,
      newState: ar.status,
      newVersion: ar.aggregateVersion,
      allowedNextActions: this.fsm.getAllowedActionsFromState(ar.status, 'HrKnowledgeArticle'),
      eventsEmitted: ar.domainEvents.map((e) => e.eventName),
      auditRecordId: command.commandId,
    } as CommandResult<unknown>;
  }
}
''')

write(BASE/"hr-service-delivery/commands/publish-hr-knowledge-article.handler.ts", '''import { Injectable } from '@nestjs/common';
import { CommandHandler } from '../../../platform/command-bus/command-handler.decorator.js';
import type { HrCommandEnvelope, CommandResult } from '@hcm/command-contracts';
import { Uuid } from '@hcm/shared-kernel';
import { FsmFramework } from '../../../platform/workflow/fsm-framework.js';
import { HrKnowledgeArticleRepository } from '../repositories/hr-knowledge-article.repository.js';
import { HrServiceDeliveryEventsPublisher } from '../events/hr-service-delivery-events.publisher.js';

@CommandHandler('PublishHrKnowledgeArticle')
@Injectable()
export class PublishHrKnowledgeArticleHandler {
  constructor(
    private readonly repo: HrKnowledgeArticleRepository,
    private readonly fsm: FsmFramework,
    private readonly publisher: HrServiceDeliveryEventsPublisher,
  ) {}

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>> {
    const payload = command.payload as { hrKnowledgeArticleId: Uuid };
    const ar = await this.repo.findById(payload.hrKnowledgeArticleId);
    if (!ar) throw new Error('HR knowledge article not found');
    ar.publish(command.correlationId);
    await this.repo.save(ar);
    await this.publisher.publishFromAggregate(ar);
    return {
      success: true,
      data: { hrKnowledgeArticleId: ar.id.value, status: ar.status },
      commandId: command.commandId,
      correlationId: command.correlationId,
      aggregateId: ar.id,
      newState: ar.status,
      newVersion: ar.aggregateVersion,
      allowedNextActions: this.fsm.getAllowedActionsFromState(ar.status, 'HrKnowledgeArticle'),
      eventsEmitted: ar.domainEvents.map((e) => e.eventName),
      auditRecordId: command.commandId,
    } as CommandResult<unknown>;
  }
}
''')

write(BASE/"hr-service-delivery/commands/archive-hr-knowledge-article.handler.ts", '''import { Injectable } from '@nestjs/common';
import { CommandHandler } from '../../../platform/command-bus/command-handler.decorator.js';
import type { HrCommandEnvelope, CommandResult } from '@hcm/command-contracts';
import { Uuid } from '@hcm/shared-kernel';
import { FsmFramework } from '../../../platform/workflow/fsm-framework.js';
import { HrKnowledgeArticleRepository } from '../repositories/hr-knowledge-article.repository.js';
import { HrServiceDeliveryEventsPublisher } from '../events/hr-service-delivery-events.publisher.js';

@CommandHandler('ArchiveHrKnowledgeArticle')
@Injectable()
export class ArchiveHrKnowledgeArticleHandler {
  constructor(
    private readonly repo: HrKnowledgeArticleRepository,
    private readonly fsm: FsmFramework,
    private readonly publisher: HrServiceDeliveryEventsPublisher,
  ) {}

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>> {
    const payload = command.payload as { hrKnowledgeArticleId: Uuid };
    const ar = await this.repo.findById(payload.hrKnowledgeArticleId);
    if (!ar) throw new Error('HR knowledge article not found');
    ar.archive(command.correlationId);
    await this.repo.save(ar);
    await this.publisher.publishFromAggregate(ar);
    return {
      success: true,
      data: { hrKnowledgeArticleId: ar.id.value, status: ar.status },
      commandId: command.commandId,
      correlationId: command.correlationId,
      aggregateId: ar.id,
      newState: ar.status,
      newVersion: ar.aggregateVersion,
      allowedNextActions: this.fsm.getAllowedActionsFromState(ar.status, 'HrKnowledgeArticle'),
      eventsEmitted: ar.domainEvents.map((e) => e.eventName),
      auditRecordId: command.commandId,
    } as CommandResult<unknown>;
  }
}
''')

# HrServiceCatalogItem
write(BASE/"hr-service-delivery/commands/create-hr-service-catalog-item.handler.ts", '''import { Injectable } from '@nestjs/common';
import { CommandHandler } from '../../../platform/command-bus/command-handler.decorator.js';
import type { HrCommandEnvelope, CommandResult } from '@hcm/command-contracts';
import { Uuid } from '@hcm/shared-kernel';
import { FsmFramework } from '../../../platform/workflow/fsm-framework.js';
import { HrServiceCatalogItem } from '../aggregates/hr-service-catalog-item.aggregate.js';
import { HrServiceCatalogItemRepository } from '../repositories/hr-service-catalog-item.repository.js';
import { HrServiceDeliveryEventsPublisher } from '../events/hr-service-delivery-events.publisher.js';

@CommandHandler('CreateHrServiceCatalogItem')
@Injectable()
export class CreateHrServiceCatalogItemHandler {
  constructor(
    private readonly repo: HrServiceCatalogItemRepository,
    private readonly fsm: FsmFramework,
    private readonly publisher: HrServiceDeliveryEventsPublisher,
  ) {}

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>> {
    const payload = command.payload as { serviceCode: string; serviceName: string; description: string; category: string; slaHours: number; fulfillmentProcess: string };
    const ar = HrServiceCatalogItem.create(
      { id: Uuid.generate(), tenantId: command.tenantId, ...payload },
      command.correlationId,
    );
    await this.repo.save(ar);
    await this.publisher.publishFromAggregate(ar);
    return {
      success: true,
      data: { hrServiceCatalogItemId: ar.id.value, status: ar.status },
      commandId: command.commandId,
      correlationId: command.correlationId,
      aggregateId: ar.id,
      newState: ar.status,
      newVersion: ar.aggregateVersion,
      allowedNextActions: this.fsm.getAllowedActionsFromState(ar.status, 'HrServiceCatalogItem'),
      eventsEmitted: ar.domainEvents.map((e) => e.eventName),
      auditRecordId: command.commandId,
    } as CommandResult<unknown>;
  }
}
''')

write(BASE/"hr-service-delivery/commands/activate-hr-service-catalog-item.handler.ts", '''import { Injectable } from '@nestjs/common';
import { CommandHandler } from '../../../platform/command-bus/command-handler.decorator.js';
import type { HrCommandEnvelope, CommandResult } from '@hcm/command-contracts';
import { Uuid } from '@hcm/shared-kernel';
import { FsmFramework } from '../../../platform/workflow/fsm-framework.js';
import { HrServiceCatalogItemRepository } from '../repositories/hr-service-catalog-item.repository.js';
import { HrServiceDeliveryEventsPublisher } from '../events/hr-service-delivery-events.publisher.js';

@CommandHandler('ActivateHrServiceCatalogItem')
@Injectable()
export class ActivateHrServiceCatalogItemHandler {
  constructor(
    private readonly repo: HrServiceCatalogItemRepository,
    private readonly fsm: FsmFramework,
    private readonly publisher: HrServiceDeliveryEventsPublisher,
  ) {}

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>> {
    const payload = command.payload as { hrServiceCatalogItemId: Uuid };
    const ar = await this.repo.findById(payload.hrServiceCatalogItemId);
    if (!ar) throw new Error('HR service catalog item not found');
    ar.activate(command.correlationId);
    await this.repo.save(ar);
    await this.publisher.publishFromAggregate(ar);
    return {
      success: true,
      data: { hrServiceCatalogItemId: ar.id.value, status: ar.status },
      commandId: command.commandId,
      correlationId: command.correlationId,
      aggregateId: ar.id,
      newState: ar.status,
      newVersion: ar.aggregateVersion,
      allowedNextActions: this.fsm.getAllowedActionsFromState(ar.status, 'HrServiceCatalogItem'),
      eventsEmitted: ar.domainEvents.map((e) => e.eventName),
      auditRecordId: command.commandId,
    } as CommandResult<unknown>;
  }
}
''')

write(BASE/"hr-service-delivery/commands/suspend-hr-service-catalog-item.handler.ts", '''import { Injectable } from '@nestjs/common';
import { CommandHandler } from '../../../platform/command-bus/command-handler.decorator.js';
import type { HrCommandEnvelope, CommandResult } from '@hcm/command-contracts';
import { Uuid } from '@hcm/shared-kernel';
import { FsmFramework } from '../../../platform/workflow/fsm-framework.js';
import { HrServiceCatalogItemRepository } from '../repositories/hr-service-catalog-item.repository.js';
import { HrServiceDeliveryEventsPublisher } from '../events/hr-service-delivery-events.publisher.js';

@CommandHandler('SuspendHrServiceCatalogItem')
@Injectable()
export class SuspendHrServiceCatalogItemHandler {
  constructor(
    private readonly repo: HrServiceCatalogItemRepository,
    private readonly fsm: FsmFramework,
    private readonly publisher: HrServiceDeliveryEventsPublisher,
  ) {}

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>> {
    const payload = command.payload as { hrServiceCatalogItemId: Uuid };
    const ar = await this.repo.findById(payload.hrServiceCatalogItemId);
    if (!ar) throw new Error('HR service catalog item not found');
    ar.suspend(command.correlationId);
    await this.repo.save(ar);
    await this.publisher.publishFromAggregate(ar);
    return {
      success: true,
      data: { hrServiceCatalogItemId: ar.id.value, status: ar.status },
      commandId: command.commandId,
      correlationId: command.correlationId,
      aggregateId: ar.id,
      newState: ar.status,
      newVersion: ar.aggregateVersion,
      allowedNextActions: this.fsm.getAllowedActionsFromState(ar.status, 'HrServiceCatalogItem'),
      eventsEmitted: ar.domainEvents.map((e) => e.eventName),
      auditRecordId: command.commandId,
    } as CommandResult<unknown>;
  }
}
''')

write(BASE/"hr-service-delivery/commands/retire-hr-service-catalog-item.handler.ts", '''import { Injectable } from '@nestjs/common';
import { CommandHandler } from '../../../platform/command-bus/command-handler.decorator.js';
import type { HrCommandEnvelope, CommandResult } from '@hcm/command-contracts';
import { Uuid } from '@hcm/shared-kernel';
import { FsmFramework } from '../../../platform/workflow/fsm-framework.js';
import { HrServiceCatalogItemRepository } from '../repositories/hr-service-catalog-item.repository.js';
import { HrServiceDeliveryEventsPublisher } from '../events/hr-service-delivery-events.publisher.js';

@CommandHandler('RetireHrServiceCatalogItem')
@Injectable()
export class RetireHrServiceCatalogItemHandler {
  constructor(
    private readonly repo: HrServiceCatalogItemRepository,
    private readonly fsm: FsmFramework,
    private readonly publisher: HrServiceDeliveryEventsPublisher,
  ) {}

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>> {
    const payload = command.payload as { hrServiceCatalogItemId: Uuid };
    const ar = await this.repo.findById(payload.hrServiceCatalogItemId);
    if (!ar) throw new Error('HR service catalog item not found');
    ar.retire(command.correlationId);
    await this.repo.save(ar);
    await this.publisher.publishFromAggregate(ar);
    return {
      success: true,
      data: { hrServiceCatalogItemId: ar.id.value, status: ar.status },
      commandId: command.commandId,
      correlationId: command.correlationId,
      aggregateId: ar.id,
      newState: ar.status,
      newVersion: ar.aggregateVersion,
      allowedNextActions: this.fsm.getAllowedActionsFromState(ar.status, 'HrServiceCatalogItem'),
      eventsEmitted: ar.domainEvents.map((e) => e.eventName),
      auditRecordId: command.commandId,
    } as CommandResult<unknown>;
  }
}
''')

# HrCaseSlaInstance
write(BASE/"hr-service-delivery/commands/create-hr-case-sla-instance.handler.ts", '''import { Injectable } from '@nestjs/common';
import { CommandHandler } from '../../../platform/command-bus/command-handler.decorator.js';
import type { HrCommandEnvelope, CommandResult } from '@hcm/command-contracts';
import { Uuid } from '@hcm/shared-kernel';
import { FsmFramework } from '../../../platform/workflow/fsm-framework.js';
import { HrCaseSlaInstance } from '../aggregates/hr-case-sla-instance.aggregate.js';
import { HrCaseSlaInstanceRepository } from '../repositories/hr-case-sla-instance.repository.js';
import { HrServiceDeliveryEventsPublisher } from '../events/hr-service-delivery-events.publisher.js';

@CommandHandler('CreateHrCaseSlaInstance')
@Injectable()
export class CreateHrCaseSlaInstanceHandler {
  constructor(
    private readonly repo: HrCaseSlaInstanceRepository,
    private readonly fsm: FsmFramework,
    private readonly publisher: HrServiceDeliveryEventsPublisher,
  ) {}

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>> {
    const payload = command.payload as { caseId: Uuid; slaDefinitionId: Uuid; deadlineAt: Date };
    const ar = HrCaseSlaInstance.create(
      { id: Uuid.generate(), tenantId: command.tenantId, ...payload },
      command.correlationId,
    );
    await this.repo.save(ar);
    await this.publisher.publishFromAggregate(ar);
    return {
      success: true,
      data: { hrCaseSlaInstanceId: ar.id.value, status: ar.status },
      commandId: command.commandId,
      correlationId: command.correlationId,
      aggregateId: ar.id,
      newState: ar.status,
      newVersion: ar.aggregateVersion,
      allowedNextActions: this.fsm.getAllowedActionsFromState(ar.status, 'HrCaseSlaInstance'),
      eventsEmitted: ar.domainEvents.map((e) => e.eventName),
      auditRecordId: command.commandId,
    } as CommandResult<unknown>;
  }
}
''')

write(BASE/"hr-service-delivery/commands/breach-hr-case-sla-instance.handler.ts", '''import { Injectable } from '@nestjs/common';
import { CommandHandler } from '../../../platform/command-bus/command-handler.decorator.js';
import type { HrCommandEnvelope, CommandResult } from '@hcm/command-contracts';
import { Uuid } from '@hcm/shared-kernel';
import { FsmFramework } from '../../../platform/workflow/fsm-framework.js';
import { HrCaseSlaInstanceRepository } from '../repositories/hr-case-sla-instance.repository.js';
import { HrServiceDeliveryEventsPublisher } from '../events/hr-service-delivery-events.publisher.js';

@CommandHandler('BreachHrCaseSlaInstance')
@Injectable()
export class BreachHrCaseSlaInstanceHandler {
  constructor(
    private readonly repo: HrCaseSlaInstanceRepository,
    private readonly fsm: FsmFramework,
    private readonly publisher: HrServiceDeliveryEventsPublisher,
  ) {}

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>> {
    const payload = command.payload as { hrCaseSlaInstanceId: Uuid };
    const ar = await this.repo.findById(payload.hrCaseSlaInstanceId);
    if (!ar) throw new Error('HR case SLA instance not found');
    ar.breach(command.correlationId);
    await this.repo.save(ar);
    await this.publisher.publishFromAggregate(ar);
    return {
      success: true,
      data: { hrCaseSlaInstanceId: ar.id.value, status: ar.status },
      commandId: command.commandId,
      correlationId: command.correlationId,
      aggregateId: ar.id,
      newState: ar.status,
      newVersion: ar.aggregateVersion,
      allowedNextActions: this.fsm.getAllowedActionsFromState(ar.status, 'HrCaseSlaInstance'),
      eventsEmitted: ar.domainEvents.map((e) => e.eventName),
      auditRecordId: command.commandId,
    } as CommandResult<unknown>;
  }
}
''')

write(BASE/"hr-service-delivery/commands/meet-hr-case-sla-instance.handler.ts", '''import { Injectable } from '@nestjs/common';
import { CommandHandler } from '../../../platform/command-bus/command-handler.decorator.js';
import type { HrCommandEnvelope, CommandResult } from '@hcm/command-contracts';
import { Uuid } from '@hcm/shared-kernel';
import { FsmFramework } from '../../../platform/workflow/fsm-framework.js';
import { HrCaseSlaInstanceRepository } from '../repositories/hr-case-sla-instance.repository.js';
import { HrServiceDeliveryEventsPublisher } from '../events/hr-service-delivery-events.publisher.js';

@CommandHandler('MeetHrCaseSlaInstance')
@Injectable()
export class MeetHrCaseSlaInstanceHandler {
  constructor(
    private readonly repo: HrCaseSlaInstanceRepository,
    private readonly fsm: FsmFramework,
    private readonly publisher: HrServiceDeliveryEventsPublisher,
  ) {}

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>> {
    const payload = command.payload as { hrCaseSlaInstanceId: Uuid };
    const ar = await this.repo.findById(payload.hrCaseSlaInstanceId);
    if (!ar) throw new Error('HR case SLA instance not found');
    ar.meet(command.correlationId);
    await this.repo.save(ar);
    await this.publisher.publishFromAggregate(ar);
    return {
      success: true,
      data: { hrCaseSlaInstanceId: ar.id.value, status: ar.status },
      commandId: command.commandId,
      correlationId: command.correlationId,
      aggregateId: ar.id,
      newState: ar.status,
      newVersion: ar.aggregateVersion,
      allowedNextActions: this.fsm.getAllowedActionsFromState(ar.status, 'HrCaseSlaInstance'),
      eventsEmitted: ar.domainEvents.map((e) => e.eventName),
      auditRecordId: command.commandId,
    } as CommandResult<unknown>;
  }
}
''')

write(BASE/"hr-service-delivery/commands/exempt-hr-case-sla-instance.handler.ts", '''import { Injectable } from '@nestjs/common';
import { CommandHandler } from '../../../platform/command-bus/command-handler.decorator.js';
import type { HrCommandEnvelope, CommandResult } from '@hcm/command-contracts';
import { Uuid } from '@hcm/shared-kernel';
import { FsmFramework } from '../../../platform/workflow/fsm-framework.js';
import { HrCaseSlaInstanceRepository } from '../repositories/hr-case-sla-instance.repository.js';
import { HrServiceDeliveryEventsPublisher } from '../events/hr-service-delivery-events.publisher.js';

@CommandHandler('ExemptHrCaseSlaInstance')
@Injectable()
export class ExemptHrCaseSlaInstanceHandler {
  constructor(
    private readonly repo: HrCaseSlaInstanceRepository,
    private readonly fsm: FsmFramework,
    private readonly publisher: HrServiceDeliveryEventsPublisher,
  ) {}

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>> {
    const payload = command.payload as { hrCaseSlaInstanceId: Uuid; exemptReason: string };
    const ar = await this.repo.findById(payload.hrCaseSlaInstanceId);
    if (!ar) throw new Error('HR case SLA instance not found');
    ar.exempt(payload.exemptReason, command.correlationId);
    await this.repo.save(ar);
    await this.publisher.publishFromAggregate(ar);
    return {
      success: true,
      data: { hrCaseSlaInstanceId: ar.id.value, status: ar.status },
      commandId: command.commandId,
      correlationId: command.correlationId,
      aggregateId: ar.id,
      newState: ar.status,
      newVersion: ar.aggregateVersion,
      allowedNextActions: this.fsm.getAllowedActionsFromState(ar.status, 'HrCaseSlaInstance'),
      eventsEmitted: ar.domainEvents.map((e) => e.eventName),
      auditRecordId: command.commandId,
    } as CommandResult<unknown>;
  }
}
''')

print("HRSD command handlers done")

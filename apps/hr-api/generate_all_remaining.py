import pathlib

BASE = pathlib.Path(__file__).parent / "src" / "domains"

def write(p, c):
    p = pathlib.Path(p)
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(c, encoding="utf-8")
    print(f"Wrote {p}")

# ========================================================================
# CW - Command Handlers (18 files)
# ========================================================================

write(BASE/"contingent-workforce/commands/create-contingent-worker-assignment.handler.ts", '''import { Injectable } from '@nestjs/common';
import { CommandHandler } from '../../../platform/command-bus/command-handler.decorator.js';
import type { HrCommandEnvelope, CommandResult } from '@hcm/command-contracts';
import { Uuid } from '@hcm/shared-kernel';
import { FsmFramework } from '../../../platform/workflow/fsm-framework.js';
import { ContingentWorkerAssignment } from '../aggregates/contingent-worker-assignment.aggregate.js';
import { ContingentWorkerAssignmentRepository } from '../repositories/contingent-worker-assignment.repository.js';
import { ContingentWorkforceEventsPublisher } from '../events/contingent-workforce-events.publisher.js';

@CommandHandler('CreateContingentWorkerAssignment')
@Injectable()
export class CreateContingentWorkerAssignmentHandler {
  constructor(
    private readonly repo: ContingentWorkerAssignmentRepository,
    private readonly fsm: FsmFramework,
    private readonly publisher: ContingentWorkforceEventsPublisher,
  ) {}

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>> {
    const payload = command.payload as { workerId: Uuid; vendorId: Uuid; projectId: Uuid; startDate: Date; endDate: Date; rate: number; currency: string };
    const ar = ContingentWorkerAssignment.create({ id: Uuid.generate(), tenantId: command.tenantId, ...payload }, command.correlationId);
    await this.repo.save(ar);
    await this.publisher.publishFromAggregate(ar);
    return {
      success: true,
      data: { contingentWorkerAssignmentId: ar.id.value, status: ar.status },
      commandId: command.commandId,
      correlationId: command.correlationId,
      aggregateId: ar.id,
      newState: ar.status,
      newVersion: ar.aggregateVersion,
      allowedNextActions: this.fsm.getAllowedActionsFromState(ar.status, 'ContingentWorkerAssignment'),
      eventsEmitted: ar.domainEvents.map((e) => e.eventName),
      auditRecordId: command.commandId,
    } as CommandResult<unknown>;
  }
}
''')

write(BASE/"contingent-workforce/commands/activate-contingent-worker-assignment.handler.ts", '''import { Injectable } from '@nestjs/common';
import { CommandHandler } from '../../../platform/command-bus/command-handler.decorator.js';
import type { HrCommandEnvelope, CommandResult } from '@hcm/command-contracts';
import { Uuid } from '@hcm/shared-kernel';
import { FsmFramework } from '../../../platform/workflow/fsm-framework.js';
import { ContingentWorkerAssignmentRepository } from '../repositories/contingent-worker-assignment.repository.js';
import { ContingentWorkforceEventsPublisher } from '../events/contingent-workforce-events.publisher.js';

@CommandHandler('ActivateContingentWorkerAssignment')
@Injectable()
export class ActivateContingentWorkerAssignmentHandler {
  constructor(
    private readonly repo: ContingentWorkerAssignmentRepository,
    private readonly fsm: FsmFramework,
    private readonly publisher: ContingentWorkforceEventsPublisher,
  ) {}

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>> {
    const payload = command.payload as { contingentWorkerAssignmentId: Uuid };
    const ar = await this.repo.findById(payload.contingentWorkerAssignmentId);
    if (!ar) throw new Error('Contingent worker assignment not found');
    ar.activate(command.correlationId);
    await this.repo.save(ar);
    await this.publisher.publishFromAggregate(ar);
    return {
      success: true,
      data: { contingentWorkerAssignmentId: ar.id.value, status: ar.status },
      commandId: command.commandId,
      correlationId: command.correlationId,
      aggregateId: ar.id,
      newState: ar.status,
      newVersion: ar.aggregateVersion,
      allowedNextActions: this.fsm.getAllowedActionsFromState(ar.status, 'ContingentWorkerAssignment'),
      eventsEmitted: ar.domainEvents.map((e) => e.eventName),
      auditRecordId: command.commandId,
    } as CommandResult<unknown>;
  }
}
''')

write(BASE/"contingent-workforce/commands/extend-contingent-worker-assignment.handler.ts", '''import { Injectable } from '@nestjs/common';
import { CommandHandler } from '../../../platform/command-bus/command-handler.decorator.js';
import type { HrCommandEnvelope, CommandResult } from '@hcm/command-contracts';
import { Uuid } from '@hcm/shared-kernel';
import { FsmFramework } from '../../../platform/workflow/fsm-framework.js';
import { ContingentWorkerAssignmentRepository } from '../repositories/contingent-worker-assignment.repository.js';
import { ContingentWorkforceEventsPublisher } from '../events/contingent-workforce-events.publisher.js';

@CommandHandler('ExtendContingentWorkerAssignment')
@Injectable()
export class ExtendContingentWorkerAssignmentHandler {
  constructor(
    private readonly repo: ContingentWorkerAssignmentRepository,
    private readonly fsm: FsmFramework,
    private readonly publisher: ContingentWorkforceEventsPublisher,
  ) {}

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>> {
    const payload = command.payload as { contingentWorkerAssignmentId: Uuid };
    const ar = await this.repo.findById(payload.contingentWorkerAssignmentId);
    if (!ar) throw new Error('Contingent worker assignment not found');
    ar.extend(command.correlationId);
    await this.repo.save(ar);
    await this.publisher.publishFromAggregate(ar);
    return {
      success: true,
      data: { contingentWorkerAssignmentId: ar.id.value, status: ar.status },
      commandId: command.commandId,
      correlationId: command.correlationId,
      aggregateId: ar.id,
      newState: ar.status,
      newVersion: ar.aggregateVersion,
      allowedNextActions: this.fsm.getAllowedActionsFromState(ar.status, 'ContingentWorkerAssignment'),
      eventsEmitted: ar.domainEvents.map((e) => e.eventName),
      auditRecordId: command.commandId,
    } as CommandResult<unknown>;
  }
}
''')

write(BASE/"contingent-workforce/commands/terminate-contingent-worker-assignment.handler.ts", '''import { Injectable } from '@nestjs/common';
import { CommandHandler } from '../../../platform/command-bus/command-handler.decorator.js';
import type { HrCommandEnvelope, CommandResult } from '@hcm/command-contracts';
import { Uuid } from '@hcm/shared-kernel';
import { FsmFramework } from '../../../platform/workflow/fsm-framework.js';
import { ContingentWorkerAssignmentRepository } from '../repositories/contingent-worker-assignment.repository.js';
import { ContingentWorkforceEventsPublisher } from '../events/contingent-workforce-events.publisher.js';

@CommandHandler('TerminateContingentWorkerAssignment')
@Injectable()
export class TerminateContingentWorkerAssignmentHandler {
  constructor(
    private readonly repo: ContingentWorkerAssignmentRepository,
    private readonly fsm: FsmFramework,
    private readonly publisher: ContingentWorkforceEventsPublisher,
  ) {}

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>> {
    const payload = command.payload as { contingentWorkerAssignmentId: Uuid };
    const ar = await this.repo.findById(payload.contingentWorkerAssignmentId);
    if (!ar) throw new Error('Contingent worker assignment not found');
    ar.terminate(command.correlationId);
    await this.repo.save(ar);
    await this.publisher.publishFromAggregate(ar);
    return {
      success: true,
      data: { contingentWorkerAssignmentId: ar.id.value, status: ar.status },
      commandId: command.commandId,
      correlationId: command.correlationId,
      aggregateId: ar.id,
      newState: ar.status,
      newVersion: ar.aggregateVersion,
      allowedNextActions: this.fsm.getAllowedActionsFromState(ar.status, 'ContingentWorkerAssignment'),
      eventsEmitted: ar.domainEvents.map((e) => e.eventName),
      auditRecordId: command.commandId,
    } as CommandResult<unknown>;
  }
}
''')

write(BASE/"contingent-workforce/commands/create-sow-engagement.handler.ts", '''import { Injectable } from '@nestjs/common';
import { CommandHandler } from '../../../platform/command-bus/command-handler.decorator.js';
import type { HrCommandEnvelope, CommandResult } from '@hcm/command-contracts';
import { Uuid } from '@hcm/shared-kernel';
import { FsmFramework } from '../../../platform/workflow/fsm-framework.js';
import { SowEngagement } from '../aggregates/sow-engagement.aggregate.js';
import { SowEngagementRepository } from '../repositories/sow-engagement.repository.js';
import { ContingentWorkforceEventsPublisher } from '../events/contingent-workforce-events.publisher.js';

@CommandHandler('CreateSowEngagement')
@Injectable()
export class CreateSowEngagementHandler {
  constructor(
    private readonly repo: SowEngagementRepository,
    private readonly fsm: FsmFramework,
    private readonly publisher: ContingentWorkforceEventsPublisher,
  ) {}

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>> {
    const payload = command.payload as { sowNumber: string; vendorId: Uuid; projectName: string; totalValue: number; currency: string; startDate: Date; endDate: Date; milestones?: string[] };
    const ar = SowEngagement.create({ id: Uuid.generate(), tenantId: command.tenantId, ...payload }, command.correlationId);
    await this.repo.save(ar);
    await this.publisher.publishFromAggregate(ar);
    return {
      success: true,
      data: { sowEngagementId: ar.id.value, status: ar.status },
      commandId: command.commandId,
      correlationId: command.correlationId,
      aggregateId: ar.id,
      newState: ar.status,
      newVersion: ar.aggregateVersion,
      allowedNextActions: this.fsm.getAllowedActionsFromState(ar.status, 'SowEngagement'),
      eventsEmitted: ar.domainEvents.map((e) => e.eventName),
      auditRecordId: command.commandId,
    } as CommandResult<unknown>;
  }
}
''')

write(BASE/"contingent-workforce/commands/activate-sow-engagement.handler.ts", '''import { Injectable } from '@nestjs/common';
import { CommandHandler } from '../../../platform/command-bus/command-handler.decorator.js';
import type { HrCommandEnvelope, CommandResult } from '@hcm/command-contracts';
import { Uuid } from '@hcm/shared-kernel';
import { FsmFramework } from '../../../platform/workflow/fsm-framework.js';
import { SowEngagementRepository } from '../repositories/sow-engagement.repository.js';
import { ContingentWorkforceEventsPublisher } from '../events/contingent-workforce-events.publisher.js';

@CommandHandler('ActivateSowEngagement')
@Injectable()
export class ActivateSowEngagementHandler {
  constructor(
    private readonly repo: SowEngagementRepository,
    private readonly fsm: FsmFramework,
    private readonly publisher: ContingentWorkforceEventsPublisher,
  ) {}

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>> {
    const payload = command.payload as { sowEngagementId: Uuid };
    const ar = await this.repo.findById(payload.sowEngagementId);
    if (!ar) throw new Error('SOW engagement not found');
    ar.activate(command.correlationId);
    await this.repo.save(ar);
    await this.publisher.publishFromAggregate(ar);
    return {
      success: true,
      data: { sowEngagementId: ar.id.value, status: ar.status },
      commandId: command.commandId,
      correlationId: command.correlationId,
      aggregateId: ar.id,
      newState: ar.status,
      newVersion: ar.aggregateVersion,
      allowedNextActions: this.fsm.getAllowedActionsFromState(ar.status, 'SowEngagement'),
      eventsEmitted: ar.domainEvents.map((e) => e.eventName),
      auditRecordId: command.commandId,
    } as CommandResult<unknown>;
  }
}
''')

write(BASE/"contingent-workforce/commands/start-sow-engagement.handler.ts", '''import { Injectable } from '@nestjs/common';
import { CommandHandler } from '../../../platform/command-bus/command-handler.decorator.js';
import type { HrCommandEnvelope, CommandResult } from '@hcm/command-contracts';
import { Uuid } from '@hcm/shared-kernel';
import { FsmFramework } from '../../../platform/workflow/fsm-framework.js';
import { SowEngagementRepository } from '../repositories/sow-engagement.repository.js';
import { ContingentWorkforceEventsPublisher } from '../events/contingent-workforce-events.publisher.js';

@CommandHandler('StartSowEngagement')
@Injectable()
export class StartSowEngagementHandler {
  constructor(
    private readonly repo: SowEngagementRepository,
    private readonly fsm: FsmFramework,
    private readonly publisher: ContingentWorkforceEventsPublisher,
  ) {}

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>> {
    const payload = command.payload as { sowEngagementId: Uuid };
    const ar = await this.repo.findById(payload.sowEngagementId);
    if (!ar) throw new Error('SOW engagement not found');
    ar.start(command.correlationId);
    await this.repo.save(ar);
    await this.publisher.publishFromAggregate(ar);
    return {
      success: true,
      data: { sowEngagementId: ar.id.value, status: ar.status },
      commandId: command.commandId,
      correlationId: command.correlationId,
      aggregateId: ar.id,
      newState: ar.status,
      newVersion: ar.aggregateVersion,
      allowedNextActions: this.fsm.getAllowedActionsFromState(ar.status, 'SowEngagement'),
      eventsEmitted: ar.domainEvents.map((e) => e.eventName),
      auditRecordId: command.commandId,
    } as CommandResult<unknown>;
  }
}
''')

write(BASE/"contingent-workforce/commands/complete-sow-engagement.handler.ts", '''import { Injectable } from '@nestjs/common';
import { CommandHandler } from '../../../platform/command-bus/command-handler.decorator.js';
import type { HrCommandEnvelope, CommandResult } from '@hcm/command-contracts';
import { Uuid } from '@hcm/shared-kernel';
import { FsmFramework } from '../../../platform/workflow/fsm-framework.js';
import { SowEngagementRepository } from '../repositories/sow-engagement.repository.js';
import { ContingentWorkforceEventsPublisher } from '../events/contingent-workforce-events.publisher.js';

@CommandHandler('CompleteSowEngagement')
@Injectable()
export class CompleteSowEngagementHandler {
  constructor(
    private readonly repo: SowEngagementRepository,
    private readonly fsm: FsmFramework,
    private readonly publisher: ContingentWorkforceEventsPublisher,
  ) {}

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>> {
    const payload = command.payload as { sowEngagementId: Uuid };
    const ar = await this.repo.findById(payload.sowEngagementId);
    if (!ar) throw new Error('SOW engagement not found');
    ar.complete(command.correlationId);
    await this.repo.save(ar);
    await this.publisher.publishFromAggregate(ar);
    return {
      success: true,
      data: { sowEngagementId: ar.id.value, status: ar.status },
      commandId: command.commandId,
      correlationId: command.correlationId,
      aggregateId: ar.id,
      newState: ar.status,
      newVersion: ar.aggregateVersion,
      allowedNextActions: this.fsm.getAllowedActionsFromState(ar.status, 'SowEngagement'),
      eventsEmitted: ar.domainEvents.map((e) => e.eventName),
      auditRecordId: command.commandId,
    } as CommandResult<unknown>;
  }
}
''')

write(BASE/"contingent-workforce/commands/close-sow-engagement.handler.ts", '''import { Injectable } from '@nestjs/common';
import { CommandHandler } from '../../../platform/command-bus/command-handler.decorator.js';
import type { HrCommandEnvelope, CommandResult } from '@hcm/command-contracts';
import { Uuid } from '@hcm/shared-kernel';
import { FsmFramework } from '../../../platform/workflow/fsm-framework.js';
import { SowEngagementRepository } from '../repositories/sow-engagement.repository.js';
import { ContingentWorkforceEventsPublisher } from '../events/contingent-workforce-events.publisher.js';

@CommandHandler('CloseSowEngagement')
@Injectable()
export class CloseSowEngagementHandler {
  constructor(
    private readonly repo: SowEngagementRepository,
    private readonly fsm: FsmFramework,
    private readonly publisher: ContingentWorkforceEventsPublisher,
  ) {}

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>> {
    const payload = command.payload as { sowEngagementId: Uuid };
    const ar = await this.repo.findById(payload.sowEngagementId);
    if (!ar) throw new Error('SOW engagement not found');
    ar.close(command.correlationId);
    await this.repo.save(ar);
    await this.publisher.publishFromAggregate(ar);
    return {
      success: true,
      data: { sowEngagementId: ar.id.value, status: ar.status },
      commandId: command.commandId,
      correlationId: command.correlationId,
      aggregateId: ar.id,
      newState: ar.status,
      newVersion: ar.aggregateVersion,
      allowedNextActions: this.fsm.getAllowedActionsFromState(ar.status, 'SowEngagement'),
      eventsEmitted: ar.domainEvents.map((e) => e.eventName),
      auditRecordId: command.commandId,
    } as CommandResult<unknown>;
  }
}
''')

write(BASE/"contingent-workforce/commands/create-contractor-rate-card.handler.ts", '''import { Injectable } from '@nestjs/common';
import { CommandHandler } from '../../../platform/command-bus/command-handler.decorator.js';
import type { HrCommandEnvelope, CommandResult } from '@hcm/command-contracts';
import { Uuid } from '@hcm/shared-kernel';
import { FsmFramework } from '../../../platform/workflow/fsm-framework.js';
import { ContractorRateCard } from '../aggregates/contractor-rate-card.aggregate.js';
import { ContractorRateCardRepository } from '../repositories/contractor-rate-card.repository.js';
import { ContingentWorkforceEventsPublisher } from '../events/contingent-workforce-events.publisher.js';

@CommandHandler('CreateContractorRateCard')
@Injectable()
export class CreateContractorRateCardHandler {
  constructor(
    private readonly repo: ContractorRateCardRepository,
    private readonly fsm: FsmFramework,
    private readonly publisher: ContingentWorkforceEventsPublisher,
  ) {}

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>> {
    const payload = command.payload as { vendorId: Uuid; jobTitle: string; rate: number; currency: string; effectiveFrom: Date; effectiveUntil?: Date };
    const ar = ContractorRateCard.create({ id: Uuid.generate(), tenantId: command.tenantId, ...payload }, command.correlationId);
    await this.repo.save(ar);
    await this.publisher.publishFromAggregate(ar);
    return {
      success: true,
      data: { contractorRateCardId: ar.id.value, status: ar.status },
      commandId: command.commandId,
      correlationId: command.correlationId,
      aggregateId: ar.id,
      newState: ar.status,
      newVersion: ar.aggregateVersion,
      allowedNextActions: this.fsm.getAllowedActionsFromState(ar.status, 'ContractorRateCard'),
      eventsEmitted: ar.domainEvents.map((e) => e.eventName),
      auditRecordId: command.commandId,
    } as CommandResult<unknown>;
  }
}
''')

write(BASE/"contingent-workforce/commands/activate-contractor-rate-card.handler.ts", '''import { Injectable } from '@nestjs/common';
import { CommandHandler } from '../../../platform/command-bus/command-handler.decorator.js';
import type { HrCommandEnvelope, CommandResult } from '@hcm/command-contracts';
import { Uuid } from '@hcm/shared-kernel';
import { FsmFramework } from '../../../platform/workflow/fsm-framework.js';
import { ContractorRateCardRepository } from '../repositories/contractor-rate-card.repository.js';
import { ContingentWorkforceEventsPublisher } from '../events/contingent-workforce-events.publisher.js';

@CommandHandler('ActivateContractorRateCard')
@Injectable()
export class ActivateContractorRateCardHandler {
  constructor(
    private readonly repo: ContractorRateCardRepository,
    private readonly fsm: FsmFramework,
    private readonly publisher: ContingentWorkforceEventsPublisher,
  ) {}

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>> {
    const payload = command.payload as { contractorRateCardId: Uuid };
    const ar = await this.repo.findById(payload.contractorRateCardId);
    if (!ar) throw new Error('Contractor rate card not found');
    ar.activate(command.correlationId);
    await this.repo.save(ar);
    await this.publisher.publishFromAggregate(ar);
    return {
      success: true,
      data: { contractorRateCardId: ar.id.value, status: ar.status },
      commandId: command.commandId,
      correlationId: command.correlationId,
      aggregateId: ar.id,
      newState: ar.status,
      newVersion: ar.aggregateVersion,
      allowedNextActions: this.fsm.getAllowedActionsFromState(ar.status, 'ContractorRateCard'),
      eventsEmitted: ar.domainEvents.map((e) => e.eventName),
      auditRecordId: command.commandId,
    } as CommandResult<unknown>;
  }
}
''')

write(BASE/"contingent-workforce/commands/revise-contractor-rate-card.handler.ts", '''import { Injectable } from '@nestjs/common';
import { CommandHandler } from '../../../platform/command-bus/command-handler.decorator.js';
import type { HrCommandEnvelope, CommandResult } from '@hcm/command-contracts';
import { Uuid } from '@hcm/shared-kernel';
import { FsmFramework } from '../../../platform/workflow/fsm-framework.js';
import { ContractorRateCardRepository } from '../repositories/contractor-rate-card.repository.js';
import { ContingentWorkforceEventsPublisher } from '../events/contingent-workforce-events.publisher.js';

@CommandHandler('ReviseContractorRateCard')
@Injectable()
export class ReviseContractorRateCardHandler {
  constructor(
    private readonly repo: ContractorRateCardRepository,
    private readonly fsm: FsmFramework,
    private readonly publisher: ContingentWorkforceEventsPublisher,
  ) {}

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>> {
    const payload = command.payload as { contractorRateCardId: Uuid };
    const ar = await this.repo.findById(payload.contractorRateCardId);
    if (!ar) throw new Error('Contractor rate card not found');
    ar.revise(command.correlationId);
    await this.repo.save(ar);
    await this.publisher.publishFromAggregate(ar);
    return {
      success: true,
      data: { contractorRateCardId: ar.id.value, status: ar.status },
      commandId: command.commandId,
      correlationId: command.correlationId,
      aggregateId: ar.id,
      newState: ar.status,
      newVersion: ar.aggregateVersion,
      allowedNextActions: this.fsm.getAllowedActionsFromState(ar.status, 'ContractorRateCard'),
      eventsEmitted: ar.domainEvents.map((e) => e.eventName),
      auditRecordId: command.commandId,
    } as CommandResult<unknown>;
  }
}
''')

write(BASE/"contingent-workforce/commands/expire-contractor-rate-card.handler.ts", '''import { Injectable } from '@nestjs/common';
import { CommandHandler } from '../../../platform/command-bus/command-handler.decorator.js';
import type { HrCommandEnvelope, CommandResult } from '@hcm/command-contracts';
import { Uuid } from '@hcm/shared-kernel';
import { FsmFramework } from '../../../platform/workflow/fsm-framework.js';
import { ContractorRateCardRepository } from '../repositories/contractor-rate-card.repository.js';
import { ContingentWorkforceEventsPublisher } from '../events/contingent-workforce-events.publisher.js';

@CommandHandler('ExpireContractorRateCard')
@Injectable()
export class ExpireContractorRateCardHandler {
  constructor(
    private readonly repo: ContractorRateCardRepository,
    private readonly fsm: FsmFramework,
    private readonly publisher: ContingentWorkforceEventsPublisher,
  ) {}

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>> {
    const payload = command.payload as { contractorRateCardId: Uuid };
    const ar = await this.repo.findById(payload.contractorRateCardId);
    if (!ar) throw new Error('Contractor rate card not found');
    ar.expire(command.correlationId);
    await this.repo.save(ar);
    await this.publisher.publishFromAggregate(ar);
    return {
      success: true,
      data: { contractorRateCardId: ar.id.value, status: ar.status },
      commandId: command.commandId,
      correlationId: command.correlationId,
      aggregateId: ar.id,
      newState: ar.status,
      newVersion: ar.aggregateVersion,
      allowedNextActions: this.fsm.getAllowedActionsFromState(ar.status, 'ContractorRateCard'),
      eventsEmitted: ar.domainEvents.map((e) => e.eventName),
      auditRecordId: command.commandId,
    } as CommandResult<unknown>;
  }
}
''')

write(BASE/"contingent-workforce/commands/create-misclassification-assessment.handler.ts", '''import { Injectable } from '@nestjs/common';
import { CommandHandler } from '../../../platform/command-bus/command-handler.decorator.js';
import type { HrCommandEnvelope, CommandResult } from '@hcm/command-contracts';
import { Uuid } from '@hcm/shared-kernel';
import { FsmFramework } from '../../../platform/workflow/fsm-framework.js';
import { MisclassificationAssessment } from '../aggregates/misclassification-assessment.aggregate.js';
import { MisclassificationAssessmentRepository } from '../repositories/misclassification-assessment.repository.js';
import { ContingentWorkforceEventsPublisher } from '../events/contingent-workforce-events.publisher.js';

@CommandHandler('CreateMisclassificationAssessment')
@Injectable()
export class CreateMisclassificationAssessmentHandler {
  constructor(
    private readonly repo: MisclassificationAssessmentRepository,
    private readonly fsm: FsmFramework,
    private readonly publisher: ContingentWorkforceEventsPublisher,
  ) {}

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>> {
    const payload = command.payload as { workerId: Uuid; assessmentDate: Date; riskScore?: number; riskFactors?: string[] };
    const ar = MisclassificationAssessment.create({ id: Uuid.generate(), tenantId: command.tenantId, ...payload }, command.correlationId);
    await this.repo.save(ar);
    await this.publisher.publishFromAggregate(ar);
    return {
      success: true,
      data: { misclassificationAssessmentId: ar.id.value, status: ar.status },
      commandId: command.commandId,
      correlationId: command.correlationId,
      aggregateId: ar.id,
      newState: ar.status,
      newVersion: ar.aggregateVersion,
      allowedNextActions: this.fsm.getAllowedActionsFromState(ar.status, 'MisclassificationAssessment'),
      eventsEmitted: ar.domainEvents.map((e) => e.eventName),
      auditRecordId: command.commandId,
    } as CommandResult<unknown>;
  }
}
''')

write(BASE/"contingent-workforce/commands/start-misclassification-assessment.handler.ts", '''import { Injectable } from '@nestjs/common';
import { CommandHandler } from '../../../platform/command-bus/command-handler.decorator.js';
import type { HrCommandEnvelope, CommandResult } from '@hcm/command-contracts';
import { Uuid } from '@hcm/shared-kernel';
import { FsmFramework } from '../../../platform/workflow/fsm-framework.js';
import { MisclassificationAssessmentRepository } from '../repositories/misclassification-assessment.repository.js';
import { ContingentWorkforceEventsPublisher } from '../events/contingent-workforce-events.publisher.js';

@CommandHandler('StartMisclassificationAssessment')
@Injectable()
export class StartMisclassificationAssessmentHandler {
  constructor(
    private readonly repo: MisclassificationAssessmentRepository,
    private readonly fsm: FsmFramework,
    private readonly publisher: ContingentWorkforceEventsPublisher,
  ) {}

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>> {
    const payload = command.payload as { misclassificationAssessmentId: Uuid };
    const ar = await this.repo.findById(payload.misclassificationAssessmentId);
    if (!ar) throw new Error('Misclassification assessment not found');
    ar.start(command.correlationId);
    await this.repo.save(ar);
    await this.publisher.publishFromAggregate(ar);
    return {
      success: true,
      data: { misclassificationAssessmentId: ar.id.value, status: ar.status },
      commandId: command.commandId,
      correlationId: command.correlationId,
      aggregateId: ar.id,
      newState: ar.status,
      newVersion: ar.aggregateVersion,
      allowedNextActions: this.fsm.getAllowedActionsFromState(ar.status, 'MisclassificationAssessment'),
      eventsEmitted: ar.domainEvents.map((e) => e.eventName),
      auditRecordId: command.commandId,
    } as CommandResult<unknown>;
  }
}
''')

write(BASE/"contingent-workforce/commands/mark-review-required-misclassification-assessment.handler.ts", '''import { Injectable } from '@nestjs/common';
import { CommandHandler } from '../../../platform/command-bus/command-handler.decorator.js';
import type { HrCommandEnvelope, CommandResult } from '@hcm/command-contracts';
import { Uuid } from '@hcm/shared-kernel';
import { FsmFramework } from '../../../platform/workflow/fsm-framework.js';
import { MisclassificationAssessmentRepository } from '../repositories/misclassification-assessment.repository.js';
import { ContingentWorkforceEventsPublisher } from '../events/contingent-workforce-events.publisher.js';

@CommandHandler('MarkReviewRequiredMisclassificationAssessment')
@Injectable()
export class MarkReviewRequiredMisclassificationAssessmentHandler {
  constructor(
    private readonly repo: MisclassificationAssessmentRepository,
    private readonly fsm: FsmFramework,
    private readonly publisher: ContingentWorkforceEventsPublisher,
  ) {}

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>> {
    const payload = command.payload as { misclassificationAssessmentId: Uuid };
    const ar = await this.repo.findById(payload.misclassificationAssessmentId);
    if (!ar) throw new Error('Misclassification assessment not found');
    ar.markReviewRequired(command.correlationId);
    await this.repo.save(ar);
    await this.publisher.publishFromAggregate(ar);
    return {
      success: true,
      data: { misclassificationAssessmentId: ar.id.value, status: ar.status },
      commandId: command.commandId,
      correlationId: command.correlationId,
      aggregateId: ar.id,
      newState: ar.status,
      newVersion: ar.aggregateVersion,
      allowedNextActions: this.fsm.getAllowedActionsFromState(ar.status, 'MisclassificationAssessment'),
      eventsEmitted: ar.domainEvents.map((e) => e.eventName),
      auditRecordId: command.commandId,
    } as CommandResult<unknown>;
  }
}
''')

write(BASE/"contingent-workforce/commands/clear-misclassification-assessment.handler.ts", '''import { Injectable } from '@nestjs/common';
import { CommandHandler } from '../../../platform/command-bus/command-handler.decorator.js';
import type { HrCommandEnvelope, CommandResult } from '@hcm/command-contracts';
import { Uuid } from '@hcm/shared-kernel';
import { FsmFramework } from '../../../platform/workflow/fsm-framework.js';
import { MisclassificationAssessmentRepository } from '../repositories/misclassification-assessment.repository.js';
import { ContingentWorkforceEventsPublisher } from '../events/contingent-workforce-events.publisher.js';

@CommandHandler('ClearMisclassificationAssessment')
@Injectable()
export class ClearMisclassificationAssessmentHandler {
  constructor(
    private readonly repo: MisclassificationAssessmentRepository,
    private readonly fsm: FsmFramework,
    private readonly publisher: ContingentWorkforceEventsPublisher,
  ) {}

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>> {
    const payload = command.payload as { misclassificationAssessmentId: Uuid };
    const ar = await this.repo.findById(payload.misclassificationAssessmentId);
    if (!ar) throw new Error('Misclassification assessment not found');
    ar.clear(command.correlationId);
    await this.repo.save(ar);
    await this.publisher.publishFromAggregate(ar);
    return {
      success: true,
      data: { misclassificationAssessmentId: ar.id.value, status: ar.status },
      commandId: command.commandId,
      correlationId: command.correlationId,
      aggregateId: ar.id,
      newState: ar.status,
      newVersion: ar.aggregateVersion,
      allowedNextActions: this.fsm.getAllowedActionsFromState(ar.status, 'MisclassificationAssessment'),
      eventsEmitted: ar.domainEvents.map((e) => e.eventName),
      auditRecordId: command.commandId,
    } as CommandResult<unknown>;
  }
}
''')

write(BASE/"contingent-workforce/commands/flag-misclassification-assessment.handler.ts", '''import { Injectable } from '@nestjs/common';
import { CommandHandler } from '../../../platform/command-bus/command-handler.decorator.js';
import type { HrCommandEnvelope, CommandResult } from '@hcm/command-contracts';
import { Uuid } from '@hcm/shared-kernel';
import { FsmFramework } from '../../../platform/workflow/fsm-framework.js';
import { MisclassificationAssessmentRepository } from '../repositories/misclassification-assessment.repository.js';
import { ContingentWorkforceEventsPublisher } from '../events/contingent-workforce-events.publisher.js';

@CommandHandler('FlagMisclassificationAssessment')
@Injectable()
export class FlagMisclassificationAssessmentHandler {
  constructor(
    private readonly repo: MisclassificationAssessmentRepository,
    private readonly fsm: FsmFramework,
    private readonly publisher: ContingentWorkforceEventsPublisher,
  ) {}

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>> {
    const payload = command.payload as { misclassificationAssessmentId: Uuid };
    const ar = await this.repo.findById(payload.misclassificationAssessmentId);
    if (!ar) throw new Error('Misclassification assessment not found');
    ar.flag(command.correlationId);
    await this.repo.save(ar);
    await this.publisher.publishFromAggregate(ar);
    return {
      success: true,
      data: { misclassificationAssessmentId: ar.id.value, status: ar.status },
      commandId: command.commandId,
      correlationId: command.correlationId,
      aggregateId: ar.id,
      newState: ar.status,
      newVersion: ar.aggregateVersion,
      allowedNextActions: this.fsm.getAllowedActionsFromState(ar.status, 'MisclassificationAssessment'),
      eventsEmitted: ar.domainEvents.map((e) => e.eventName),
      auditRecordId: command.commandId,
    } as CommandResult<unknown>;
  }
}
''')

print("CW commands done")
import pathlib

BASE = pathlib.Path(__file__).parent / "src" / "domains"

def write(p, c):
    p = pathlib.Path(p)
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(c, encoding="utf-8")
    print(f"Wrote {p}")

# ========================================================================
# CW - Events publisher, controller, DTOs, module
# ========================================================================

write(BASE/"contingent-workforce/events/contingent-workforce-events.publisher.ts", '''import { Injectable } from '@nestjs/common';
import { EventBus } from '../../../platform/events/event-bus.js';
import { createPrivacyForEvent } from '@hcm/event-schemas';
import { HrEventEnvelope } from '@hcm/command-contracts';
import { ContingentWorkerAssignment } from '../aggregates/contingent-worker-assignment.aggregate.js';
import { SowEngagement } from '../aggregates/sow-engagement.aggregate.js';
import { ContractorRateCard } from '../aggregates/contractor-rate-card.aggregate.js';
import { MisclassificationAssessment } from '../aggregates/misclassification-assessment.aggregate.js';

@Injectable()
export class ContingentWorkforceEventsPublisher {
  constructor(private readonly eventBus: EventBus) {}

  async publishFromAggregate(aggregate: ContingentWorkerAssignment | SowEngagement | ContractorRateCard | MisclassificationAssessment): Promise<void> {
    for (const event of aggregate.domainEvents) {
      const envelope = HrEventEnvelope.create({
        eventName: event.eventName,
        aggregateType: event.aggregateType,
        aggregateId: event.aggregateId.value,
        tenantId: event.tenantId.value,
        correlationId: event.correlationId,
        payload: event.payload,
        privacy: this.buildPrivacy(aggregate),
        occurredAt: new Date(),
      });
      await this.eventBus.publish(envelope);
    }
  }

  private buildPrivacy(aggregate: ContingentWorkerAssignment | SowEngagement | ContractorRateCard | MisclassificationAssessment) {
    return createPrivacyForEvent('NONE', aggregate.id.value, 'PROFILE');
  }
}
''')

write(BASE/"contingent-workforce/api/contingent-workforce.controller.ts", '''import { Controller, Post, Get, Body, Param, Req, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CommandBus } from '../../../platform/command-bus/command-bus.js';
import { ZodValidationPipe } from '../../../platform/validation/zod-validation.pipe.js';
import { JwtAuthGuard } from '../../../platform/security/jwt-auth.guard.js';
import { Uuid } from '@hcm/shared-kernel';
import type { Request } from 'express';
import { randomUUID } from 'crypto';
import {
  CreateContingentWorkerAssignmentDto,
  CreateSowEngagementDto,
  CreateContractorRateCardDto,
  CreateMisclassificationAssessmentDto,
} from './contingent-workforce.dto.js';

@ApiTags('Contingent Workforce')
@UseGuards(JwtAuthGuard)
@Controller('contingent-workforce')
export class ContingentWorkforceController {
  constructor(private readonly commandBus: CommandBus) {}

  private buildCommand(action: string, tenantId: Uuid, payload: unknown, roles: string[] = ['HR_ADMIN']) {
    return {
      commandId: Uuid.generate(),
      commandName: action,
      tenantId,
      payload,
      correlationId: randomUUID(),
      actor: { id: Uuid.generate(), roles },
      occurredAt: new Date(),
    };
  }

  @Post('contingent-worker-assignments')
  async createAssignment(@Body(new ZodValidationPipe(CreateContingentWorkerAssignmentDto)) dto: unknown, @Req() req: Request) {
    return this.commandBus.execute(this.buildCommand('CreateContingentWorkerAssignment', new Uuid(req['tenantId']), dto));
  }

  @Get('contingent-worker-assignments/:id')
  async getAssignment(@Param('id') id: string) {
    return { id };
  }

  @Post('contingent-worker-assignments/:id/commands/:action')
  async assignmentCommand(@Param('id') id: string, @Param('action') action: string, @Req() req: Request) {
    const payload = { contingentWorkerAssignmentId: new Uuid(id) };
    return this.commandBus.execute(this.buildCommand(`${action[0].toUpperCase()}${action.slice(1)}ContingentWorkerAssignment`, new Uuid(req['tenantId']), payload));
  }

  @Post('sow-engagements')
  async createSow(@Body(new ZodValidationPipe(CreateSowEngagementDto)) dto: unknown, @Req() req: Request) {
    return this.commandBus.execute(this.buildCommand('CreateSowEngagement', new Uuid(req['tenantId']), dto));
  }

  @Get('sow-engagements/:id')
  async getSow(@Param('id') id: string) {
    return { id };
  }

  @Post('sow-engagements/:id/commands/:action')
  async sowCommand(@Param('id') id: string, @Param('action') action: string, @Req() req: Request) {
    const payload = { sowEngagementId: new Uuid(id) };
    return this.commandBus.execute(this.buildCommand(`${action[0].toUpperCase()}${action.slice(1)}SowEngagement`, new Uuid(req['tenantId']), payload));
  }

  @Post('contractor-rate-cards')
  async createRateCard(@Body(new ZodValidationPipe(CreateContractorRateCardDto)) dto: unknown, @Req() req: Request) {
    return this.commandBus.execute(this.buildCommand('CreateContractorRateCard', new Uuid(req['tenantId']), dto));
  }

  @Get('contractor-rate-cards/:id')
  async getRateCard(@Param('id') id: string) {
    return { id };
  }

  @Post('contractor-rate-cards/:id/commands/:action')
  async rateCardCommand(@Param('id') id: string, @Param('action') action: string, @Req() req: Request) {
    const payload = { contractorRateCardId: new Uuid(id) };
    return this.commandBus.execute(this.buildCommand(`${action[0].toUpperCase()}${action.slice(1)}ContractorRateCard`, new Uuid(req['tenantId']), payload));
  }

  @Post('misclassification-assessments')
  async createAssessment(@Body(new ZodValidationPipe(CreateMisclassificationAssessmentDto)) dto: unknown, @Req() req: Request) {
    return this.commandBus.execute(this.buildCommand('CreateMisclassificationAssessment', new Uuid(req['tenantId']), dto));
  }

  @Get('misclassification-assessments/:id')
  async getAssessment(@Param('id') id: string) {
    return { id };
  }

  @Post('misclassification-assessments/:id/commands/:action')
  async assessmentCommand(@Param('id') id: string, @Param('action') action: string, @Req() req: Request) {
    const payload = { misclassificationAssessmentId: new Uuid(id) };
    return this.commandBus.execute(this.buildCommand(`${action[0].toUpperCase()}${action.slice(1)}MisclassificationAssessment`, new Uuid(req['tenantId']), payload));
  }
}
''')

write(BASE/"contingent-workforce/api/contingent-workforce.dto.ts", '''import { z } from 'zod';

export const CreateContingentWorkerAssignmentDto = z.object({
  workerId: z.string().uuid(),
  vendorId: z.string().uuid(),
  projectId: z.string().uuid(),
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
  rate: z.number().min(0),
  currency: z.string().min(1),
});

export const CreateSowEngagementDto = z.object({
  sowNumber: z.string().min(1),
  vendorId: z.string().uuid(),
  projectName: z.string().min(1),
  totalValue: z.number().min(0),
  currency: z.string().min(1),
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
  milestones: z.array(z.string()).optional(),
});

export const CreateContractorRateCardDto = z.object({
  vendorId: z.string().uuid(),
  jobTitle: z.string().min(1),
  rate: z.number().min(0),
  currency: z.string().min(1),
  effectiveFrom: z.coerce.date(),
  effectiveUntil: z.coerce.date().optional(),
});

export const CreateMisclassificationAssessmentDto = z.object({
  workerId: z.string().uuid(),
  assessmentDate: z.coerce.date(),
  riskScore: z.number().optional(),
  riskFactors: z.array(z.string()).optional(),
});
''')

write(BASE/"contingent-workforce/contingent-workforce.module.ts", '''import { Module, OnModuleInit } from '@nestjs/common';
import { PlatformModule } from '../../platform/platform.module.js';
import { ContingentWorkforceController } from './api/contingent-workforce.controller.js';
import { ContingentWorkforceEventsPublisher } from './events/contingent-workforce-events.publisher.js';
import { ContingentWorkerAssignmentRepository } from './repositories/contingent-worker-assignment.repository.js';
import { SowEngagementRepository } from './repositories/sow-engagement.repository.js';
import { ContractorRateCardRepository } from './repositories/contractor-rate-card.repository.js';
import { MisclassificationAssessmentRepository } from './repositories/misclassification-assessment.repository.js';
import { FsmFramework } from '../../platform/workflow/fsm-framework.js';
import { registerContingentWorkerAssignmentFsm } from './fsm/contingent-worker-assignment.fsm.js';
import { registerSowEngagementFsm } from './fsm/sow-engagement.fsm.js';
import { registerContractorRateCardFsm } from './fsm/contractor-rate-card.fsm.js';
import { registerMisclassificationAssessmentFsm } from './fsm/misclassification-assessment.fsm.js';
import { CreateContingentWorkerAssignmentHandler } from './commands/create-contingent-worker-assignment.handler.js';
import { ActivateContingentWorkerAssignmentHandler } from './commands/activate-contingent-worker-assignment.handler.js';
import { ExtendContingentWorkerAssignmentHandler } from './commands/extend-contingent-worker-assignment.handler.js';
import { TerminateContingentWorkerAssignmentHandler } from './commands/terminate-contingent-worker-assignment.handler.js';
import { CreateSowEngagementHandler } from './commands/create-sow-engagement.handler.js';
import { ActivateSowEngagementHandler } from './commands/activate-sow-engagement.handler.js';
import { StartSowEngagementHandler } from './commands/start-sow-engagement.handler.js';
import { CompleteSowEngagementHandler } from './commands/complete-sow-engagement.handler.js';
import { CloseSowEngagementHandler } from './commands/close-sow-engagement.handler.js';
import { CreateContractorRateCardHandler } from './commands/create-contractor-rate-card.handler.js';
import { ActivateContractorRateCardHandler } from './commands/activate-contractor-rate-card.handler.js';
import { ReviseContractorRateCardHandler } from './commands/revise-contractor-rate-card.handler.js';
import { ExpireContractorRateCardHandler } from './commands/expire-contractor-rate-card.handler.js';
import { CreateMisclassificationAssessmentHandler } from './commands/create-misclassification-assessment.handler.js';
import { StartMisclassificationAssessmentHandler } from './commands/start-misclassification-assessment.handler.js';
import { MarkReviewRequiredMisclassificationAssessmentHandler } from './commands/mark-review-required-misclassification-assessment.handler.js';
import { ClearMisclassificationAssessmentHandler } from './commands/clear-misclassification-assessment.handler.js';
import { FlagMisclassificationAssessmentHandler } from './commands/flag-misclassification-assessment.handler.js';

const HANDLERS = [
  CreateContingentWorkerAssignmentHandler,
  ActivateContingentWorkerAssignmentHandler,
  ExtendContingentWorkerAssignmentHandler,
  TerminateContingentWorkerAssignmentHandler,
  CreateSowEngagementHandler,
  ActivateSowEngagementHandler,
  StartSowEngagementHandler,
  CompleteSowEngagementHandler,
  CloseSowEngagementHandler,
  CreateContractorRateCardHandler,
  ActivateContractorRateCardHandler,
  ReviseContractorRateCardHandler,
  ExpireContractorRateCardHandler,
  CreateMisclassificationAssessmentHandler,
  StartMisclassificationAssessmentHandler,
  MarkReviewRequiredMisclassificationAssessmentHandler,
  ClearMisclassificationAssessmentHandler,
  FlagMisclassificationAssessmentHandler,
];

const REPOS = [
  ContingentWorkerAssignmentRepository,
  SowEngagementRepository,
  ContractorRateCardRepository,
  MisclassificationAssessmentRepository,
];

@Module({
  imports: [PlatformModule],
  controllers: [ContingentWorkforceController],
  providers: [...REPOS, ...HANDLERS, ContingentWorkforceEventsPublisher],
  exports: REPOS,
})
export class ContingentWorkforceModule implements OnModuleInit {
  constructor(private readonly fsm: FsmFramework) {}

  onModuleInit() {
    registerContingentWorkerAssignmentFsm(this.fsm);
    registerSowEngagementFsm(this.fsm);
    registerContractorRateCardFsm(this.fsm);
    registerMisclassificationAssessmentFsm(this.fsm);
  }
}
''')

print("CW all done")

# ========================================================================
# WELLBEING EAP - Aggregates
# ========================================================================

write(BASE/"wellbeing-eap/aggregates/eap-referral.aggregate.ts", '''import { AggregateRoot, Uuid, ValidationError, DomainEvent } from '@hcm/shared-kernel';

export class EapReferralCreated extends DomainEvent {
  constructor(aggregateId: Uuid, tenantId: Uuid, public readonly payload: { workerId: Uuid; reason: string }, correlationId: string) {
    super(aggregateId, tenantId, 'EapReferralCreated', payload, correlationId);
  }
  get eventName() { return 'EapReferralCreated'; }
  get aggregateType() { return 'EapReferral'; }
}

export class EapReferralScheduled extends DomainEvent {
  constructor(aggregateId: Uuid, tenantId: Uuid, public readonly payload: { scheduledDate: Date }, correlationId: string) {
    super(aggregateId, tenantId, 'EapReferralScheduled', payload, correlationId);
  }
  get eventName() { return 'EapReferralScheduled'; }
  get aggregateType() { return 'EapReferral'; }
}

export class EapReferralStarted extends DomainEvent {
  constructor(aggregateId: Uuid, tenantId: Uuid, public readonly payload: Record<string, unknown>, correlationId: string) {
    super(aggregateId, tenantId, 'EapReferralStarted', payload, correlationId);
  }
  get eventName() { return 'EapReferralStarted'; }
  get aggregateType() { return 'EapReferral'; }
}

export class EapReferralCompleted extends DomainEvent {
  constructor(aggregateId: Uuid, tenantId: Uuid, public readonly payload: Record<string, unknown>, correlationId: string) {
    super(aggregateId, tenantId, 'EapReferralCompleted', payload, correlationId);
  }
  get eventName() { return 'EapReferralCompleted'; }
  get aggregateType() { return 'EapReferral'; }
}

export class EapReferralClosed extends DomainEvent {
  constructor(aggregateId: Uuid, tenantId: Uuid, public readonly payload: Record<string, unknown>, correlationId: string) {
    super(aggregateId, tenantId, 'EapReferralClosed', payload, correlationId);
  }
  get eventName() { return 'EapReferralClosed'; }
  get aggregateType() { return 'EapReferral'; }
}

export class EapReferralCancelled extends DomainEvent {
  constructor(aggregateId: Uuid, tenantId: Uuid, public readonly payload: Record<string, unknown>, correlationId: string) {
    super(aggregateId, tenantId, 'EapReferralCancelled', payload, correlationId);
  }
  get eventName() { return 'EapReferralCancelled'; }
  get aggregateType() { return 'EapReferral'; }
}

export class EapReferral extends AggregateRoot {
  id!: Uuid;
  tenantId!: Uuid;
  workerId!: Uuid;
  reason!: string;
  status: 'REQUESTED' | 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'CLOSED' | 'CANCELLED' = 'REQUESTED';
  scheduledDate?: Date;
  completedDate?: Date;
  providerId?: Uuid;
  notes?: string; /* @special_category Encrypted at rest; ANONYMIZED usage statistics stripped of PII for reporting */
  createdAt = new Date();
  updatedAt = new Date();

  static create(props: { id: Uuid; tenantId: Uuid; workerId: Uuid; reason: string; scheduledDate?: Date; providerId?: Uuid; notes?: string }, correlationId: string): EapReferral {
    const ar = new EapReferral();
    ar.id = props.id;
    ar.tenantId = props.tenantId;
    ar.workerId = props.workerId;
    ar.reason = props.reason;
    ar.scheduledDate = props.scheduledDate;
    ar.providerId = props.providerId;
    ar.notes = props.notes;
    ar.status = 'REQUESTED';
    ar.addDomainEvent(new EapReferralCreated(ar.id, ar.tenantId, { workerId: ar.workerId, reason: ar.reason }, correlationId));
    ar.incrementVersion();
    return ar;
  }

  schedule(scheduledDate: Date, correlationId: string) {
    if (this.status !== 'REQUESTED') throw new ValidationError('EapReferral', 'schedule', 'Must be REQUESTED');
    this.status = 'SCHEDULED';
    this.scheduledDate = scheduledDate;
    this.updatedAt = new Date();
    this.addDomainEvent(new EapReferralScheduled(this.id, this.tenantId, { scheduledDate }, correlationId));
    this.incrementVersion();
  }

  start(correlationId: string) {
    if (this.status !== 'SCHEDULED') throw new ValidationError('EapReferral', 'start', 'Must be SCHEDULED');
    this.status = 'IN_PROGRESS';
    this.updatedAt = new Date();
    this.addDomainEvent(new EapReferralStarted(this.id, this.tenantId, {}, correlationId));
    this.incrementVersion();
  }

  complete(correlationId: string) {
    if (this.status !== 'IN_PROGRESS') throw new ValidationError('EapReferral', 'complete', 'Must be IN_PROGRESS');
    this.status = 'COMPLETED';
    this.completedDate = new Date();
    this.updatedAt = new Date();
    this.addDomainEvent(new EapReferralCompleted(this.id, this.tenantId, {}, correlationId));
    this.incrementVersion();
  }

  close(correlationId: string) {
    if (!['COMPLETED', 'CANCELLED'].includes(this.status)) throw new ValidationError('EapReferral', 'close', 'Must be COMPLETED or CANCELLED');
    this.status = 'CLOSED';
    this.updatedAt = new Date();
    this.addDomainEvent(new EapReferralClosed(this.id, this.tenantId, {}, correlationId));
    this.incrementVersion();
  }

  cancel(correlationId: string) {
    if (!['REQUESTED', 'SCHEDULED', 'IN_PROGRESS'].includes(this.status)) throw new ValidationError('EapReferral', 'cancel', 'Must be REQUESTED, SCHEDULED, or IN_PROGRESS');
    this.status = 'CANCELLED';
    this.updatedAt = new Date();
    this.addDomainEvent(new EapReferralCancelled(this.id, this.tenantId, {}, correlationId));
    this.incrementVersion();
  }
}
''')

write(BASE/"wellbeing-eap/aggregates/wellness-program.aggregate.ts", '''import { AggregateRoot, Uuid, ValidationError, DomainEvent } from '@hcm/shared-kernel';

export class WellnessProgramCreated extends DomainEvent {
  constructor(aggregateId: Uuid, tenantId: Uuid, public readonly payload: { name: string; type: string }, correlationId: string) {
    super(aggregateId, tenantId, 'WellnessProgramCreated', payload, correlationId);
  }
  get eventName() { return 'WellnessProgramCreated'; }
  get aggregateType() { return 'WellnessProgram'; }
}

export class WellnessProgramActivated extends DomainEvent {
  constructor(aggregateId: Uuid, tenantId: Uuid, public readonly payload: Record<string, unknown>, correlationId: string) {
    super(aggregateId, tenantId, 'WellnessProgramActivated', payload, correlationId);
  }
  get eventName() { return 'WellnessProgramActivated'; }
  get aggregateType() { return 'WellnessProgram'; }
}

export class WellnessProgramEnrolled extends DomainEvent {
  constructor(aggregateId: Uuid, tenantId: Uuid, public readonly payload: { workerId: Uuid }, correlationId: string) {
    super(aggregateId, tenantId, 'WellnessProgramEnrolled', payload, correlationId);
  }
  get eventName() { return 'WellnessProgramEnrolled'; }
  get aggregateType() { return 'WellnessProgram'; }
}

export class WellnessProgramCompleted extends DomainEvent {
  constructor(aggregateId: Uuid, tenantId: Uuid, public readonly payload: Record<string, unknown>, correlationId: string) {
    super(aggregateId, tenantId, 'WellnessProgramCompleted', payload, correlationId);
  }
  get eventName() { return 'WellnessProgramCompleted'; }
  get aggregateType() { return 'WellnessProgram'; }
}

export class WellnessProgramCancelled extends DomainEvent {
  constructor(aggregateId: Uuid, tenantId: Uuid, public readonly payload: Record<string, unknown>, correlationId: string) {
    super(aggregateId, tenantId, 'WellnessProgramCancelled', payload, correlationId);
  }
  get eventName() { return 'WellnessProgramCancelled'; }
  get aggregateType() { return 'WellnessProgram'; }
}

export class WellnessProgramArchived extends DomainEvent {
  constructor(aggregateId: Uuid, tenantId: Uuid, public readonly payload: Record<string, unknown>, correlationId: string) {
    super(aggregateId, tenantId, 'WellnessProgramArchived', payload, correlationId);
  }
  get eventName() { return 'WellnessProgramArchived'; }
  get aggregateType() { return 'WellnessProgram'; }
}

export class WellnessProgram extends AggregateRoot {
  id!: Uuid;
  tenantId!: Uuid;
  name!: string;
  type!: string;
  status: 'DRAFT' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED' | 'ARCHIVED' = 'DRAFT';
  startDate?: Date;
  endDate?: Date;
  description?: string;
  createdAt = new Date();
  updatedAt = new Date();

  static create(props: { id: Uuid; tenantId: Uuid; name: string; type: string; startDate?: Date; endDate?: Date; description?: string }, correlationId: string): WellnessProgram {
    const ar = new WellnessProgram();
    ar.id = props.id;
    ar.tenantId = props.tenantId;
    ar.name = props.name;
    ar.type = props.type;
    ar.startDate = props.startDate;
    ar.endDate = props.endDate;
    ar.description = props.description;
    ar.status = 'DRAFT';
    ar.addDomainEvent(new WellnessProgramCreated(ar.id, ar.tenantId, { name: ar.name, type: ar.type }, correlationId));
    ar.incrementVersion();
    return ar;
  }

  activate(correlationId: string) {
    if (this.status !== 'DRAFT') throw new ValidationError('WellnessProgram', 'activate', 'Must be DRAFT');
    this.status = 'ACTIVE';
    this.updatedAt = new Date();
    this.addDomainEvent(new WellnessProgramActivated(this.id, this.tenantId, {}, correlationId));
    this.incrementVersion();
  }

  enroll(workerId: Uuid, correlationId: string) {
    if (this.status !== 'ACTIVE') throw new ValidationError('WellnessProgram', 'enroll', 'Must be ACTIVE');
    this.updatedAt = new Date();
    this.addDomainEvent(new WellnessProgramEnrolled(this.id, this.tenantId, { workerId }, correlationId));
    this.incrementVersion();
  }

  complete(correlationId: string) {
    if (this.status !== 'ACTIVE') throw new ValidationError('WellnessProgram', 'complete', 'Must be ACTIVE');
    this.status = 'COMPLETED';
    this.updatedAt = new Date();
    this.addDomainEvent(new WellnessProgramCompleted(this.id, this.tenantId, {}, correlationId));
    this.incrementVersion();
  }

  cancel(correlationId: string) {
    if (!['DRAFT', 'ACTIVE'].includes(this.status)) throw new ValidationError('WellnessProgram', 'cancel', 'Must be DRAFT or ACTIVE');
    this.status = 'CANCELLED';
    this.updatedAt = new Date();
    this.addDomainEvent(new WellnessProgramCancelled(this.id, this.tenantId, {}, correlationId));
    this.incrementVersion();
  }

  archive(correlationId: string) {
    if (!['COMPLETED', 'CANCELLED'].includes(this.status)) throw new ValidationError('WellnessProgram', 'archive', 'Must be COMPLETED or CANCELLED');
    this.status = 'ARCHIVED';
    this.updatedAt = new Date();
    this.addDomainEvent(new WellnessProgramArchived(this.id, this.tenantId, {}, correlationId));
    this.incrementVersion();
  }
}
''')

write(BASE/"wellbeing-eap/aggregates/mental-health-case.aggregate.ts", '''import { AggregateRoot, Uuid, ValidationError, DomainEvent } from '@hcm/shared-kernel';

export class MentalHealthCaseOpened extends DomainEvent {
  constructor(aggregateId: Uuid, tenantId: Uuid, public readonly payload: { workerId: Uuid; severity: string }, correlationId: string) {
    super(aggregateId, tenantId, 'MentalHealthCaseOpened', payload, correlationId);
  }
  get eventName() { return 'MentalHealthCaseOpened'; }
  get aggregateType() { return 'MentalHealthCase'; }
}

export class MentalHealthCaseAssigned extends DomainEvent {
  constructor(aggregateId: Uuid, tenantId: Uuid, public readonly payload: { providerId: Uuid }, correlationId: string) {
    super(aggregateId, tenantId, 'MentalHealthCaseAssigned', payload, correlationId);
  }
  get eventName() { return 'MentalHealthCaseAssigned'; }
  get aggregateType() { return 'MentalHealthCase'; }
}

export class MentalHealthCaseInProgress extends DomainEvent {
  constructor(aggregateId: Uuid, tenantId: Uuid, public readonly payload: Record<string, unknown>, correlationId: string) {
    super(aggregateId, tenantId, 'MentalHealthCaseInProgress', payload, correlationId);
  }
  get eventName() { return 'MentalHealthCaseInProgress'; }
  get aggregateType() { return 'MentalHealthCase'; }
}

export class MentalHealthCaseResolved extends DomainEvent {
  constructor(aggregateId: Uuid, tenantId: Uuid, public readonly payload: Record<string, unknown>, correlationId: string) {
    super(aggregateId, tenantId, 'MentalHealthCaseResolved', payload, correlationId);
  }
  get eventName() { return 'MentalHealthCaseResolved'; }
  get aggregateType() { return 'MentalHealthCase'; }
}

export class MentalHealthCaseClosed extends DomainEvent {
  constructor(aggregateId: Uuid, tenantId: Uuid, public readonly payload: Record<string, unknown>, correlationId: string) {
    super(aggregateId, tenantId, 'MentalHealthCaseClosed', payload, correlationId);
  }
  get eventName() { return 'MentalHealthCaseClosed'; }
  get aggregateType() { return 'MentalHealthCase'; }
}

export class MentalHealthCase extends AggregateRoot {
  id!: Uuid;
  tenantId!: Uuid;
  workerId!: Uuid;
  severity!: string;
  status: 'OPEN' | 'ASSIGNED' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED' = 'OPEN';
  providerId?: Uuid;
  notes?: string; /* @special_category Encrypted at rest */
  createdAt = new Date();
  updatedAt = new Date();

  static create(props: { id: Uuid; tenantId: Uuid; workerId: Uuid; severity: string; providerId?: Uuid; notes?: string }, correlationId: string): MentalHealthCase {
    const ar = new MentalHealthCase();
    ar.id = props.id;
    ar.tenantId = props.tenantId;
    ar.workerId = props.workerId;
    ar.severity = props.severity;
    ar.providerId = props.providerId;
    ar.notes = props.notes;
    ar.status = 'OPEN';
    ar.addDomainEvent(new MentalHealthCaseOpened(ar.id, ar.tenantId, { workerId: ar.workerId, severity: ar.severity }, correlationId));
    ar.incrementVersion();
    return ar;
  }

  assignTo(providerId: Uuid, correlationId: string) {
    if (this.status !== 'OPEN') throw new ValidationError('MentalHealthCase', 'assignTo', 'Must be OPEN');
    this.status = 'ASSIGNED';
    this.providerId = providerId;
    this.updatedAt = new Date();
    this.addDomainEvent(new MentalHealthCaseAssigned(this.id, this.tenantId, { providerId }, correlationId));
    this.incrementVersion();
  }

  start(correlationId: string) {
    if (this.status !== 'ASSIGNED') throw new ValidationError('MentalHealthCase', 'start', 'Must be ASSIGNED');
    this.status = 'IN_PROGRESS';
    this.updatedAt = new Date();
    this.addDomainEvent(new MentalHealthCaseInProgress(this.id, this.tenantId, {}, correlationId));
    this.incrementVersion();
  }

  resolve(correlationId: string) {
    if (this.status !== 'IN_PROGRESS') throw new ValidationError('MentalHealthCase', 'resolve', 'Must be IN_PROGRESS');
    this.status = 'RESOLVED';
    this.updatedAt = new Date();
    this.addDomainEvent(new MentalHealthCaseResolved(this.id, this.tenantId, {}, correlationId));
    this.incrementVersion();
  }

  close(correlationId: string) {
    if (this.status !== 'RESOLVED') throw new ValidationError('MentalHealthCase', 'close', 'Must be RESOLVED');
    this.status = 'CLOSED';
    this.updatedAt = new Date();
    this.addDomainEvent(new MentalHealthCaseClosed(this.id, this.tenantId, {}, correlationId));
    this.incrementVersion();
  }
}
''')

print("WEAP aggregates done")

# ========================================================================
# WELLBEING EAP - Repositories
# ========================================================================

write(BASE/"wellbeing-eap/repositories/eap-referral.repository.ts", '''import { Injectable } from '@nestjs/common';
import { BaseRepository } from '@hcm/database';
import { EapReferral } from '../aggregates/eap-referral.aggregate.js';
import { Uuid } from '@hcm/shared-kernel';

@Injectable()
export class EapReferralRepository extends BaseRepository<EapReferral> {
  protected tableName = 'eap_referrals';

  async findById(id: Uuid): Promise<EapReferral | undefined> {
    const row = await this.db.selectFrom(this.tableName).selectAll().where('id', '=', id.value).executeTakeFirst();
    return row ? this.toAggregate(row) : undefined;
  }

  async findByTenant(tenantId: Uuid): Promise<EapReferral[]> {
    const rows = await this.db.selectFrom(this.tableName).selectAll().where('tenant_id', '=', tenantId.value).execute();
    return rows.map((r) => this.toAggregate(r));
  }

  async findByWorker(workerId: Uuid): Promise<EapReferral[]> {
    const rows = await this.db.selectFrom(this.tableName).selectAll().where('worker_id', '=', workerId.value).execute();
    return rows.map((r) => this.toAggregate(r));
  }

  async save(entity: EapReferral): Promise<void> {
    const row = this.toRow(entity);
    await this.db.insertInto(this.tableName).values(row).onConflict((oc) => oc.columns(['id']).doUpdateSet(row)).execute();
  }

  protected toAggregate(row: Record<string, unknown>): EapReferral {
    const ar = new EapReferral();
    ar.id = new Uuid(row['id'] as string);
    ar.tenantId = new Uuid(row['tenant_id'] as string);
    ar.workerId = new Uuid(row['worker_id'] as string);
    ar.reason = row['reason'] as string;
    ar.status = row['status'] as EapReferral['status'];
    ar.scheduledDate = row['scheduled_date'] ? new Date(row['scheduled_date'] as string) : undefined;
    ar.completedDate = row['completed_date'] ? new Date(row['completed_date'] as string) : undefined;
    ar.providerId = row['provider_id'] ? new Uuid(row['provider_id'] as string) : undefined;
    ar.notes = row['notes'] as string | undefined;
    ar.createdAt = new Date(row['created_at'] as string);
    ar.updatedAt = new Date(row['updated_at'] as string);
    ar['_aggregateVersion'] = (row['aggregate_version'] as number) ?? 0;
    return ar;
  }

  protected toRow(entity: EapReferral): Record<string, unknown> {
    return {
      id: entity.id.value,
      tenant_id: entity.tenantId.value,
      worker_id: entity.workerId.value,
      reason: entity.reason,
      status: entity.status,
      scheduled_date: entity.scheduledDate,
      completed_date: entity.completedDate,
      provider_id: entity.providerId?.value,
      notes: entity.notes,
      created_at: entity.createdAt,
      updated_at: entity.updatedAt,
      aggregate_version: entity.aggregateVersion,
    };
  }
}
''')

write(BASE/"wellbeing-eap/repositories/wellness-program.repository.ts", '''import { Injectable } from '@nestjs/common';
import { BaseRepository } from '@hcm/database';
import { WellnessProgram } from '../aggregates/wellness-program.aggregate.js';
import { Uuid } from '@hcm/shared-kernel';

@Injectable()
export class WellnessProgramRepository extends BaseRepository<WellnessProgram> {
  protected tableName = 'wellness_programs';

  async findById(id: Uuid): Promise<WellnessProgram | undefined> {
    const row = await this.db.selectFrom(this.tableName).selectAll().where('id', '=', id.value).executeTakeFirst();
    return row ? this.toAggregate(row) : undefined;
  }

  async findByTenant(tenantId: Uuid): Promise<WellnessProgram[]> {
    const rows = await this.db.selectFrom(this.tableName).selectAll().where('tenant_id', '=', tenantId.value).execute();
    return rows.map((r) => this.toAggregate(r));
  }

  async save(entity: WellnessProgram): Promise<void> {
    const row = this.toRow(entity);
    await this.db.insertInto(this.tableName).values(row).onConflict((oc) => oc.columns(['id']).doUpdateSet(row)).execute();
  }

  protected toAggregate(row: Record<string, unknown>): WellnessProgram {
    const ar = new WellnessProgram();
    ar.id = new Uuid(row['id'] as string);
    ar.tenantId = new Uuid(row['tenant_id'] as string);
    ar.name = row['name'] as string;
    ar.type = row['type'] as string;
    ar.status = row['status'] as WellnessProgram['status'];
    ar.startDate = row['start_date'] ? new Date(row['start_date'] as string) : undefined;
    ar.endDate = row['end_date'] ? new Date(row['end_date'] as string) : undefined;
    ar.description = row['description'] as string | undefined;
    ar.createdAt = new Date(row['created_at'] as string);
    ar.updatedAt = new Date(row['updated_at'] as string);
    ar['_aggregateVersion'] = (row['aggregate_version'] as number) ?? 0;
    return ar;
  }

  protected toRow(entity: WellnessProgram): Record<string, unknown> {
    return {
      id: entity.id.value,
      tenant_id: entity.tenantId.value,
      name: entity.name,
      type: entity.type,
      status: entity.status,
      start_date: entity.startDate,
      end_date: entity.endDate,
      description: entity.description,
      created_at: entity.createdAt,
      updated_at: entity.updatedAt,
      aggregate_version: entity.aggregateVersion,
    };
  }
}
''')

write(BASE/"wellbeing-eap/repositories/mental-health-case.repository.ts", '''import { Injectable } from '@nestjs/common';
import { BaseRepository } from '@hcm/database';
import { MentalHealthCase } from '../aggregates/mental-health-case.aggregate.js';
import { Uuid } from '@hcm/shared-kernel';

@Injectable()
export class MentalHealthCaseRepository extends BaseRepository<MentalHealthCase> {
  protected tableName = 'mental_health_cases';

  async findById(id: Uuid): Promise<MentalHealthCase | undefined> {
    const row = await this.db.selectFrom(this.tableName).selectAll().where('id', '=', id.value).executeTakeFirst();
    return row ? this.toAggregate(row) : undefined;
  }

  async findByTenant(tenantId: Uuid): Promise<MentalHealthCase[]> {
    const rows = await this.db.selectFrom(this.tableName).selectAll().where('tenant_id', '=', tenantId.value).execute();
    return rows.map((r) => this.toAggregate(r));
  }

  async findByWorker(workerId: Uuid): Promise<MentalHealthCase[]> {
    const rows = await this.db.selectFrom(this.tableName).selectAll().where('worker_id', '=', workerId.value).execute();
    return rows.map((r) => this.toAggregate(r));
  }

  async save(entity: MentalHealthCase): Promise<void> {
    const row = this.toRow(entity);
    await this.db.insertInto(this.tableName).values(row).onConflict((oc) => oc.columns(['id']).doUpdateSet(row)).execute();
  }

  protected toAggregate(row: Record<string, unknown>): MentalHealthCase {
    const ar = new MentalHealthCase();
    ar.id = new Uuid(row['id'] as string);
    ar.tenantId = new Uuid(row['tenant_id'] as string);
    ar.workerId = new Uuid(row['worker_id'] as string);
    ar.severity = row['severity'] as string;
    ar.status = row['status'] as MentalHealthCase['status'];
    ar.providerId = row['provider_id'] ? new Uuid(row['provider_id'] as string) : undefined;
    ar.notes = row['notes'] as string | undefined;
    ar.createdAt = new Date(row['created_at'] as string);
    ar.updatedAt = new Date(row['updated_at'] as string);
    ar['_aggregateVersion'] = (row['aggregate_version'] as number) ?? 0;
    return ar;
  }

  protected toRow(entity: MentalHealthCase): Record<string, unknown> {
    return {
      id: entity.id.value,
      tenant_id: entity.tenantId.value,
      worker_id: entity.workerId.value,
      severity: entity.severity,
      status: entity.status,
      provider_id: entity.providerId?.value,
      notes: entity.notes,
      created_at: entity.createdAt,
      updated_at: entity.updatedAt,
      aggregate_version: entity.aggregateVersion,
    };
  }
}
''')

# ========================================================================
# WELLBEING EAP - FSMs
# ========================================================================

write(BASE/"wellbeing-eap/fsm/eap-referral.fsm.ts", '''import type { FsmFramework } from '../../../platform/workflow/fsm-framework.js';
import type { FsmDefinition } from '../../../platform/workflow/fsm-framework.js';

export function registerEapReferralFsm(fsm: FsmFramework): void {
  const definition: FsmDefinition<string, string> = {
    aggregateType: 'EapReferral',
    states: ['REQUESTED', 'SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CLOSED', 'CANCELLED'],
    actions: ['CreateEapReferral', 'ScheduleEapReferral', 'StartEapReferral', 'CompleteEapReferral', 'CloseEapReferral', 'CancelEapReferral'],
    transitions: [
      { action: 'CreateEapReferral', from: '', to: 'REQUESTED', eventName: 'EapReferralCreated' },
      { action: 'ScheduleEapReferral', from: 'REQUESTED', to: 'SCHEDULED', eventName: 'EapReferralScheduled' },
      { action: 'StartEapReferral', from: 'SCHEDULED', to: 'IN_PROGRESS', eventName: 'EapReferralStarted' },
      { action: 'CompleteEapReferral', from: 'IN_PROGRESS', to: 'COMPLETED', eventName: 'EapReferralCompleted' },
      { action: 'CloseEapReferral', from: 'COMPLETED', to: 'CLOSED', eventName: 'EapReferralClosed' },
      { action: 'CancelEapReferral', from: 'REQUESTED', to: 'CANCELLED', eventName: 'EapReferralCancelled' },
      { action: 'CancelEapReferral', from: 'SCHEDULED', to: 'CANCELLED', eventName: 'EapReferralCancelled' },
      { action: 'CloseEapReferral', from: 'CANCELLED', to: 'CLOSED', eventName: 'EapReferralClosed' },
    ],
    initialState: 'REQUESTED',
    terminalStates: ['CLOSED'],
  };
  fsm.register(definition);
}
''')

write(BASE/"wellbeing-eap/fsm/wellness-program.fsm.ts", '''import type { FsmFramework } from '../../../platform/workflow/fsm-framework.js';
import type { FsmDefinition } from '../../../platform/workflow/fsm-framework.js';

export function registerWellnessProgramFsm(fsm: FsmFramework): void {
  const definition: FsmDefinition<string, string> = {
    aggregateType: 'WellnessProgram',
    states: ['DRAFT', 'ACTIVE', 'COMPLETED', 'CANCELLED', 'ARCHIVED'],
    actions: ['CreateWellnessProgram', 'ActivateWellnessProgram', 'EnrollWellnessProgram', 'CompleteWellnessProgram', 'CancelWellnessProgram', 'ArchiveWellnessProgram'],
    transitions: [
      { action: 'CreateWellnessProgram', from: '', to: 'DRAFT', eventName: 'WellnessProgramCreated' },
      { action: 'ActivateWellnessProgram', from: 'DRAFT', to: 'ACTIVE', eventName: 'WellnessProgramActivated' },
      { action: 'EnrollWellnessProgram', from: 'ACTIVE', to: 'ACTIVE', eventName: 'WellnessProgramEnrolled' },
      { action: 'CompleteWellnessProgram', from: 'ACTIVE', to: 'COMPLETED', eventName: 'WellnessProgramCompleted' },
      { action: 'CancelWellnessProgram', from: 'DRAFT', to: 'CANCELLED', eventName: 'WellnessProgramCancelled' },
      { action: 'CancelWellnessProgram', from: 'ACTIVE', to: 'CANCELLED', eventName: 'WellnessProgramCancelled' },
      { action: 'ArchiveWellnessProgram', from: 'COMPLETED', to: 'ARCHIVED', eventName: 'WellnessProgramArchived' },
      { action: 'ArchiveWellnessProgram', from: 'CANCELLED', to: 'ARCHIVED', eventName: 'WellnessProgramArchived' },
    ],
    initialState: 'DRAFT',
    terminalStates: ['ARCHIVED'],
  };
  fsm.register(definition);
}
''')

write(BASE/"wellbeing-eap/fsm/mental-health-case.fsm.ts", '''import type { FsmFramework } from '../../../platform/workflow/fsm-framework.js';
import type { FsmDefinition } from '../../../platform/workflow/fsm-framework.js';

export function registerMentalHealthCaseFsm(fsm: FsmFramework): void {
  const definition: FsmDefinition<string, string> = {
    aggregateType: 'MentalHealthCase',
    states: ['OPEN', 'ASSIGNED', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'],
    actions: ['CreateMentalHealthCase', 'AssignToMentalHealthCase', 'StartMentalHealthCase', 'ResolveMentalHealthCase', 'CloseMentalHealthCase'],
    transitions: [
      { action: 'CreateMentalHealthCase', from: '', to: 'OPEN', eventName: 'MentalHealthCaseOpened' },
      { action: 'AssignToMentalHealthCase', from: 'OPEN', to: 'ASSIGNED', eventName: 'MentalHealthCaseAssigned' },
      { action: 'StartMentalHealthCase', from: 'ASSIGNED', to: 'IN_PROGRESS', eventName: 'MentalHealthCaseInProgress' },
      { action: 'ResolveMentalHealthCase', from: 'IN_PROGRESS', to: 'RESOLVED', eventName: 'MentalHealthCaseResolved' },
      { action: 'CloseMentalHealthCase', from: 'RESOLVED', to: 'CLOSED', eventName: 'MentalHealthCaseClosed' },
    ],
    initialState: 'OPEN',
    terminalStates: ['CLOSED'],
  };
  fsm.register(definition);
}
''')

print("WEAP repos/fsms done")

# ========================================================================
# WELLBEING EAP - Command Handlers
# ========================================================================

write(BASE/"wellbeing-eap/commands/create-eap-referral.handler.ts", '''import { Injectable } from '@nestjs/common';
import { CommandHandler } from '../../../platform/command-bus/command-handler.decorator.js';
import type { HrCommandEnvelope, CommandResult } from '@hcm/command-contracts';
import { Uuid } from '@hcm/shared-kernel';
import { FsmFramework } from '../../../platform/workflow/fsm-framework.js';
import { EapReferral } from '../aggregates/eap-referral.aggregate.js';
import { EapReferralRepository } from '../repositories/eap-referral.repository.js';
import { WellbeingEapEventsPublisher } from '../events/wellbeing-eap-events.publisher.js';

@CommandHandler('CreateEapReferral')
@Injectable()
export class CreateEapReferralHandler {
  constructor(
    private readonly repo: EapReferralRepository,
    private readonly fsm: FsmFramework,
    private readonly publisher: WellbeingEapEventsPublisher,
  ) {}

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>> {
    const payload = command.payload as { workerId: Uuid; reason: string; scheduledDate?: Date; providerId?: Uuid; notes?: string };
    const ar = EapReferral.create({ id: Uuid.generate(), tenantId: command.tenantId, ...payload }, command.correlationId);
    await this.repo.save(ar);
    await this.publisher.publishFromAggregate(ar);
    return {
      success: true,
      data: { eapReferralId: ar.id.value, status: ar.status },
      commandId: command.commandId,
      correlationId: command.correlationId,
      aggregateId: ar.id,
      newState: ar.status,
      newVersion: ar.aggregateVersion,
      allowedNextActions: this.fsm.getAllowedActionsFromState(ar.status, 'EapReferral'),
      eventsEmitted: ar.domainEvents.map((e) => e.eventName),
      auditRecordId: command.commandId,
    } as CommandResult<unknown>;
  }
}
''')

write(BASE/"wellbeing-eap/commands/schedule-eap-referral.handler.ts", '''import { Injectable } from '@nestjs/common';
import { CommandHandler } from '../../../platform/command-bus/command-handler.decorator.js';
import type { HrCommandEnvelope, CommandResult } from '@hcm/command-contracts';
import { Uuid } from '@hcm/shared-kernel';
import { FsmFramework } from '../../../platform/workflow/fsm-framework.js';
import { EapReferralRepository } from '../repositories/eap-referral.repository.js';
import { WellbeingEapEventsPublisher } from '../events/wellbeing-eap-events.publisher.js';

@CommandHandler('ScheduleEapReferral')
@Injectable()
export class ScheduleEapReferralHandler {
  constructor(
    private readonly repo: EapReferralRepository,
    private readonly fsm: FsmFramework,
    private readonly publisher: WellbeingEapEventsPublisher,
  ) {}

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>> {
    const payload = command.payload as { eapReferralId: Uuid; scheduledDate: Date };
    const ar = await this.repo.findById(payload.eapReferralId);
    if (!ar) throw new Error('EAP referral not found');
    ar.schedule(payload.scheduledDate, command.correlationId);
    await this.repo.save(ar);
    await this.publisher.publishFromAggregate(ar);
    return {
      success: true,
      data: { eapReferralId: ar.id.value, status: ar.status },
      commandId: command.commandId,
      correlationId: command.correlationId,
      aggregateId: ar.id,
      newState: ar.status,
      newVersion: ar.aggregateVersion,
      allowedNextActions: this.fsm.getAllowedActionsFromState(ar.status, 'EapReferral'),
      eventsEmitted: ar.domainEvents.map((e) => e.eventName),
      auditRecordId: command.commandId,
    } as CommandResult<unknown>;
  }
}
''')

write(BASE/"wellbeing-eap/commands/start-eap-referral.handler.ts", '''import { Injectable } from '@nestjs/common';
import { CommandHandler } from '../../../platform/command-bus/command-handler.decorator.js';
import type { HrCommandEnvelope, CommandResult } from '@hcm/command-contracts';
import { Uuid } from '@hcm/shared-kernel';
import { FsmFramework } from '../../../platform/workflow/fsm-framework.js';
import { EapReferralRepository } from '../repositories/eap-referral.repository.js';
import { WellbeingEapEventsPublisher } from '../events/wellbeing-eap-events.publisher.js';

@CommandHandler('StartEapReferral')
@Injectable()
export class StartEapReferralHandler {
  constructor(
    private readonly repo: EapReferralRepository,
    private readonly fsm: FsmFramework,
    private readonly publisher: WellbeingEapEventsPublisher,
  ) {}

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>> {
    const payload = command.payload as { eapReferralId: Uuid };
    const ar = await this.repo.findById(payload.eapReferralId);
    if (!ar) throw new Error('EAP referral not found');
    ar.start(command.correlationId);
    await this.repo.save(ar);
    await this.publisher.publishFromAggregate(ar);
    return {
      success: true,
      data: { eapReferralId: ar.id.value, status: ar.status },
      commandId: command.commandId,
      correlationId: command.correlationId,
      aggregateId: ar.id,
      newState: ar.status,
      newVersion: ar.aggregateVersion,
      allowedNextActions: this.fsm.getAllowedActionsFromState(ar.status, 'EapReferral'),
      eventsEmitted: ar.domainEvents.map((e) => e.eventName),
      auditRecordId: command.commandId,
    } as CommandResult<unknown>;
  }
}
''')

write(BASE/"wellbeing-eap/commands/complete-eap-referral.handler.ts", '''import { Injectable } from '@nestjs/common';
import { CommandHandler } from '../../../platform/command-bus/command-handler.decorator.js';
import type { HrCommandEnvelope, CommandResult } from '@hcm/command-contracts';
import { Uuid } from '@hcm/shared-kernel';
import { FsmFramework } from '../../../platform/workflow/fsm-framework.js';
import { EapReferralRepository } from '../repositories/eap-referral.repository.js';
import { WellbeingEapEventsPublisher } from '../events/wellbeing-eap-events.publisher.js';

@CommandHandler('CompleteEapReferral')
@Injectable()
export class CompleteEapReferralHandler {
  constructor(
    private readonly repo: EapReferralRepository,
    private readonly fsm: FsmFramework,
    private readonly publisher: WellbeingEapEventsPublisher,
  ) {}

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>> {
    const payload = command.payload as { eapReferralId: Uuid };
    const ar = await this.repo.findById(payload.eapReferralId);
    if (!ar) throw new Error('EAP referral not found');
    ar.complete(command.correlationId);
    await this.repo.save(ar);
    await this.publisher.publishFromAggregate(ar);
    return {
      success: true,
      data: { eapReferralId: ar.id.value, status: ar.status },
      commandId: command.commandId,
      correlationId: command.correlationId,
      aggregateId: ar.id,
      newState: ar.status,
      newVersion: ar.aggregateVersion,
      allowedNextActions: this.fsm.getAllowedActionsFromState(ar.status, 'EapReferral'),
      eventsEmitted: ar.domainEvents.map((e) => e.eventName),
      auditRecordId: command.commandId,
    } as CommandResult<unknown>;
  }
}
''')

write(BASE/"wellbeing-eap/commands/close-eap-referral.handler.ts", '''import { Injectable } from '@nestjs/common';
import { CommandHandler } from '../../../platform/command-bus/command-handler.decorator.js';
import type { HrCommandEnvelope, CommandResult } from '@hcm/command-contracts';
import { Uuid } from '@hcm/shared-kernel';
import { FsmFramework } from '../../../platform/workflow/fsm-framework.js';
import { EapReferralRepository } from '../repositories/eap-referral.repository.js';
import { WellbeingEapEventsPublisher } from '../events/wellbeing-eap-events.publisher.js';

@CommandHandler('CloseEapReferral')
@Injectable()
export class CloseEapReferralHandler {
  constructor(
    private readonly repo: EapReferralRepository,
    private readonly fsm: FsmFramework,
    private readonly publisher: WellbeingEapEventsPublisher,
  ) {}

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>> {
    const payload = command.payload as { eapReferralId: Uuid };
    const ar = await this.repo.findById(payload.eapReferralId);
    if (!ar) throw new Error('EAP referral not found');
    ar.close(command.correlationId);
    await this.repo.save(ar);
    await this.publisher.publishFromAggregate(ar);
    return {
      success: true,
      data: { eapReferralId: ar.id.value, status: ar.status },
      commandId: command.commandId,
      correlationId: command.correlationId,
      aggregateId: ar.id,
      newState: ar.status,
      newVersion: ar.aggregateVersion,
      allowedNextActions: this.fsm.getAllowedActionsFromState(ar.status, 'EapReferral'),
      eventsEmitted: ar.domainEvents.map((e) => e.eventName),
      auditRecordId: command.commandId,
    } as CommandResult<unknown>;
  }
}
''')

write(BASE/"wellbeing-eap/commands/cancel-eap-referral.handler.ts", '''import { Injectable } from '@nestjs/common';
import { CommandHandler } from '../../../platform/command-bus/command-handler.decorator.js';
import type { HrCommandEnvelope, CommandResult } from '@hcm/command-contracts';
import { Uuid } from '@hcm/shared-kernel';
import { FsmFramework } from '../../../platform/workflow/fsm-framework.js';
import { EapReferralRepository } from '../repositories/eap-referral.repository.js';
import { WellbeingEapEventsPublisher } from '../events/wellbeing-eap-events.publisher.js';

@CommandHandler('CancelEapReferral')
@Injectable()
export class CancelEapReferralHandler {
  constructor(
    private readonly repo: EapReferralRepository,
    private readonly fsm: FsmFramework,
    private readonly publisher: WellbeingEapEventsPublisher,
  ) {}

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>> {
    const payload = command.payload as { eapReferralId: Uuid };
    const ar = await this.repo.findById(payload.eapReferralId);
    if (!ar) throw new Error('EAP referral not found');
    ar.cancel(command.correlationId);
    await this.repo.save(ar);
    await this.publisher.publishFromAggregate(ar);
    return {
      success: true,
      data: { eapReferralId: ar.id.value, status: ar.status },
      commandId: command.commandId,
      correlationId: command.correlationId,
      aggregateId: ar.id,
      newState: ar.status,
      newVersion: ar.aggregateVersion,
      allowedNextActions: this.fsm.getAllowedActionsFromState(ar.status, 'EapReferral'),
      eventsEmitted: ar.domainEvents.map((e) => e.eventName),
      auditRecordId: command.commandId,
    } as CommandResult<unknown>;
  }
}
''')

write(BASE/"wellbeing-eap/commands/create-wellness-program.handler.ts", '''import { Injectable } from '@nestjs/common';
import { CommandHandler } from '../../../platform/command-bus/command-handler.decorator.js';
import type { HrCommandEnvelope, CommandResult } from '@hcm/command-contracts';
import { Uuid } from '@hcm/shared-kernel';
import { FsmFramework } from '../../../platform/workflow/fsm-framework.js';
import { WellnessProgram } from '../aggregates/wellness-program.aggregate.js';
import { WellnessProgramRepository } from '../repositories/wellness-program.repository.js';
import { WellbeingEapEventsPublisher } from '../events/wellbeing-eap-events.publisher.js';

@CommandHandler('CreateWellnessProgram')
@Injectable()
export class CreateWellnessProgramHandler {
  constructor(
    private readonly repo: WellnessProgramRepository,
    private readonly fsm: FsmFramework,
    private readonly publisher: WellbeingEapEventsPublisher,
  ) {}

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>> {
    const payload = command.payload as { name: string; type: string; startDate?: Date; endDate?: Date; description?: string };
    const ar = WellnessProgram.create({ id: Uuid.generate(), tenantId: command.tenantId, ...payload }, command.correlationId);
    await this.repo.save(ar);
    await this.publisher.publishFromAggregate(ar);
    return {
      success: true,
      data: { wellnessProgramId: ar.id.value, status: ar.status },
      commandId: command.commandId,
      correlationId: command.correlationId,
      aggregateId: ar.id,
      newState: ar.status,
      newVersion: ar.aggregateVersion,
      allowedNextActions: this.fsm.getAllowedActionsFromState(ar.status, 'WellnessProgram'),
      eventsEmitted: ar.domainEvents.map((e) => e.eventName),
      auditRecordId: command.commandId,
    } as CommandResult<unknown>;
  }
}
''')

write(BASE/"wellbeing-eap/commands/activate-wellness-program.handler.ts", '''import { Injectable } from '@nestjs/common';
import { CommandHandler } from '../../../platform/command-bus/command-handler.decorator.js';
import type { HrCommandEnvelope, CommandResult } from '@hcm/command-contracts';
import { Uuid } from '@hcm/shared-kernel';
import { FsmFramework } from '../../../platform/workflow/fsm-framework.js';
import { WellnessProgramRepository } from '../repositories/wellness-program.repository.js';
import { WellbeingEapEventsPublisher } from '../events/wellbeing-eap-events.publisher.js';

@CommandHandler('ActivateWellnessProgram')
@Injectable()
export class ActivateWellnessProgramHandler {
  constructor(
    private readonly repo: WellnessProgramRepository,
    private readonly fsm: FsmFramework,
    private readonly publisher: WellbeingEapEventsPublisher,
  ) {}

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>> {
    const payload = command.payload as { wellnessProgramId: Uuid };
    const ar = await this.repo.findById(payload.wellnessProgramId);
    if (!ar) throw new Error('Wellness program not found');
    ar.activate(command.correlationId);
    await this.repo.save(ar);
    await this.publisher.publishFromAggregate(ar);
    return {
      success: true,
      data: { wellnessProgramId: ar.id.value, status: ar.status },
      commandId: command.commandId,
      correlationId: command.correlationId,
      aggregateId: ar.id,
      newState: ar.status,
      newVersion: ar.aggregateVersion,
      allowedNextActions: this.fsm.getAllowedActionsFromState(ar.status, 'WellnessProgram'),
      eventsEmitted: ar.domainEvents.map((e) => e.eventName),
      auditRecordId: command.commandId,
    } as CommandResult<unknown>;
  }
}
''')

write(BASE/"wellbeing-eap/commands/enroll-wellness-program.handler.ts", '''import { Injectable } from '@nestjs/common';
import { CommandHandler } from '../../../platform/command-bus/command-handler.decorator.js';
import type { HrCommandEnvelope, CommandResult } from '@hcm/command-contracts';
import { Uuid } from '@hcm/shared-kernel';
import { FsmFramework } from '../../../platform/workflow/fsm-framework.js';
import { WellnessProgramRepository } from '../repositories/wellness-program.repository.js';
import { WellbeingEapEventsPublisher } from '../events/wellbeing-eap-events.publisher.js';

@CommandHandler('EnrollWellnessProgram')
@Injectable()
export class EnrollWellnessProgramHandler {
  constructor(
    private readonly repo: WellnessProgramRepository,
    private readonly fsm: FsmFramework,
    private readonly publisher: WellbeingEapEventsPublisher,
  ) {}

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>> {
    const payload = command.payload as { wellnessProgramId: Uuid; workerId: Uuid };
    const ar = await this.repo.findById(payload.wellnessProgramId);
    if (!ar) throw new Error('Wellness program not found');
    ar.enroll(payload.workerId, command.correlationId);
    await this.repo.save(ar);
    await this.publisher.publishFromAggregate(ar);
    return {
      success: true,
      data: { wellnessProgramId: ar.id.value, status: ar.status },
      commandId: command.commandId,
      correlationId: command.correlationId,
      aggregateId: ar.id,
      newState: ar.status,
      newVersion: ar.aggregateVersion,
      allowedNextActions: this.fsm.getAllowedActionsFromState(ar.status, 'WellnessProgram'),
      eventsEmitted: ar.domainEvents.map((e) => e.eventName),
      auditRecordId: command.commandId,
    } as CommandResult<unknown>;
  }
}
''')

write(BASE/"wellbeing-eap/commands/complete-wellness-program.handler.ts", '''import { Injectable } from '@nestjs/common';
import { CommandHandler } from '../../../platform/command-bus/command-handler.decorator.js';
import type { HrCommandEnvelope, CommandResult } from '@hcm/command-contracts';
import { Uuid } from '@hcm/shared-kernel';
import { FsmFramework } from '../../../platform/workflow/fsm-framework.js';
import { WellnessProgramRepository } from '../repositories/wellness-program.repository.js';
import { WellbeingEapEventsPublisher } from '../events/wellbeing-eap-events.publisher.js';

@CommandHandler('CompleteWellnessProgram')
@Injectable()
export class CompleteWellnessProgramHandler {
  constructor(
    private readonly repo: WellnessProgramRepository,
    private readonly fsm: FsmFramework,
    private readonly publisher: WellbeingEapEventsPublisher,
  ) {}

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>> {
    const payload = command.payload as { wellnessProgramId: Uuid };
    const ar = await this.repo.findById(payload.wellnessProgramId);
    if (!ar) throw new Error('Wellness program not found');
    ar.complete(command.correlationId);
    await this.repo.save(ar);
    await this.publisher.publishFromAggregate(ar);
    return {
      success: true,
      data: { wellnessProgramId: ar.id.value, status: ar.status },
      commandId: command.commandId,
      correlationId: command.correlationId,
      aggregateId: ar.id,
      newState: ar.status,
      newVersion: ar.aggregateVersion,
      allowedNextActions: this.fsm.getAllowedActionsFromState(ar.status, 'WellnessProgram'),
      eventsEmitted: ar.domainEvents.map((e) => e.eventName),
      auditRecordId: command.commandId,
    } as CommandResult<unknown>;
  }
}
''')

write(BASE/"wellbeing-eap/commands/cancel-wellness-program.handler.ts", '''import { Injectable } from '@nestjs/common';
import { CommandHandler } from '../../../platform/command-bus/command-handler.decorator.js';
import type { HrCommandEnvelope, CommandResult } from '@hcm/command-contracts';
import { Uuid } from '@hcm/shared-kernel';
import { FsmFramework } from '../../../platform/workflow/fsm-framework.js';
import { WellnessProgramRepository } from '../repositories/wellness-program.repository.js';
import { WellbeingEapEventsPublisher } from '../events/wellbeing-eap-events.publisher.js';

@CommandHandler('CancelWellnessProgram')
@Injectable()
export class CancelWellnessProgramHandler {
  constructor(
    private readonly repo: WellnessProgramRepository,
    private readonly fsm: FsmFramework,
    private readonly publisher: WellbeingEapEventsPublisher,
  ) {}

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>> {
    const payload = command.payload as { wellnessProgramId: Uuid };
    const ar = await this.repo.findById(payload.wellnessProgramId);
    if (!ar) throw new Error('Wellness program not found');
    ar.cancel(command.correlationId);
    await this.repo.save(ar);
    await this.publisher.publishFromAggregate(ar);
    return {
      success: true,
      data: { wellnessProgramId: ar.id.value, status: ar.status },
      commandId: command.commandId,
      correlationId: command.correlationId,
      aggregateId: ar.id,
      newState: ar.status,
      newVersion: ar.aggregateVersion,
      allowedNextActions: this.fsm.getAllowedActionsFromState(ar.status, 'WellnessProgram'),
      eventsEmitted: ar.domainEvents.map((e) => e.eventName),
      auditRecordId: command.commandId,
    } as CommandResult<unknown>;
  }
}
''')

write(BASE/"wellbeing-eap/commands/archive-wellness-program.handler.ts", '''import { Injectable } from '@nestjs/common';
import { CommandHandler } from '../../../platform/command-bus/command-handler.decorator.js';
import type { HrCommandEnvelope, CommandResult } from '@hcm/command-contracts';
import { Uuid } from '@hcm/shared-kernel';
import { FsmFramework } from '../../../platform/workflow/fsm-framework.js';
import { WellnessProgramRepository } from '../repositories/wellness-program.repository.js';
import { WellbeingEapEventsPublisher } from '../events/wellbeing-eap-events.publisher.js';

@CommandHandler('ArchiveWellnessProgram')
@Injectable()
export class ArchiveWellnessProgramHandler {
  constructor(
    private readonly repo: WellnessProgramRepository,
    private readonly fsm: FsmFramework,
    private readonly publisher: WellbeingEapEventsPublisher,
  ) {}

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>> {
    const payload = command.payload as { wellnessProgramId: Uuid };
    const ar = await this.repo.findById(payload.wellnessProgramId);
    if (!ar) throw new Error('Wellness program not found');
    ar.archive(command.correlationId);
    await this.repo.save(ar);
    await this.publisher.publishFromAggregate(ar);
    return {
      success: true,
      data: { wellnessProgramId: ar.id.value, status: ar.status },
      commandId: command.commandId,
      correlationId: command.correlationId,
      aggregateId: ar.id,
      newState: ar.status,
      newVersion: ar.aggregateVersion,
      allowedNextActions: this.fsm.getAllowedActionsFromState(ar.status, 'WellnessProgram'),
      eventsEmitted: ar.domainEvents.map((e) => e.eventName),
      auditRecordId: command.commandId,
    } as CommandResult<unknown>;
  }
}
''')

write(BASE/"wellbeing-eap/commands/create-mental-health-case.handler.ts", '''import { Injectable } from '@nestjs/common';
import { CommandHandler } from '../../../platform/command-bus/command-handler.decorator.js';
import type { HrCommandEnvelope, CommandResult } from '@hcm/command-contracts';
import { Uuid } from '@hcm/shared-kernel';
import { FsmFramework } from '../../../platform/workflow/fsm-framework.js';
import { MentalHealthCase } from '../aggregates/mental-health-case.aggregate.js';
import { MentalHealthCaseRepository } from '../repositories/mental-health-case.repository.js';
import { WellbeingEapEventsPublisher } from '../events/wellbeing-eap-events.publisher.js';

@CommandHandler('CreateMentalHealthCase')
@Injectable()
export class CreateMentalHealthCaseHandler {
  constructor(
    private readonly repo: MentalHealthCaseRepository,
    private readonly fsm: FsmFramework,
    private readonly publisher: WellbeingEapEventsPublisher,
  ) {}

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>> {
    const payload = command.payload as { workerId: Uuid; severity: string; providerId?: Uuid; notes?: string };
    const ar = MentalHealthCase.create({ id: Uuid.generate(), tenantId: command.tenantId, ...payload }, command.correlationId);
    await this.repo.save(ar);
    await this.publisher.publishFromAggregate(ar);
    return {
      success: true,
      data: { mentalHealthCaseId: ar.id.value, status: ar.status },
      commandId: command.commandId,
      correlationId: command.correlationId,
      aggregateId: ar.id,
      newState: ar.status,
      newVersion: ar.aggregateVersion,
      allowedNextActions: this.fsm.getAllowedActionsFromState(ar.status, 'MentalHealthCase'),
      eventsEmitted: ar.domainEvents.map((e) => e.eventName),
      auditRecordId: command.commandId,
    } as CommandResult<unknown>;
  }
}
''')

write(BASE/"wellbeing-eap/commands/assign-to-mental-health-case.handler.ts", '''import { Injectable } from '@nestjs/common';
import { CommandHandler } from '../../../platform/command-bus/command-handler.decorator.js';
import type { HrCommandEnvelope, CommandResult } from '@hcm/command-contracts';
import { Uuid } from '@hcm/shared-kernel';
import { FsmFramework } from '../../../platform/workflow/fsm-framework.js';
import { MentalHealthCaseRepository } from '../repositories/mental-health-case.repository.js';
import { WellbeingEapEventsPublisher } from '../events/wellbeing-eap-events.publisher.js';

@CommandHandler('AssignToMentalHealthCase')
@Injectable()
export class AssignToMentalHealthCaseHandler {
  constructor(
    private readonly repo: MentalHealthCaseRepository,
    private readonly fsm: FsmFramework,
    private readonly publisher: WellbeingEapEventsPublisher,
  ) {}

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>> {
    const payload = command.payload as { mentalHealthCaseId: Uuid; providerId: Uuid };
    const ar = await this.repo.findById(payload.mentalHealthCaseId);
    if (!ar) throw new Error('Mental health case not found');
    ar.assignTo(payload.providerId, command.correlationId);
    await this.repo.save(ar);
    await this.publisher.publishFromAggregate(ar);
    return {
      success: true,
      data: { mentalHealthCaseId: ar.id.value, status: ar.status },
      commandId: command.commandId,
      correlationId: command.correlationId,
      aggregateId: ar.id,
      newState: ar.status,
      newVersion: ar.aggregateVersion,
      allowedNextActions: this.fsm.getAllowedActionsFromState(ar.status, 'MentalHealthCase'),
      eventsEmitted: ar.domainEvents.map((e) => e.eventName),
      auditRecordId: command.commandId,
    } as CommandResult<unknown>;
  }
}
''')

write(BASE/"wellbeing-eap/commands/start-mental-health-case.handler.ts", '''import { Injectable } from '@nestjs/common';
import { CommandHandler } from '../../../platform/command-bus/command-handler.decorator.js';
import type { HrCommandEnvelope, CommandResult } from '@hcm/command-contracts';
import { Uuid } from '@hcm/shared-kernel';
import { FsmFramework } from '../../../platform/workflow/fsm-framework.js';
import { MentalHealthCaseRepository } from '../repositories/mental-health-case.repository.js';
import { WellbeingEapEventsPublisher } from '../events/wellbeing-eap-events.publisher.js';

@CommandHandler('StartMentalHealthCase')
@Injectable()
export class StartMentalHealthCaseHandler {
  constructor(
    private readonly repo: MentalHealthCaseRepository,
    private readonly fsm: FsmFramework,
    private readonly publisher: WellbeingEapEventsPublisher,
  ) {}

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>> {
    const payload = command.payload as { mentalHealthCaseId: Uuid };
    const ar = await this.repo.findById(payload.mentalHealthCaseId);
    if (!ar) throw new Error('Mental health case not found');
    ar.start(command.correlationId);
    await this.repo.save(ar);
    await this.publisher.publishFromAggregate(ar);
    return {
      success: true,
      data: { mentalHealthCaseId: ar.id.value, status: ar.status },
      commandId: command.commandId,
      correlationId: command.correlationId,
      aggregateId: ar.id,
      newState: ar.status,
      newVersion: ar.aggregateVersion,
      allowedNextActions: this.fsm.getAllowedActionsFromState(ar.status, 'MentalHealthCase'),
      eventsEmitted: ar.domainEvents.map((e) => e.eventName),
      auditRecordId: command.commandId,
    } as CommandResult<unknown>;
  }
}
''')

write(BASE/"wellbeing-eap/commands/resolve-mental-health-case.handler.ts", '''import { Injectable } from '@nestjs/common';
import { CommandHandler } from '../../../platform/command-bus/command-handler.decorator.js';
import type { HrCommandEnvelope, CommandResult } from '@hcm/command-contracts';
import { Uuid } from '@hcm/shared-kernel';
import { FsmFramework } from '../../../platform/workflow/fsm-framework.js';
import { MentalHealthCaseRepository } from '../repositories/mental-health-case.repository.js';
import { WellbeingEapEventsPublisher } from '../events/wellbeing-eap-events.publisher.js';

@CommandHandler('ResolveMentalHealthCase')
@Injectable()
export class ResolveMentalHealthCaseHandler {
  constructor(
    private readonly repo: MentalHealthCaseRepository,
    private readonly fsm: FsmFramework,
    private readonly publisher: WellbeingEapEventsPublisher,
  ) {}

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>> {
    const payload = command.payload as { mentalHealthCaseId: Uuid };
    const ar = await this.repo.findById(payload.mentalHealthCaseId);
    if (!ar) throw new Error('Mental health case not found');
    ar.resolve(command.correlationId);
    await this.repo.save(ar);
    await this.publisher.publishFromAggregate(ar);
    return {
      success: true,
      data: { mentalHealthCaseId: ar.id.value, status: ar.status },
      commandId: command.commandId,
      correlationId: command.correlationId,
      aggregateId: ar.id,
      newState: ar.status,
      newVersion: ar.aggregateVersion,
      allowedNextActions: this.fsm.getAllowedActionsFromState(ar.status, 'MentalHealthCase'),
      eventsEmitted: ar.domainEvents.map((e) => e.eventName),
      auditRecordId: command.commandId,
    } as CommandResult<unknown>;
  }
}
''')

write(BASE/"wellbeing-eap/commands/close-mental-health-case.handler.ts", '''import { Injectable } from '@nestjs/common';
import { CommandHandler } from '../../../platform/command-bus/command-handler.decorator.js';
import type { HrCommandEnvelope, CommandResult } from '@hcm/command-contracts';
import { Uuid } from '@hcm/shared-kernel';
import { FsmFramework } from '../../../platform/workflow/fsm-framework.js';
import { MentalHealthCaseRepository } from '../repositories/mental-health-case.repository.js';
import { WellbeingEapEventsPublisher } from '../events/wellbeing-eap-events.publisher.js';

@CommandHandler('CloseMentalHealthCase')
@Injectable()
export class CloseMentalHealthCaseHandler {
  constructor(
    private readonly repo: MentalHealthCaseRepository,
    private readonly fsm: FsmFramework,
    private readonly publisher: WellbeingEapEventsPublisher,
  ) {}

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>> {
    const payload = command.payload as { mentalHealthCaseId: Uuid };
    const ar = await this.repo.findById(payload.mentalHealthCaseId);
    if (!ar) throw new Error('Mental health case not found');
    ar.close(command.correlationId);
    await this.repo.save(ar);
    await this.publisher.publishFromAggregate(ar);
    return {
      success: true,
      data: { mentalHealthCaseId: ar.id.value, status: ar.status },
      commandId: command.commandId,
      correlationId: command.correlationId,
      aggregateId: ar.id,
      newState: ar.status,
      newVersion: ar.aggregateVersion,
      allowedNextActions: this.fsm.getAllowedActionsFromState(ar.status, 'MentalHealthCase'),
      eventsEmitted: ar.domainEvents.map((e) => e.eventName),
      auditRecordId: command.commandId,
    } as CommandResult<unknown>;
  }
}
''')

print("WEAP command handlers done")

# ========================================================================
# WELLBEING EAP - Events publisher, controller, DTOs, module
# ========================================================================

write(BASE/"wellbeing-eap/events/wellbeing-eap-events.publisher.ts", '''import { Injectable } from '@nestjs/common';
import { EventBus } from '../../../platform/events/event-bus.js';
import { createPrivacyForEvent } from '@hcm/event-schemas';
import { HrEventEnvelope } from '@hcm/command-contracts';
import { EapReferral } from '../aggregates/eap-referral.aggregate.js';
import { WellnessProgram } from '../aggregates/wellness-program.aggregate.js';
import { MentalHealthCase } from '../aggregates/mental-health-case.aggregate.js';

@Injectable()
export class WellbeingEapEventsPublisher {
  constructor(private readonly eventBus: EventBus) {}

  async publishFromAggregate(aggregate: EapReferral | WellnessProgram | MentalHealthCase): Promise<void> {
    for (const event of aggregate.domainEvents) {
      const envelope = HrEventEnvelope.create({
        eventName: event.eventName,
        aggregateType: event.aggregateType,
        aggregateId: event.aggregateId.value,
        tenantId: event.tenantId.value,
        correlationId: event.correlationId,
        payload: event.payload,
        privacy: this.buildPrivacy(aggregate),
        occurredAt: new Date(),
      });
      await this.eventBus.publish(envelope);
    }
  }

  private buildPrivacy(aggregate: EapReferral | WellnessProgram | MentalHealthCase) {
    return createPrivacyForEvent('NONE', aggregate.id.value, 'PROFILE');
  }
}
''')

write(BASE/"wellbeing-eap/api/wellbeing-eap.controller.ts", '''import { Controller, Post, Get, Body, Param, Req, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CommandBus } from '../../../platform/command-bus/command-bus.js';
import { ZodValidationPipe } from '../../../platform/validation/zod-validation.pipe.js';
import { JwtAuthGuard } from '../../../platform/security/jwt-auth.guard.js';
import { Uuid } from '@hcm/shared-kernel';
import type { Request } from 'express';
import { randomUUID } from 'crypto';
import {
  CreateEapReferralDto,
  CreateWellnessProgramDto,
  CreateMentalHealthCaseDto,
} from './wellbeing-eap.dto.js';

@ApiTags('Wellbeing EAP')
@UseGuards(JwtAuthGuard)
@Controller('wellbeing-eap')
export class WellbeingEapController {
  constructor(private readonly commandBus: CommandBus) {}

  private buildCommand(action: string, tenantId: Uuid, payload: unknown, roles: string[] = ['HR_ADMIN']) {
    return {
      commandId: Uuid.generate(),
      commandName: action,
      tenantId,
      payload,
      correlationId: randomUUID(),
      actor: { id: Uuid.generate(), roles },
      occurredAt: new Date(),
    };
  }

  @Post('eap-referrals')
  async createReferral(@Body(new ZodValidationPipe(CreateEapReferralDto)) dto: unknown, @Req() req: Request) {
    return this.commandBus.execute(this.buildCommand('CreateEapReferral', new Uuid(req['tenantId']), dto));
  }

  @Get('eap-referrals/:id')
  async getReferral(@Param('id') id: string) {
    return { id };
  }

  @Post('eap-referrals/:id/commands/:action')
  async referralCommand(@Param('id') id: string, @Param('action') action: string, @Req() req: Request, @Body() body: unknown) {
    const payload = { eapReferralId: new Uuid(id), ...(body as object) };
    return this.commandBus.execute(this.buildCommand(`${action[0].toUpperCase()}${action.slice(1)}EapReferral`, new Uuid(req['tenantId']), payload));
  }

  @Post('wellness-programs')
  async createProgram(@Body(new ZodValidationPipe(CreateWellnessProgramDto)) dto: unknown, @Req() req: Request) {
    return this.commandBus.execute(this.buildCommand('CreateWellnessProgram', new Uuid(req['tenantId']), dto));
  }

  @Get('wellness-programs/:id')
  async getProgram(@Param('id') id: string) {
    return { id };
  }

  @Post('wellness-programs/:id/commands/:action')
  async programCommand(@Param('id') id: string, @Param('action') action: string, @Req() req: Request, @Body() body: unknown) {
    const payload = { wellnessProgramId: new Uuid(id), ...(body as object) };
    return this.commandBus.execute(this.buildCommand(`${action[0].toUpperCase()}${action.slice(1)}WellnessProgram`, new Uuid(req['tenantId']), payload));
  }

  @Post('mental-health-cases')
  async createMhCase(@Body(new ZodValidationPipe(CreateMentalHealthCaseDto)) dto: unknown, @Req() req: Request) {
    return this.commandBus.execute(this.buildCommand('CreateMentalHealthCase', new Uuid(req['tenantId']), dto));
  }

  @Get('mental-health-cases/:id')
  async getMhCase(@Param('id') id: string) {
    return { id };
  }

  @Post('mental-health-cases/:id/commands/:action')
  async mhCaseCommand(@Param('id') id: string, @Param('action') action: string, @Req() req: Request, @Body() body: unknown) {
    const payload = { mentalHealthCaseId: new Uuid(id), ...(body as object) };
    return this.commandBus.execute(this.buildCommand(`${action[0].toUpperCase()}${action.slice(1)}MentalHealthCase`, new Uuid(req['tenantId']), payload));
  }
}
''')

write(BASE/"wellbeing-eap/api/wellbeing-eap.dto.ts", '''import { z } from 'zod';

export const CreateEapReferralDto = z.object({
  workerId: z.string().uuid(),
  reason: z.string().min(1),
  scheduledDate: z.coerce.date().optional(),
  providerId: z.string().uuid().optional(),
  notes: z.string().optional(),
});

export const CreateWellnessProgramDto = z.object({
  name: z.string().min(1),
  type: z.string().min(1),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  description: z.string().optional(),
});

export const CreateMentalHealthCaseDto = z.object({
  workerId: z.string().uuid(),
  severity: z.string().min(1),
  providerId: z.string().uuid().optional(),
  notes: z.string().optional(),
});
''')

write(BASE/"wellbeing-eap/wellbeing-eap.module.ts", '''import { Module, OnModuleInit } from '@nestjs/common';
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
''')

print("WEAP all done")

# ========================================================================
# UNION & LABOR - Aggregates
# ========================================================================

write(BASE/"union-labor/aggregates/union-recognition.aggregate.ts", '''import { AggregateRoot, Uuid, ValidationError, DomainEvent } from '@hcm/shared-kernel';

export class UnionRecognitionCreated extends DomainEvent {
  constructor(aggregateId: Uuid, tenantId: Uuid, public readonly payload: { unionName: string; bargainingUnitId: Uuid }, correlationId: string) {
    super(aggregateId, tenantId, 'UnionRecognitionCreated', payload, correlationId);
  }
  get eventName() { return 'UnionRecognitionCreated'; }
  get aggregateType() { return 'UnionRecognition'; }
}

export class UnionRecognitionNegotiating extends DomainEvent {
  constructor(aggregateId: Uuid, tenantId: Uuid, public readonly payload: Record<string, unknown>, correlationId: string) {
    super(aggregateId, tenantId, 'UnionRecognitionNegotiating', payload, correlationId);
  }
  get eventName() { return 'UnionRecognitionNegotiating'; }
  get aggregateType() { return 'UnionRecognition'; }
}

export class UnionRecognitionRatified extends DomainEvent {
  constructor(aggregateId: Uuid, tenantId: Uuid, public readonly payload: Record<string, unknown>, correlationId: string) {
    super(aggregateId, tenantId, 'UnionRecognitionRatified', payload, correlationId);
  }
  get eventName() { return 'UnionRecognitionRatified'; }
  get aggregateType() { return 'UnionRecognition'; }
}

export class UnionRecognitionActive extends DomainEvent {
  constructor(aggregateId: Uuid, tenantId: Uuid, public readonly payload: Record<string, unknown>, correlationId: string) {
    super(aggregateId, tenantId, 'UnionRecognitionActive', payload, correlationId);
  }
  get eventName() { return 'UnionRecognitionActive'; }
  get aggregateType() { return 'UnionRecognition'; }
}

export class UnionRecognitionExpired extends DomainEvent {
  constructor(aggregateId: Uuid, tenantId: Uuid, public readonly payload: Record<string, unknown>, correlationId: string) {
    super(aggregateId, tenantId, 'UnionRecognitionExpired', payload, correlationId);
  }
  get eventName() { return 'UnionRecognitionExpired'; }
  get aggregateType() { return 'UnionRecognition'; }
}

export class UnionRecognitionRenewed extends DomainEvent {
  constructor(aggregateId: Uuid, tenantId: Uuid, public readonly payload: Record<string, unknown>, correlationId: string) {
    super(aggregateId, tenantId, 'UnionRecognitionRenewed', payload, correlationId);
  }
  get eventName() { return 'UnionRecognitionRenewed'; }
  get aggregateType() { return 'UnionRecognition'; }
}

export class UnionRecognition extends AggregateRoot {
  id!: Uuid;
  tenantId!: Uuid;
  unionName!: string;
  bargainingUnitId!: Uuid;
  status: 'RECOGNIZED' | 'NEGOTIATING' | 'RATIFIED' | 'ACTIVE' | 'EXPIRED' | 'RENEWED' = 'RECOGNIZED';
  effectiveDate?: Date;
  expirationDate?: Date;
  agreementDocument?: string;
  createdAt = new Date();
  updatedAt = new Date();

  static create(props: { id: Uuid; tenantId: Uuid; unionName: string; bargainingUnitId: Uuid; effectiveDate?: Date; expirationDate?: Date; agreementDocument?: string }, correlationId: string): UnionRecognition {
    const ar = new UnionRecognition();
    ar.id = props.id;
    ar.tenantId = props.tenantId;
    ar.unionName = props.unionName;
    ar.bargainingUnitId = props.bargainingUnitId;
    ar.effectiveDate = props.effectiveDate;
    ar.expirationDate = props.expirationDate;
    ar.agreementDocument = props.agreementDocument;
    ar.status = 'RECOGNIZED';
    ar.addDomainEvent(new UnionRecognitionCreated(ar.id, ar.tenantId, { unionName: ar.unionName, bargainingUnitId: ar.bargainingUnitId }, correlationId));
    ar.incrementVersion();
    return ar;
  }

  negotiate(correlationId: string) {
    if (this.status !== 'RECOGNIZED') throw new ValidationError('UnionRecognition', 'negotiate', 'Must be RECOGNIZED');
    this.status = 'NEGOTIATING';
    this.updatedAt = new Date();
    this.addDomainEvent(new UnionRecognitionNegotiating(this.id, this.tenantId, {}, correlationId));
    this.incrementVersion();
  }

  ratify(correlationId: string) {
    if (this.status !== 'NEGOTIATING') throw new ValidationError('UnionRecognition', 'ratify', 'Must be NEGOTIATING');
    this.status = 'RATIFIED';
    this.updatedAt = new Date();
    this.addDomainEvent(new UnionRecognitionRatified(this.id, this.tenantId, {}, correlationId));
    this.incrementVersion();
  }

  activate(correlationId: string) {
    if (this.status !== 'RATIFIED') throw new ValidationError('UnionRecognition', 'activate', 'Must be RATIFIED');
    this.status = 'ACTIVE';
    this.updatedAt = new Date();
    this.addDomainEvent(new UnionRecognitionActive(this.id, this.tenantId, {}, correlationId));
    this.incrementVersion();
  }

  expire(correlationId: string) {
    if (!['ACTIVE', 'RATIFIED'].includes(this.status)) throw new ValidationError('UnionRecognition', 'expire', 'Must be ACTIVE or RATIFIED');
    this.status = 'EXPIRED';
    this.updatedAt = new Date();
    this.addDomainEvent(new UnionRecognitionExpired(this.id, this.tenantId, {}, correlationId));
    this.incrementVersion();
  }

  renew(correlationId: string) {
    if (this.status !== 'EXPIRED') throw new ValidationError('UnionRecognition', 'renew', 'Must be EXPIRED');
    this.status = 'RENEWED';
    this.updatedAt = new Date();
    this.addDomainEvent(new UnionRecognitionRenewed(this.id, this.tenantId, {}, correlationId));
    this.incrementVersion();
  }
}
''')

write(BASE/"union-labor/aggregates/grievance.aggregate.ts", '''import { AggregateRoot, Uuid, ValidationError, DomainEvent } from '@hcm/shared-kernel';

export class GrievanceFiled extends DomainEvent {
  constructor(aggregateId: Uuid, tenantId: Uuid, public readonly payload: { workerId: Uuid; grievanceType: string; description: string }, correlationId: string) {
    super(aggregateId, tenantId, 'GrievanceFiled', payload, correlationId);
  }
  get eventName() { return 'GrievanceFiled'; }
  get aggregateType() { return 'Grievance'; }
}

export class GrievanceAcknowledged extends DomainEvent {
  constructor(aggregateId: Uuid, tenantId: Uuid, public readonly payload: Record<string, unknown>, correlationId: string) {
    super(aggregateId, tenantId, 'GrievanceAcknowledged', payload, correlationId);
  }
  get eventName() { return 'GrievanceAcknowledged'; }
  get aggregateType() { return 'Grievance'; }
}

export class GrievanceUnderInvestigation extends DomainEvent {
  constructor(aggregateId: Uuid, tenantId: Uuid, public readonly payload: Record<string, unknown>, correlationId: string) {
    super(aggregateId, tenantId, 'GrievanceUnderInvestigation', payload, correlationId);
  }
  get eventName() { return 'GrievanceUnderInvestigation'; }
  get aggregateType() { return 'Grievance'; }
}

export class GrievanceResolved extends DomainEvent {
  constructor(aggregateId: Uuid, tenantId: Uuid, public readonly payload: Record<string, unknown>, correlationId: string) {
    super(aggregateId, tenantId, 'GrievanceResolved', payload, correlationId);
  }
  get eventName() { return 'GrievanceResolved'; }
  get aggregateType() { return 'Grievance'; }
}

export class GrievanceArbitrated extends DomainEvent {
  constructor(aggregateId: Uuid, tenantId: Uuid, public readonly payload: Record<string, unknown>, correlationId: string) {
    super(aggregateId, tenantId, 'GrievanceArbitrated', payload, correlationId);
  }
  get eventName() { return 'GrievanceArbitrated'; }
  get aggregateType() { return 'Grievance'; }
}

export class GrievanceWithdrawn extends DomainEvent {
  constructor(aggregateId: Uuid, tenantId: Uuid, public readonly payload: Record<string, unknown>, correlationId: string) {
    super(aggregateId, tenantId, 'GrievanceWithdrawn', payload, correlationId);
  }
  get eventName() { return 'GrievanceWithdrawn'; }
  get aggregateType() { return 'Grievance'; }
}

export class Grievance extends AggregateRoot {
  id!: Uuid;
  tenantId!: Uuid;
  workerId!: Uuid;
  grievanceType!: string;
  description!: string;
  status: 'FILED' | 'ACKNOWLEDGED' | 'UNDER_INVESTIGATION' | 'RESOLVED' | 'ARBITRATED' | 'WITHDRAWN' = 'FILED';
  resolution?: string;
  arbitratorDecision?: string;
  createdAt = new Date();
  updatedAt = new Date();

  static create(props: { id: Uuid; tenantId: Uuid; workerId: Uuid; grievanceType: string; description: string; resolution?: string; arbitratorDecision?: string }, correlationId: string): Grievance {
    const ar = new Grievance();
    ar.id = props.id;
    ar.tenantId = props.tenantId;
    ar.workerId = props.workerId;
    ar.grievanceType = props.grievanceType;
    ar.description = props.description;
    ar.resolution = props.resolution;
    ar.arbitratorDecision = props.arbitratorDecision;
    ar.status = 'FILED';
    ar.addDomainEvent(new GrievanceFiled(ar.id, ar.tenantId, { workerId: ar.workerId, grievanceType: ar.grievanceType, description: ar.description }, correlationId));
    ar.incrementVersion();
    return ar;
  }

  acknowledge(correlationId: string) {
    if (this.status !== 'FILED') throw new ValidationError('Grievance', 'acknowledge', 'Must be FILED');
    this.status = 'ACKNOWLEDGED';
    this.updatedAt = new Date();
    this.addDomainEvent(new GrievanceAcknowledged(this.id, this.tenantId, {}, correlationId));
    this.incrementVersion();
  }

  startInvestigation(correlationId: string) {
    if (this.status !== 'ACKNOWLEDGED') throw new ValidationError('Grievance', 'startInvestigation', 'Must be ACKNOWLEDGED');
    this.status = 'UNDER_INVESTIGATION';
    this.updatedAt = new Date();
    this.addDomainEvent(new GrievanceUnderInvestigation(this.id, this.tenantId, {}, correlationId));
    this.incrementVersion();
  }

  resolve(correlationId: string) {
    if (this.status !== 'UNDER_INVESTIGATION') throw new ValidationError('Grievance', 'resolve', 'Must be UNDER_INVESTIGATION');
    this.status = 'RESOLVED';
    this.updatedAt = new Date();
    this.addDomainEvent(new GrievanceResolved(this.id, this.tenantId, {}, correlationId));
    this.incrementVersion();
  }

  arbitrate(correlationId: string) {
    if (this.status !== 'UNDER_INVESTIGATION') throw new ValidationError('Grievance', 'arbitrate', 'Must be UNDER_INVESTIGATION');
    this.status = 'ARBITRATED';
    this.updatedAt = new Date();
    this.addDomainEvent(new GrievanceArbitrated(this.id, this.tenantId, {}, correlationId));
    this.incrementVersion();
  }

  withdraw(correlationId: string) {
    if (!['FILED', 'ACKNOWLEDGED', 'UNDER_INVESTIGATION'].includes(this.status)) throw new ValidationError('Grievance', 'withdraw', 'Must be FILED, ACKNOWLEDGED, or UNDER_INVESTIGATION');
    this.status = 'WITHDRAWN';
    this.updatedAt = new Date();
    this.addDomainEvent(new GrievanceWithdrawn(this.id, this.tenantId, {}, correlationId));
    this.incrementVersion();
  }
}
''')

write(BASE/"union-labor/aggregates/collective-bargaining-session.aggregate.ts", '''import { AggregateRoot, Uuid, ValidationError, DomainEvent } from '@hcm/shared-kernel';

export class CollectiveBargainingSessionCreated extends DomainEvent {
  constructor(aggregateId: Uuid, tenantId: Uuid, public readonly payload: { unionRecognitionId: Uuid; sessionDate: Date }, correlationId: string) {
    super(aggregateId, tenantId, 'CollectiveBargainingSessionCreated', payload, correlationId);
  }
  get eventName() { return 'CollectiveBargainingSessionCreated'; }
  get aggregateType() { return 'CollectiveBargainingSession'; }
}

export class CollectiveBargainingSessionInProgress extends DomainEvent {
  constructor(aggregateId: Uuid, tenantId: Uuid, public readonly payload: Record<string, unknown>, correlationId: string) {
    super(aggregateId, tenantId, 'CollectiveBargainingSessionInProgress', payload, correlationId);
  }
  get eventName() { return 'CollectiveBargainingSessionInProgress'; }
  get aggregateType() { return 'CollectiveBargainingSession'; }
}

export class CollectiveBargainingSessionTentativeAgreement extends DomainEvent {
  constructor(aggregateId: Uuid, tenantId: Uuid, public readonly payload: Record<string, unknown>, correlationId: string) {
    super(aggregateId, tenantId, 'CollectiveBargainingSessionTentativeAgreement', payload, correlationId);
  }
  get eventName() { return 'CollectiveBargainingSessionTentativeAgreement'; }
  get aggregateType() { return 'CollectiveBargainingSession'; }
}

export class CollectiveBargainingSessionRatified extends DomainEvent {
  constructor(aggregateId: Uuid, tenantId: Uuid, public readonly payload: Record<string, unknown>, correlationId: string) {
    super(aggregateId, tenantId, 'CollectiveBargainingSessionRatified', payload, correlationId);
  }
  get eventName() { return 'CollectiveBargainingSessionRatified'; }
  get aggregateType() { return 'CollectiveBargainingSession'; }
}

export class CollectiveBargainingSessionFailed extends DomainEvent {
  constructor(aggregateId: Uuid, tenantId: Uuid, public readonly payload: Record<string, unknown>, correlationId: string) {
    super(aggregateId, tenantId, 'CollectiveBargainingSessionFailed', payload, correlationId);
  }
  get eventName() { return 'CollectiveBargainingSessionFailed'; }
  get aggregateType() { return 'CollectiveBargainingSession'; }
}

export class CollectiveBargainingSessionClosed extends DomainEvent {
  constructor(aggregateId: Uuid, tenantId: Uuid, public readonly payload: Record<string, unknown>, correlationId: string) {
    super(aggregateId, tenantId, 'CollectiveBargainingSessionClosed', payload, correlationId);
  }
  get eventName() { return 'CollectiveBargainingSessionClosed'; }
  get aggregateType() { return 'CollectiveBargainingSession'; }
}

export class CollectiveBargainingSession extends AggregateRoot {
  id!: Uuid;
  tenantId!: Uuid;
  unionRecognitionId!: Uuid;
  sessionDate!: Date;
  status: 'SCHEDULED' | 'IN_PROGRESS' | 'TENTATIVE_AGREEMENT' | 'RATIFIED' | 'FAILED' | 'CLOSED' = 'SCHEDULED';
  location?: string;
  agenda?: string;
  minutes?: string;
  createdAt = new Date();
  updatedAt = new Date();

  static create(props: { id: Uuid; tenantId: Uuid; unionRecognitionId: Uuid; sessionDate: Date; location?: string; agenda?: string; minutes?: string }, correlationId: string): CollectiveBargainingSession {
    const ar = new CollectiveBargainingSession();
    ar.id = props.id;
    ar.tenantId = props.tenantId;
    ar.unionRecognitionId = props.unionRecognitionId;
    ar.sessionDate = props.sessionDate;
    ar.location = props.location;
    ar.agenda = props.agenda;
    ar.minutes = props.minutes;
    ar.status = 'SCHEDULED';
    ar.addDomainEvent(new CollectiveBargainingSessionCreated(ar.id, ar.tenantId, { unionRecognitionId: ar.unionRecognitionId, sessionDate: ar.sessionDate }, correlationId));
    ar.incrementVersion();
    return ar;
  }

  start(correlationId: string) {
    if (this.status !== 'SCHEDULED') throw new ValidationError('CollectiveBargainingSession', 'start', 'Must be SCHEDULED');
    this.status = 'IN_PROGRESS';
    this.updatedAt = new Date();
    this.addDomainEvent(new CollectiveBargainingSessionInProgress(this.id, this.tenantId, {}, correlationId));
    this.incrementVersion();
  }

  recordTentativeAgreement(correlationId: string) {
    if (this.status !== 'IN_PROGRESS') throw new ValidationError('CollectiveBargainingSession', 'recordTentativeAgreement', 'Must be IN_PROGRESS');
    this.status = 'TENTATIVE_AGREEMENT';
    this.updatedAt = new Date();
    this.addDomainEvent(new CollectiveBargainingSessionTentativeAgreement(this.id, this.tenantId, {}, correlationId));
    this.incrementVersion();
  }

  ratify(correlationId: string) {
    if (this.status !== 'TENTATIVE_AGREEMENT') throw new ValidationError('CollectiveBargainingSession', 'ratify', 'Must be TENTATIVE_AGREEMENT');
    this.status = 'RATIFIED';
    this.updatedAt = new Date();
    this.addDomainEvent(new CollectiveBargainingSessionRatified(this.id, this.tenantId, {}, correlationId));
    this.incrementVersion();
  }

  markFailed(correlationId: string) {
    if (this.status !== 'IN_PROGRESS') throw new ValidationError('CollectiveBargainingSession', 'markFailed', 'Must be IN_PROGRESS');
    this.status = 'FAILED';
    this.updatedAt = new Date();
    this.addDomainEvent(new CollectiveBargainingSessionFailed(this.id, this.tenantId, {}, correlationId));
    this.incrementVersion();
  }

  close(correlationId: string) {
    if (!['RATIFIED', 'FAILED'].includes(this.status)) throw new ValidationError('CollectiveBargainingSession', 'close', 'Must be RATIFIED or FAILED');
    this.status = 'CLOSED';
    this.updatedAt = new Date();
    this.addDomainEvent(new CollectiveBargainingSessionClosed(this.id, this.tenantId, {}, correlationId));
    this.incrementVersion();
  }
}
''')

print("UL aggregates done")

# ========================================================================
# UNION & LABOR - Repositories
# ========================================================================

write(BASE/"union-labor/repositories/union-recognition.repository.ts", '''import { Injectable } from '@nestjs/common';
import { BaseRepository } from '@hcm/database';
import { UnionRecognition } from '../aggregates/union-recognition.aggregate.js';
import { Uuid } from '@hcm/shared-kernel';

@Injectable()
export class UnionRecognitionRepository extends BaseRepository<UnionRecognition> {
  protected tableName = 'union_recognitions';

  async findById(id: Uuid): Promise<UnionRecognition | undefined> {
    const row = await this.db.selectFrom(this.tableName).selectAll().where('id', '=', id.value).executeTakeFirst();
    return row ? this.toAggregate(row) : undefined;
  }

  async findByTenant(tenantId: Uuid): Promise<UnionRecognition[]> {
    const rows = await this.db.selectFrom(this.tableName).selectAll().where('tenant_id', '=', tenantId.value).execute();
    return rows.map((r) => this.toAggregate(r));
  }

  async save(entity: UnionRecognition): Promise<void> {
    const row = this.toRow(entity);
    await this.db.insertInto(this.tableName).values(row).onConflict((oc) => oc.columns(['id']).doUpdateSet(row)).execute();
  }

  protected toAggregate(row: Record<string, unknown>): UnionRecognition {
    const ar = new UnionRecognition();
    ar.id = new Uuid(row['id'] as string);
    ar.tenantId = new Uuid(row['tenant_id'] as string);
    ar.unionName = row['union_name'] as string;
    ar.bargainingUnitId = new Uuid(row['bargaining_unit_id'] as string);
    ar.status = row['status'] as UnionRecognition['status'];
    ar.effectiveDate = row['effective_date'] ? new Date(row['effective_date'] as string) : undefined;
    ar.expirationDate = row['expiration_date'] ? new Date(row['expiration_date'] as string) : undefined;
    ar.agreementDocument = row['agreement_document'] as string | undefined;
    ar.createdAt = new Date(row['created_at'] as string);
    ar.updatedAt = new Date(row['updated_at'] as string);
    ar['_aggregateVersion'] = (row['aggregate_version'] as number) ?? 0;
    return ar;
  }

  protected toRow(entity: UnionRecognition): Record<string, unknown> {
    return {
      id: entity.id.value,
      tenant_id: entity.tenantId.value,
      union_name: entity.unionName,
      bargaining_unit_id: entity.bargainingUnitId.value,
      status: entity.status,
      effective_date: entity.effectiveDate,
      expiration_date: entity.expirationDate,
      agreement_document: entity.agreementDocument,
      created_at: entity.createdAt,
      updated_at: entity.updatedAt,
      aggregate_version: entity.aggregateVersion,
    };
  }
}
''')

write(BASE/"union-labor/repositories/grievance.repository.ts", '''import { Injectable } from '@nestjs/common';
import { BaseRepository } from '@hcm/database';
import { Grievance } from '../aggregates/grievance.aggregate.js';
import { Uuid } from '@hcm/shared-kernel';

@Injectable()
export class GrievanceRepository extends BaseRepository<Grievance> {
  protected tableName = 'grievances';

  async findById(id: Uuid): Promise<Grievance | undefined> {
    const row = await this.db.selectFrom(this.tableName).selectAll().where('id', '=', id.value).executeTakeFirst();
    return row ? this.toAggregate(row) : undefined;
  }

  async findByTenant(tenantId: Uuid): Promise<Grievance[]> {
    const rows = await this.db.selectFrom(this.tableName).selectAll().where('tenant_id', '=', tenantId.value).execute();
    return rows.map((r) => this.toAggregate(r));
  }

  async findByWorker(workerId: Uuid): Promise<Grievance[]> {
    const rows = await this.db.selectFrom(this.tableName).selectAll().where('worker_id', '=', workerId.value).execute();
    return rows.map((r) => this.toAggregate(r));
  }

  async save(entity: Grievance): Promise<void> {
    const row = this.toRow(entity);
    await this.db.insertInto(this.tableName).values(row).onConflict((oc) => oc.columns(['id']).doUpdateSet(row)).execute();
  }

  protected toAggregate(row: Record<string, unknown>): Grievance {
    const ar = new Grievance();
    ar.id = new Uuid(row['id'] as string);
    ar.tenantId = new Uuid(row['tenant_id'] as string);
    ar.workerId = new Uuid(row['worker_id'] as string);
    ar.grievanceType = row['grievance_type'] as string;
    ar.description = row['description'] as string;
    ar.status = row['status'] as Grievance['status'];
    ar.resolution = row['resolution'] as string | undefined;
    ar.arbitratorDecision = row['arbitrator_decision'] as string | undefined;
    ar.createdAt = new Date(row['created_at'] as string);
    ar.updatedAt = new Date(row['updated_at'] as string);
    ar['_aggregateVersion'] = (row['aggregate_version'] as number) ?? 0;
    return ar;
  }

  protected toRow(entity: Grievance): Record<string, unknown> {
    return {
      id: entity.id.value,
      tenant_id: entity.tenantId.value,
      worker_id: entity.workerId.value,
      grievance_type: entity.grievanceType,
      description: entity.description,
      status: entity.status,
      resolution: entity.resolution,
      arbitrator_decision: entity.arbitratorDecision,
      created_at: entity.createdAt,
      updated_at: entity.updatedAt,
      aggregate_version: entity.aggregateVersion,
    };
  }
}
''')

write(BASE/"union-labor/repositories/collective-bargaining-session.repository.ts", '''import { Injectable } from '@nestjs/common';
import { BaseRepository } from '@hcm/database';
import { CollectiveBargainingSession } from '../aggregates/collective-bargaining-session.aggregate.js';
import { Uuid } from '@hcm/shared-kernel';

@Injectable()
export class CollectiveBargainingSessionRepository extends BaseRepository<CollectiveBargainingSession> {
  protected tableName = 'collective_bargaining_sessions';

  async findById(id: Uuid): Promise<CollectiveBargainingSession | undefined> {
    const row = await this.db.selectFrom(this.tableName).selectAll().where('id', '=', id.value).executeTakeFirst();
    return row ? this.toAggregate(row) : undefined;
  }

  async findByTenant(tenantId: Uuid): Promise<CollectiveBargainingSession[]> {
    const rows = await this.db.selectFrom(this.tableName).selectAll().where('tenant_id', '=', tenantId.value).execute();
    return rows.map((r) => this.toAggregate(r));
  }

  async findByUnionRecognition(unionRecognitionId: Uuid): Promise<CollectiveBargainingSession[]> {
    const rows = await this.db.selectFrom(this.tableName).selectAll().where('union_recognition_id', '=', unionRecognitionId.value).execute();
    return rows.map((r) => this.toAggregate(r));
  }

  async save(entity: CollectiveBargainingSession): Promise<void> {
    const row = this.toRow(entity);
    await this.db.insertInto(this.tableName).values(row).onConflict((oc) => oc.columns(['id']).doUpdateSet(row)).execute();
  }

  protected toAggregate(row: Record<string, unknown>): CollectiveBargainingSession {
    const ar = new CollectiveBargainingSession();
    ar.id = new Uuid(row['id'] as string);
    ar.tenantId = new Uuid(row['tenant_id'] as string);
    ar.unionRecognitionId = new Uuid(row['union_recognition_id'] as string);
    ar.sessionDate = new Date(row['session_date'] as string);
    ar.status = row['status'] as CollectiveBargainingSession['status'];
    ar.location = row['location'] as string | undefined;
    ar.agenda = row['agenda'] as string | undefined;
    ar.minutes = row['minutes'] as string | undefined;
    ar.createdAt = new Date(row['created_at'] as string);
    ar.updatedAt = new Date(row['updated_at'] as string);
    ar['_aggregateVersion'] = (row['aggregate_version'] as number) ?? 0;
    return ar;
  }

  protected toRow(entity: CollectiveBargainingSession): Record<string, unknown> {
    return {
      id: entity.id.value,
      tenant_id: entity.tenantId.value,
      union_recognition_id: entity.unionRecognitionId.value,
      session_date: entity.sessionDate,
      status: entity.status,
      location: entity.location,
      agenda: entity.agenda,
      minutes: entity.minutes,
      created_at: entity.createdAt,
      updated_at: entity.updatedAt,
      aggregate_version: entity.aggregateVersion,
    };
  }
}
''')

# ========================================================================
# UNION & LABOR - FSMs
# ========================================================================

write(BASE/"union-labor/fsm/union-recognition.fsm.ts", '''import type { FsmFramework } from '../../../platform/workflow/fsm-framework.js';
import type { FsmDefinition } from '../../../platform/workflow/fsm-framework.js';

export function registerUnionRecognitionFsm(fsm: FsmFramework): void {
  const definition: FsmDefinition<string, string> = {
    aggregateType: 'UnionRecognition',
    states: ['RECOGNIZED', 'NEGOTIATING', 'RATIFIED', 'ACTIVE', 'EXPIRED', 'RENEWED'],
    actions: ['CreateUnionRecognition', 'NegotiateUnionRecognition', 'RatifyUnionRecognition', 'ActivateUnionRecognition', 'ExpireUnionRecognition', 'RenewUnionRecognition'],
    transitions: [
      { action: 'CreateUnionRecognition', from: '', to: 'RECOGNIZED', eventName: 'UnionRecognitionCreated' },
      { action: 'NegotiateUnionRecognition', from: 'RECOGNIZED', to: 'NEGOTIATING', eventName: 'UnionRecognitionNegotiating' },
      { action: 'RatifyUnionRecognition', from: 'NEGOTIATING', to: 'RATIFIED', eventName: 'UnionRecognitionRatified' },
      { action: 'ActivateUnionRecognition', from: 'RATIFIED', to: 'ACTIVE', eventName: 'UnionRecognitionActive' },
      { action: 'ExpireUnionRecognition', from: 'ACTIVE', to: 'EXPIRED', eventName: 'UnionRecognitionExpired' },
      { action: 'ExpireUnionRecognition', from: 'RATIFIED', to: 'EXPIRED', eventName: 'UnionRecognitionExpired' },
      { action: 'RenewUnionRecognition', from: 'EXPIRED', to: 'RENEWED', eventName: 'UnionRecognitionRenewed' },
    ],
    initialState: 'RECOGNIZED',
    terminalStates: ['RENEWED'],
  };
  fsm.register(definition);
}
''')

write(BASE/"union-labor/fsm/grievance.fsm.ts", '''import type { FsmFramework } from '../../../platform/workflow/fsm-framework.js';
import type { FsmDefinition } from '../../../platform/workflow/fsm-framework.js';

export function registerGrievanceFsm(fsm: FsmFramework): void {
  const definition: FsmDefinition<string, string> = {
    aggregateType: 'Grievance',
    states: ['FILED', 'ACKNOWLEDGED', 'UNDER_INVESTIGATION', 'RESOLVED', 'ARBITRATED', 'WITHDRAWN'],
    actions: ['CreateGrievance', 'AcknowledgeGrievance', 'StartInvestigationGrievance', 'ResolveGrievance', 'ArbitrateGrievance', 'WithdrawGrievance'],
    transitions: [
      { action: 'CreateGrievance', from: '', to: 'FILED', eventName: 'GrievanceFiled' },
      { action: 'AcknowledgeGrievance', from: 'FILED', to: 'ACKNOWLEDGED', eventName: 'GrievanceAcknowledged' },
      { action: 'StartInvestigationGrievance', from: 'ACKNOWLEDGED', to: 'UNDER_INVESTIGATION', eventName: 'GrievanceUnderInvestigation' },
      { action: 'ResolveGrievance', from: 'UNDER_INVESTIGATION', to: 'RESOLVED', eventName: 'GrievanceResolved' },
      { action: 'ArbitrateGrievance', from: 'UNDER_INVESTIGATION', to: 'ARBITRATED', eventName: 'GrievanceArbitrated' },
      { action: 'WithdrawGrievance', from: 'FILED', to: 'WITHDRAWN', eventName: 'GrievanceWithdrawn' },
      { action: 'WithdrawGrievance', from: 'ACKNOWLEDGED', to: 'WITHDRAWN', eventName: 'GrievanceWithdrawn' },
      { action: 'WithdrawGrievance', from: 'UNDER_INVESTIGATION', to: 'WITHDRAWN', eventName: 'GrievanceWithdrawn' },
    ],
    initialState: 'FILED',
    terminalStates: ['RESOLVED', 'ARBITRATED', 'WITHDRAWN'],
  };
  fsm.register(definition);
}
''')

write(BASE/"union-labor/fsm/collective-bargaining-session.fsm.ts", '''import type { FsmFramework } from '../../../platform/workflow/fsm-framework.js';
import type { FsmDefinition } from '../../../platform/workflow/fsm-framework.js';

export function registerCollectiveBargainingSessionFsm(fsm: FsmFramework): void {
  const definition: FsmDefinition<string, string> = {
    aggregateType: 'CollectiveBargainingSession',
    states: ['SCHEDULED', 'IN_PROGRESS', 'TENTATIVE_AGREEMENT', 'RATIFIED', 'FAILED', 'CLOSED'],
    actions: ['CreateCollectiveBargainingSession', 'StartCollectiveBargainingSession', 'RecordTentativeAgreementCollectiveBargainingSession', 'RatifyCollectiveBargainingSession', 'MarkFailedCollectiveBargainingSession', 'CloseCollectiveBargainingSession'],
    transitions: [
      { action: 'CreateCollectiveBargainingSession', from: '', to: 'SCHEDULED', eventName: 'CollectiveBargainingSessionCreated' },
      { action: 'StartCollectiveBargainingSession', from: 'SCHEDULED', to: 'IN_PROGRESS', eventName: 'CollectiveBargainingSessionInProgress' },
      { action: 'RecordTentativeAgreementCollectiveBargainingSession', from: 'IN_PROGRESS', to: 'TENTATIVE_AGREEMENT', eventName: 'CollectiveBargainingSessionTentativeAgreement' },
      { action: 'RatifyCollectiveBargainingSession', from: 'TENTATIVE_AGREEMENT', to: 'RATIFIED', eventName: 'CollectiveBargainingSessionRatified' },
      { action: 'MarkFailedCollectiveBargainingSession', from: 'IN_PROGRESS', to: 'FAILED', eventName: 'CollectiveBargainingSessionFailed' },
      { action: 'CloseCollectiveBargainingSession', from: 'RATIFIED', to: 'CLOSED', eventName: 'CollectiveBargainingSessionClosed' },
      { action: 'CloseCollectiveBargainingSession', from: 'FAILED', to: 'CLOSED', eventName: 'CollectiveBargainingSessionClosed' },
    ],
    initialState: 'SCHEDULED',
    terminalStates: ['CLOSED'],
  };
  fsm.register(definition);
}
''')

print("UL repos/fsms done")

# ========================================================================
# UNION & LABOR - Command Handlers
# ========================================================================

write(BASE/"union-labor/commands/create-union-recognition.handler.ts", '''import { Injectable } from '@nestjs/common';
import { CommandHandler } from '../../../platform/command-bus/command-handler.decorator.js';
import type { HrCommandEnvelope, CommandResult } from '@hcm/command-contracts';
import { Uuid } from '@hcm/shared-kernel';
import { FsmFramework } from '../../../platform/workflow/fsm-framework.js';
import { UnionRecognition } from '../aggregates/union-recognition.aggregate.js';
import { UnionRecognitionRepository } from '../repositories/union-recognition.repository.js';
import { UnionLaborEventsPublisher } from '../events/union-labor-events.publisher.js';

@CommandHandler('CreateUnionRecognition')
@Injectable()
export class CreateUnionRecognitionHandler {
  constructor(
    private readonly repo: UnionRecognitionRepository,
    private readonly fsm: FsmFramework,
    private readonly publisher: UnionLaborEventsPublisher,
  ) {}

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>> {
    const payload = command.payload as { unionName: string; bargainingUnitId: Uuid; effectiveDate?: Date; expirationDate?: Date; agreementDocument?: string };
    const ar = UnionRecognition.create({ id: Uuid.generate(), tenantId: command.tenantId, ...payload }, command.correlationId);
    await this.repo.save(ar);
    await this.publisher.publishFromAggregate(ar);
    return {
      success: true,
      data: { unionRecognitionId: ar.id.value, status: ar.status },
      commandId: command.commandId,
      correlationId: command.correlationId,
      aggregateId: ar.id,
      newState: ar.status,
      newVersion: ar.aggregateVersion,
      allowedNextActions: this.fsm.getAllowedActionsFromState(ar.status, 'UnionRecognition'),
      eventsEmitted: ar.domainEvents.map((e) => e.eventName),
      auditRecordId: command.commandId,
    } as CommandResult<unknown>;
  }
}
''')

write(BASE/"union-labor/commands/negotiate-union-recognition.handler.ts", '''import { Injectable } from '@nestjs/common';
import { CommandHandler } from '../../../platform/command-bus/command-handler.decorator.js';
import type { HrCommandEnvelope, CommandResult } from '@hcm/command-contracts';
import { Uuid } from '@hcm/shared-kernel';
import { FsmFramework } from '../../../platform/workflow/fsm-framework.js';
import { UnionRecognitionRepository } from '../repositories/union-recognition.repository.js';
import { UnionLaborEventsPublisher } from '../events/union-labor-events.publisher.js';

@CommandHandler('NegotiateUnionRecognition')
@Injectable()
export class NegotiateUnionRecognitionHandler {
  constructor(
    private readonly repo: UnionRecognitionRepository,
    private readonly fsm: FsmFramework,
    private readonly publisher: UnionLaborEventsPublisher,
  ) {}

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>> {
    const payload = command.payload as { unionRecognitionId: Uuid };
    const ar = await this.repo.findById(payload.unionRecognitionId);
    if (!ar) throw new Error('Union recognition not found');
    ar.negotiate(command.correlationId);
    await this.repo.save(ar);
    await this.publisher.publishFromAggregate(ar);
    return {
      success: true,
      data: { unionRecognitionId: ar.id.value, status: ar.status },
      commandId: command.commandId,
      correlationId: command.correlationId,
      aggregateId: ar.id,
      newState: ar.status,
      newVersion: ar.aggregateVersion,
      allowedNextActions: this.fsm.getAllowedActionsFromState(ar.status, 'UnionRecognition'),
      eventsEmitted: ar.domainEvents.map((e) => e.eventName),
      auditRecordId: command.commandId,
    } as CommandResult<unknown>;
  }
}
''')

write(BASE/"union-labor/commands/ratify-union-recognition.handler.ts", '''import { Injectable } from '@nestjs/common';
import { CommandHandler } from '../../../platform/command-bus/command-handler.decorator.js';
import type { HrCommandEnvelope, CommandResult } from '@hcm/command-contracts';
import { Uuid } from '@hcm/shared-kernel';
import { FsmFramework } from '../../../platform/workflow/fsm-framework.js';
import { UnionRecognitionRepository } from '../repositories/union-recognition.repository.js';
import { UnionLaborEventsPublisher } from '../events/union-labor-events.publisher.js';

@CommandHandler('RatifyUnionRecognition')
@Injectable()
export class RatifyUnionRecognitionHandler {
  constructor(
    private readonly repo: UnionRecognitionRepository,
    private readonly fsm: FsmFramework,
    private readonly publisher: UnionLaborEventsPublisher,
  ) {}

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>> {
    const payload = command.payload as { unionRecognitionId: Uuid };
    const ar = await this.repo.findById(payload.unionRecognitionId);
    if (!ar) throw new Error('Union recognition not found');
    ar.ratify(command.correlationId);
    await this.repo.save(ar);
    await this.publisher.publishFromAggregate(ar);
    return {
      success: true,
      data: { unionRecognitionId: ar.id.value, status: ar.status },
      commandId: command.commandId,
      correlationId: command.correlationId,
      aggregateId: ar.id,
      newState: ar.status,
      newVersion: ar.aggregateVersion,
      allowedNextActions: this.fsm.getAllowedActionsFromState(ar.status, 'UnionRecognition'),
      eventsEmitted: ar.domainEvents.map((e) => e.eventName),
      auditRecordId: command.commandId,
    } as CommandResult<unknown>;
  }
}
''')

write(BASE/"union-labor/commands/activate-union-recognition.handler.ts", '''import { Injectable } from '@nestjs/common';
import { CommandHandler } from '../../../platform/command-bus/command-handler.decorator.js';
import type { HrCommandEnvelope, CommandResult } from '@hcm/command-contracts';
import { Uuid } from '@hcm/shared-kernel';
import { FsmFramework } from '../../../platform/workflow/fsm-framework.js';
import { UnionRecognitionRepository } from '../repositories/union-recognition.repository.js';
import { UnionLaborEventsPublisher } from '../events/union-labor-events.publisher.js';

@CommandHandler('ActivateUnionRecognition')
@Injectable()
export class ActivateUnionRecognitionHandler {
  constructor(
    private readonly repo: UnionRecognitionRepository,
    private readonly fsm: FsmFramework,
    private readonly publisher: UnionLaborEventsPublisher,
  ) {}

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>> {
    const payload = command.payload as { unionRecognitionId: Uuid };
    const ar = await this.repo.findById(payload.unionRecognitionId);
    if (!ar) throw new Error('Union recognition not found');
    ar.activate(command.correlationId);
    await this.repo.save(ar);
    await this.publisher.publishFromAggregate(ar);
    return {
      success: true,
      data: { unionRecognitionId: ar.id.value, status: ar.status },
      commandId: command.commandId,
      correlationId: command.correlationId,
      aggregateId: ar.id,
      newState: ar.status,
      newVersion: ar.aggregateVersion,
      allowedNextActions: this.fsm.getAllowedActionsFromState(ar.status, 'UnionRecognition'),
      eventsEmitted: ar.domainEvents.map((e) => e.eventName),
      auditRecordId: command.commandId,
    } as CommandResult<unknown>;
  }
}
''')

write(BASE/"union-labor/commands/expire-union-recognition.handler.ts", '''import { Injectable } from '@nestjs/common';
import { CommandHandler } from '../../../platform/command-bus/command-handler.decorator.js';
import type { HrCommandEnvelope, CommandResult } from '@hcm/command-contracts';
import { Uuid } from '@hcm/shared-kernel';
import { FsmFramework } from '../../../platform/workflow/fsm-framework.js';
import { UnionRecognitionRepository } from '../repositories/union-recognition.repository.js';
import { UnionLaborEventsPublisher } from '../events/union-labor-events.publisher.js';

@CommandHandler('ExpireUnionRecognition')
@Injectable()
export class ExpireUnionRecognitionHandler {
  constructor(
    private readonly repo: UnionRecognitionRepository,
    private readonly fsm: FsmFramework,
    private readonly publisher: UnionLaborEventsPublisher,
  ) {}

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>> {
    const payload = command.payload as { unionRecognitionId: Uuid };
    const ar = await this.repo.findById(payload.unionRecognitionId);
    if (!ar) throw new Error('Union recognition not found');
    ar.expire(command.correlationId);
    await this.repo.save(ar);
    await this.publisher.publishFromAggregate(ar);
    return {
      success: true,
      data: { unionRecognitionId: ar.id.value, status: ar.status },
      commandId: command.commandId,
      correlationId: command.correlationId,
      aggregateId: ar.id,
      newState: ar.status,
      newVersion: ar.aggregateVersion,
      allowedNextActions: this.fsm.getAllowedActionsFromState(ar.status, 'UnionRecognition'),
      eventsEmitted: ar.domainEvents.map((e) => e.eventName),
      auditRecordId: command.commandId,
    } as CommandResult<unknown>;
  }
}
''')

write(BASE/"union-labor/commands/renew-union-recognition.handler.ts", '''import { Injectable } from '@nestjs/common';
import { CommandHandler } from '../../../platform/command-bus/command-handler.decorator.js';
import type { HrCommandEnvelope, CommandResult } from '@hcm/command-contracts';
import { Uuid } from '@hcm/shared-kernel';
import { FsmFramework } from '../../../platform/workflow/fsm-framework.js';
import { UnionRecognitionRepository } from '../repositories/union-recognition.repository.js';
import { UnionLaborEventsPublisher } from '../events/union-labor-events.publisher.js';

@CommandHandler('RenewUnionRecognition')
@Injectable()
export class RenewUnionRecognitionHandler {
  constructor(
    private readonly repo: UnionRecognitionRepository,
    private readonly fsm: FsmFramework,
    private readonly publisher: UnionLaborEventsPublisher,
  ) {}

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>> {
    const payload = command.payload as { unionRecognitionId: Uuid };
    const ar = await this.repo.findById(payload.unionRecognitionId);
    if (!ar) throw new Error('Union recognition not found');
    ar.renew(command.correlationId);
    await this.repo.save(ar);
    await this.publisher.publishFromAggregate(ar);
    return {
      success: true,
      data: { unionRecognitionId: ar.id.value, status: ar.status },
      commandId: command.commandId,
      correlationId: command.correlationId,
      aggregateId: ar.id,
      newState: ar.status,
      newVersion: ar.aggregateVersion,
      allowedNextActions: this.fsm.getAllowedActionsFromState(ar.status, 'UnionRecognition'),
      eventsEmitted: ar.domainEvents.map((e) => e.eventName),
      auditRecordId: command.commandId,
    } as CommandResult<unknown>;
  }
}
''')

write(BASE/"union-labor/commands/create-grievance.handler.ts", '''import { Injectable } from '@nestjs/common';
import { CommandHandler } from '../../../platform/command-bus/command-handler.decorator.js';
import type { HrCommandEnvelope, CommandResult } from '@hcm/command-contracts';
import { Uuid } from '@hcm/shared-kernel';
import { FsmFramework } from '../../../platform/workflow/fsm-framework.js';
import { Grievance } from '../aggregates/grievance.aggregate.js';
import { GrievanceRepository } from '../repositories/grievance.repository.js';
import { UnionLaborEventsPublisher } from '../events/union-labor-events.publisher.js';

@CommandHandler('CreateGrievance')
@Injectable()
export class CreateGrievanceHandler {
  constructor(
    private readonly repo: GrievanceRepository,
    private readonly fsm: FsmFramework,
    private readonly publisher: UnionLaborEventsPublisher,
  ) {}

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>> {
    const payload = command.payload as { workerId: Uuid; grievanceType: string; description: string; resolution?: string; arbitratorDecision?: string };
    const ar = Grievance.create({ id: Uuid.generate(), tenantId: command.tenantId, ...payload }, command.correlationId);
    await this.repo.save(ar);
    await this.publisher.publishFromAggregate(ar);
    return {
      success: true,
      data: { grievanceId: ar.id.value, status: ar.status },
      commandId: command.commandId,
      correlationId: command.correlationId,
      aggregateId: ar.id,
      newState: ar.status,
      newVersion: ar.aggregateVersion,
      allowedNextActions: this.fsm.getAllowedActionsFromState(ar.status, 'Grievance'),
      eventsEmitted: ar.domainEvents.map((e) => e.eventName),
      auditRecordId: command.commandId,
    } as CommandResult<unknown>;
  }
}
''')

write(BASE/"union-labor/commands/acknowledge-grievance.handler.ts", '''import { Injectable } from '@nestjs/common';
import { CommandHandler } from '../../../platform/command-bus/command-handler.decorator.js';
import type { HrCommandEnvelope, CommandResult } from '@hcm/command-contracts';
import { Uuid } from '@hcm/shared-kernel';
import { FsmFramework } from '../../../platform/workflow/fsm-framework.js';
import { GrievanceRepository } from '../repositories/grievance.repository.js';
import { UnionLaborEventsPublisher } from '../events/union-labor-events.publisher.js';

@CommandHandler('AcknowledgeGrievance')
@Injectable()
export class AcknowledgeGrievanceHandler {
  constructor(
    private readonly repo: GrievanceRepository,
    private readonly fsm: FsmFramework,
    private readonly publisher: UnionLaborEventsPublisher,
  ) {}

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>> {
    const payload = command.payload as { grievanceId: Uuid };
    const ar = await this.repo.findById(payload.grievanceId);
    if (!ar) throw new Error('Grievance not found');
    ar.acknowledge(command.correlationId);
    await this.repo.save(ar);
    await this.publisher.publishFromAggregate(ar);
    return {
      success: true,
      data: { grievanceId: ar.id.value, status: ar.status },
      commandId: command.commandId,
      correlationId: command.correlationId,
      aggregateId: ar.id,
      newState: ar.status,
      newVersion: ar.aggregateVersion,
      allowedNextActions: this.fsm.getAllowedActionsFromState(ar.status, 'Grievance'),
      eventsEmitted: ar.domainEvents.map((e) => e.eventName),
      auditRecordId: command.commandId,
    } as CommandResult<unknown>;
  }
}
''')

write(BASE/"union-labor/commands/start-investigation-grievance.handler.ts", '''import { Injectable } from '@nestjs/common';
import { CommandHandler } from '../../../platform/command-bus/command-handler.decorator.js';
import type { HrCommandEnvelope, CommandResult } from '@hcm/command-contracts';
import { Uuid } from '@hcm/shared-kernel';
import { FsmFramework } from '../../../platform/workflow/fsm-framework.js';
import { GrievanceRepository } from '../repositories/grievance.repository.js';
import { UnionLaborEventsPublisher } from '../events/union-labor-events.publisher.js';

@CommandHandler('StartInvestigationGrievance')
@Injectable()
export class StartInvestigationGrievanceHandler {
  constructor(
    private readonly repo: GrievanceRepository,
    private readonly fsm: FsmFramework,
    private readonly publisher: UnionLaborEventsPublisher,
  ) {}

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>> {
    const payload = command.payload as { grievanceId: Uuid };
    const ar = await this.repo.findById(payload.grievanceId);
    if (!ar) throw new Error('Grievance not found');
    ar.startInvestigation(command.correlationId);
    await this.repo.save(ar);
    await this.publisher.publishFromAggregate(ar);
    return {
      success: true,
      data: { grievanceId: ar.id.value, status: ar.status },
      commandId: command.commandId,
      correlationId: command.correlationId,
      aggregateId: ar.id,
      newState: ar.status,
      newVersion: ar.aggregateVersion,
      allowedNextActions: this.fsm.getAllowedActionsFromState(ar.status, 'Grievance'),
      eventsEmitted: ar.domainEvents.map((e) => e.eventName),
      auditRecordId: command.commandId,
    } as CommandResult<unknown>;
  }
}
''')

write(BASE/"union-labor/commands/resolve-grievance.handler.ts", '''import { Injectable } from '@nestjs/common';
import { CommandHandler } from '../../../platform/command-bus/command-handler.decorator.js';
import type { HrCommandEnvelope, CommandResult } from '@hcm/command-contracts';
import { Uuid } from '@hcm/shared-kernel';
import { FsmFramework } from '../../../platform/workflow/fsm-framework.js';
import { GrievanceRepository } from '../repositories/grievance.repository.js';
import { UnionLaborEventsPublisher } from '../events/union-labor-events.publisher.js';

@CommandHandler('ResolveGrievance')
@Injectable()
export class ResolveGrievanceHandler {
  constructor(
    private readonly repo: GrievanceRepository,
    private readonly fsm: FsmFramework,
    private readonly publisher: UnionLaborEventsPublisher,
  ) {}

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>> {
    const payload = command.payload as { grievanceId: Uuid };
    const ar = await this.repo.findById(payload.grievanceId);
    if (!ar) throw new Error('Grievance not found');
    ar.resolve(command.correlationId);
    await this.repo.save(ar);
    await this.publisher.publishFromAggregate(ar);
    return {
      success: true,
      data: { grievanceId: ar.id.value, status: ar.status },
      commandId: command.commandId,
      correlationId: command.correlationId,
      aggregateId: ar.id,
      newState: ar.status,
      newVersion: ar.aggregateVersion,
      allowedNextActions: this.fsm.getAllowedActionsFromState(ar.status, 'Grievance'),
      eventsEmitted: ar.domainEvents.map((e) => e.eventName),
      auditRecordId: command.commandId,
    } as CommandResult<unknown>;
  }
}
''')

write(BASE/"union-labor/commands/arbitrate-grievance.handler.ts", '''import { Injectable } from '@nestjs/common';
import { CommandHandler } from '../../../platform/command-bus/command-handler.decorator.js';
import type { HrCommandEnvelope, CommandResult } from '@hcm/command-contracts';
import { Uuid } from '@hcm/shared-kernel';
import { FsmFramework } from '../../../platform/workflow/fsm-framework.js';
import { GrievanceRepository } from '../repositories/grievance.repository.js';
import { UnionLaborEventsPublisher } from '../events/union-labor-events.publisher.js';

@CommandHandler('ArbitrateGrievance')
@Injectable()
export class ArbitrateGrievanceHandler {
  constructor(
    private readonly repo: GrievanceRepository,
    private readonly fsm: FsmFramework,
    private readonly publisher: UnionLaborEventsPublisher,
  ) {}

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>> {
    const payload = command.payload as { grievanceId: Uuid };
    const ar = await this.repo.findById(payload.grievanceId);
    if (!ar) throw new Error('Grievance not found');
    ar.arbitrate(command.correlationId);
    await this.repo.save(ar);
    await this.publisher.publishFromAggregate(ar);
    return {
      success: true,
      data: { grievanceId: ar.id.value, status: ar.status },
      commandId: command.commandId,
      correlationId: command.correlationId,
      aggregateId: ar.id,
      newState: ar.status,
      newVersion: ar.aggregateVersion,
      allowedNextActions: this.fsm.getAllowedActionsFromState(ar.status, 'Grievance'),
      eventsEmitted: ar.domainEvents.map((e) => e.eventName),
      auditRecordId: command.commandId,
    } as CommandResult<unknown>;
  }
}
''')

write(BASE/"union-labor/commands/withdraw-grievance.handler.ts", '''import { Injectable } from '@nestjs/common';
import { CommandHandler } from '../../../platform/command-bus/command-handler.decorator.js';
import type { HrCommandEnvelope, CommandResult } from '@hcm/command-contracts';
import { Uuid } from '@hcm/shared-kernel';
import { FsmFramework } from '../../../platform/workflow/fsm-framework.js';
import { GrievanceRepository } from '../repositories/grievance.repository.js';
import { UnionLaborEventsPublisher } from '../events/union-labor-events.publisher.js';

@CommandHandler('WithdrawGrievance')
@Injectable()
export class WithdrawGrievanceHandler {
  constructor(
    private readonly repo: GrievanceRepository,
    private readonly fsm: FsmFramework,
    private readonly publisher: UnionLaborEventsPublisher,
  ) {}

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>> {
    const payload = command.payload as { grievanceId: Uuid };
    const ar = await this.repo.findById(payload.grievanceId);
    if (!ar) throw new Error('Grievance not found');
    ar.withdraw(command.correlationId);
    await this.repo.save(ar);
    await this.publisher.publishFromAggregate(ar);
    return {
      success: true,
      data: { grievanceId: ar.id.value, status: ar.status },
      commandId: command.commandId,
      correlationId: command.correlationId,
      aggregateId: ar.id,
      newState: ar.status,
      newVersion: ar.aggregateVersion,
      allowedNextActions: this.fsm.getAllowedActionsFromState(ar.status, 'Grievance'),
      eventsEmitted: ar.domainEvents.map((e) => e.eventName),
      auditRecordId: command.commandId,
    } as CommandResult<unknown>;
  }
}
''')

write(BASE/"union-labor/commands/create-collective-bargaining-session.handler.ts", '''import { Injectable } from '@nestjs/common';
import { CommandHandler } from '../../../platform/command-bus/command-handler.decorator.js';
import type { HrCommandEnvelope, CommandResult } from '@hcm/command-contracts';
import { Uuid } from '@hcm/shared-kernel';
import { FsmFramework } from '../../../platform/workflow/fsm-framework.js';
import { CollectiveBargainingSession } from '../aggregates/collective-bargaining-session.aggregate.js';
import { CollectiveBargainingSessionRepository } from '../repositories/collective-bargaining-session.repository.js';
import { UnionLaborEventsPublisher } from '../events/union-labor-events.publisher.js';

@CommandHandler('CreateCollectiveBargainingSession')
@Injectable()
export class CreateCollectiveBargainingSessionHandler {
  constructor(
    private readonly repo: CollectiveBargainingSessionRepository,
    private readonly fsm: FsmFramework,
    private readonly publisher: UnionLaborEventsPublisher,
  ) {}

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>> {
    const payload = command.payload as { unionRecognitionId: Uuid; sessionDate: Date; location?: string; agenda?: string; minutes?: string };
    const ar = CollectiveBargainingSession.create({ id: Uuid.generate(), tenantId: command.tenantId, ...payload }, command.correlationId);
    await this.repo.save(ar);
    await this.publisher.publishFromAggregate(ar);
    return {
      success: true,
      data: { collectiveBargainingSessionId: ar.id.value, status: ar.status },
      commandId: command.commandId,
      correlationId: command.correlationId,
      aggregateId: ar.id,
      newState: ar.status,
      newVersion: ar.aggregateVersion,
      allowedNextActions: this.fsm.getAllowedActionsFromState(ar.status, 'CollectiveBargainingSession'),
      eventsEmitted: ar.domainEvents.map((e) => e.eventName),
      auditRecordId: command.commandId,
    } as CommandResult<unknown>;
  }
}
''')

write(BASE/"union-labor/commands/start-collective-bargaining-session.handler.ts", '''import { Injectable } from '@nestjs/common';
import { CommandHandler } from '../../../platform/command-bus/command-handler.decorator.js';
import type { HrCommandEnvelope, CommandResult } from '@hcm/command-contracts';
import { Uuid } from '@hcm/shared-kernel';
import { FsmFramework } from '../../../platform/workflow/fsm-framework.js';
import { CollectiveBargainingSessionRepository } from '../repositories/collective-bargaining-session.repository.js';
import { UnionLaborEventsPublisher } from '../events/union-labor-events.publisher.js';

@CommandHandler('StartCollectiveBargainingSession')
@Injectable()
export class StartCollectiveBargainingSessionHandler {
  constructor(
    private readonly repo: CollectiveBargainingSessionRepository,
    private readonly fsm: FsmFramework,
    private readonly publisher: UnionLaborEventsPublisher,
  ) {}

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>> {
    const payload = command.payload as { collectiveBargainingSessionId: Uuid };
    const ar = await this.repo.findById(payload.collectiveBargainingSessionId);
    if (!ar) throw new Error('Collective bargaining session not found');
    ar.start(command.correlationId);
    await this.repo.save(ar);
    await this.publisher.publishFromAggregate(ar);
    return {
      success: true,
      data: { collectiveBargainingSessionId: ar.id.value, status: ar.status },
      commandId: command.commandId,
      correlationId: command.correlationId,
      aggregateId: ar.id,
      newState: ar.status,
      newVersion: ar.aggregateVersion,
      allowedNextActions: this.fsm.getAllowedActionsFromState(ar.status, 'CollectiveBargainingSession'),
      eventsEmitted: ar.domainEvents.map((e) => e.eventName),
      auditRecordId: command.commandId,
    } as CommandResult<unknown>;
  }
}
''')

write(BASE/"union-labor/commands/record-tentative-agreement-collective-bargaining-session.handler.ts", '''import { Injectable } from '@nestjs/common';
import { CommandHandler } from '../../../platform/command-bus/command-handler.decorator.js';
import type { HrCommandEnvelope, CommandResult } from '@hcm/command-contracts';
import { Uuid } from '@hcm/shared-kernel';
import { FsmFramework } from '../../../platform/workflow/fsm-framework.js';
import { CollectiveBargainingSessionRepository } from '../repositories/collective-bargaining-session.repository.js';
import { UnionLaborEventsPublisher } from '../events/union-labor-events.publisher.js';

@CommandHandler('RecordTentativeAgreementCollectiveBargainingSession')
@Injectable()
export class RecordTentativeAgreementCollectiveBargainingSessionHandler {
  constructor(
    private readonly repo: CollectiveBargainingSessionRepository,
    private readonly fsm: FsmFramework,
    private readonly publisher: UnionLaborEventsPublisher,
  ) {}

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>> {
    const payload = command.payload as { collectiveBargainingSessionId: Uuid };
    const ar = await this.repo.findById(payload.collectiveBargainingSessionId);
    if (!ar) throw new Error('Collective bargaining session not found');
    ar.recordTentativeAgreement(command.correlationId);
    await this.repo.save(ar);
    await this.publisher.publishFromAggregate(ar);
    return {
      success: true,
      data: { collectiveBargainingSessionId: ar.id.value, status: ar.status },
      commandId: command.commandId,
      correlationId: command.correlationId,
      aggregateId: ar.id,
      newState: ar.status,
      newVersion: ar.aggregateVersion,
      allowedNextActions: this.fsm.getAllowedActionsFromState(ar.status, 'CollectiveBargainingSession'),
      eventsEmitted: ar.domainEvents.map((e) => e.eventName),
      auditRecordId: command.commandId,
    } as CommandResult<unknown>;
  }
}
''')

write(BASE/"union-labor/commands/ratify-collective-bargaining-session.handler.ts", '''import { Injectable } from '@nestjs/common';
import { CommandHandler } from '../../../platform/command-bus/command-handler.decorator.js';
import type { HrCommandEnvelope, CommandResult } from '@hcm/command-contracts';
import { Uuid } from '@hcm/shared-kernel';
import { FsmFramework } from '../../../platform/workflow/fsm-framework.js';
import { CollectiveBargainingSessionRepository } from '../repositories/collective-bargaining-session.repository.js';
import { UnionLaborEventsPublisher } from '../events/union-labor-events.publisher.js';

@CommandHandler('RatifyCollectiveBargainingSession')
@Injectable()
export class RatifyCollectiveBargainingSessionHandler {
  constructor(
    private readonly repo: CollectiveBargainingSessionRepository,
    private readonly fsm: FsmFramework,
    private readonly publisher: UnionLaborEventsPublisher,
  ) {}

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>> {
    const payload = command.payload as { collectiveBargainingSessionId: Uuid };
    const ar = await this.repo.findById(payload.collectiveBargainingSessionId);
    if (!ar) throw new Error('Collective bargaining session not found');
    ar.ratify(command.correlationId);
    await this.repo.save(ar);
    await this.publisher.publishFromAggregate(ar);
    return {
      success: true,
      data: { collectiveBargainingSessionId: ar.id.value, status: ar.status },
      commandId: command.commandId,
      correlationId: command.correlationId,
      aggregateId: ar.id,
      newState: ar.status,
      newVersion: ar.aggregateVersion,
      allowedNextActions: this.fsm.getAllowedActionsFromState(ar.status, 'CollectiveBargainingSession'),
      eventsEmitted: ar.domainEvents.map((e) => e.eventName),
      auditRecordId: command.commandId,
    } as CommandResult<unknown>;
  }
}
''')

write(BASE/"union-labor/commands/mark-failed-collective-bargaining-session.handler.ts", '''import { Injectable } from '@nestjs/common';
import { CommandHandler } from '../../../platform/command-bus/command-handler.decorator.js';
import type { HrCommandEnvelope, CommandResult } from '@hcm/command-contracts';
import { Uuid } from '@hcm/shared-kernel';
import { FsmFramework } from '../../../platform/workflow/fsm-framework.js';
import { CollectiveBargainingSessionRepository } from '../repositories/collective-bargaining-session.repository.js';
import { UnionLaborEventsPublisher } from '../events/union-labor-events.publisher.js';

@CommandHandler('MarkFailedCollectiveBargainingSession')
@Injectable()
export class MarkFailedCollectiveBargainingSessionHandler {
  constructor(
    private readonly repo: CollectiveBargainingSessionRepository,
    private readonly fsm: FsmFramework,
    private readonly publisher: UnionLaborEventsPublisher,
  ) {}

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>> {
    const payload = command.payload as { collectiveBargainingSessionId: Uuid };
    const ar = await this.repo.findById(payload.collectiveBargainingSessionId);
    if (!ar) throw new Error('Collective bargaining session not found');
    ar.markFailed(command.correlationId);
    await this.repo.save(ar);
    await this.publisher.publishFromAggregate(ar);
    return {
      success: true,
      data: { collectiveBargainingSessionId: ar.id.value, status: ar.status },
      commandId: command.commandId,
      correlationId: command.correlationId,
      aggregateId: ar.id,
      newState: ar.status,
      newVersion: ar.aggregateVersion,
      allowedNextActions: this.fsm.getAllowedActionsFromState(ar.status, 'CollectiveBargainingSession'),
      eventsEmitted: ar.domainEvents.map((e) => e.eventName),
      auditRecordId: command.commandId,
    } as CommandResult<unknown>;
  }
}
''')

write(BASE/"union-labor/commands/close-collective-bargaining-session.handler.ts", '''import { Injectable } from '@nestjs/common';
import { CommandHandler } from '../../../platform/command-bus/command-handler.decorator.js';
import type { HrCommandEnvelope, CommandResult } from '@hcm/command-contracts';
import { Uuid } from '@hcm/shared-kernel';
import { FsmFramework } from '../../../platform/workflow/fsm-framework.js';
import { CollectiveBargainingSessionRepository } from '../repositories/collective-bargaining-session.repository.js';
import { UnionLaborEventsPublisher } from '../events/union-labor-events.publisher.js';

@CommandHandler('CloseCollectiveBargainingSession')
@Injectable()
export class CloseCollectiveBargainingSessionHandler {
  constructor(
    private readonly repo: CollectiveBargainingSessionRepository,
    private readonly fsm: FsmFramework,
    private readonly publisher: UnionLaborEventsPublisher,
  ) {}

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>> {
    const payload = command.payload as { collectiveBargainingSessionId: Uuid };
    const ar = await this.repo.findById(payload.collectiveBargainingSessionId);
    if (!ar) throw new Error('Collective bargaining session not found');
    ar.close(command.correlationId);
    await this.repo.save(ar);
    await this.publisher.publishFromAggregate(ar);
    return {
      success: true,
      data: { collectiveBargainingSessionId: ar.id.value, status: ar.status },
      commandId: command.commandId,
      correlationId: command.correlationId,
      aggregateId: ar.id,
      newState: ar.status,
      newVersion: ar.aggregateVersion,
      allowedNextActions: this.fsm.getAllowedActionsFromState(ar.status, 'CollectiveBargainingSession'),
      eventsEmitted: ar.domainEvents.map((e) => e.eventName),
      auditRecordId: command.commandId,
    } as CommandResult<unknown>;
  }
}
''')

print("UL command handlers done")

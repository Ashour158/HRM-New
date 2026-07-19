import { Injectable } from '@nestjs/common';
import { CommandHandler } from '../../../platform/command-bus/command-handler.decorator.js';
import type { HrCommandEnvelope, CommandResult } from '@hcm/command-contracts';
import { Uuid, ValidationError } from '@hcm/shared-kernel';
import { FsmFramework } from '../../../platform/workflow/fsm-framework.js';
import { CalculatedField } from '../aggregates/calculated-field.aggregate.js';
import { CalculatedFieldRepository } from '../repositories/calculated-field.repository.js';
import { ReportingEventsPublisher } from '../events/reporting-events.publisher.js';
import { ReportBuilderCatalogService } from '../services/report-builder-catalog.service.js';
import { validateCalculatedFieldExpression } from '../expression/calculated-field-expression.js';
import { knownFieldCodesForDataSource } from '../expression/calculated-field-catalog.util.js';

export interface CreateCalculatedFieldPayload {
  calculatedFieldId: string;
  fieldName: string;
  expression: string;
  dataType: string;
  dataSource: string;
  sourceFields?: string[];
}

@Injectable()
@CommandHandler('CreateCalculatedField')
export class CreateCalculatedFieldHandler {
  constructor(
    private readonly repo: CalculatedFieldRepository,
    private readonly fsm: FsmFramework,
    private readonly publisher: ReportingEventsPublisher,
    private readonly catalog: ReportBuilderCatalogService,
  ) {}

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>> {
    const payload = command.payload as CreateCalculatedFieldPayload;
    const source = this.catalog.getCatalog().dataSources.find((item) => item.code === payload.dataSource);
    if (!source) {
      throw new ValidationError(`Unknown reporting data source: ${payload.dataSource}`);
    }
    const validation = validateCalculatedFieldExpression(payload.expression, knownFieldCodesForDataSource(source));
    if (!validation.valid) {
      throw new ValidationError(`Invalid calculated field expression: ${validation.errors.join('; ')}`);
    }

    const entity = CalculatedField.create({
      id: new Uuid(payload.calculatedFieldId),
      tenantId: command.tenantId,
      fieldName: payload.fieldName,
      expression: payload.expression,
      dataType: payload.dataType,
      dataSource: source.code,
      sourceFields: validation.referencedFields,
    }, command.correlationId);
    await this.repo.save(entity);
    await this.publisher.publishFromAggregate(entity);
    return {
      success: true,
      data: { calculatedFieldId: entity.id.value, status: entity.status },
      commandId: command.commandId,
      correlationId: command.correlationId,
      aggregateId: entity.id,
      newState: entity.status,
      newVersion: entity.aggregateVersion,
      allowedNextActions: this.fsm.getAllowedActionsFromState(entity.status, 'CalculatedField'),
      fieldAccessDecisions: {},
      eventsEmitted: entity.domainEvents.map((e) => e.eventName),
      auditRecordId: Uuid.generate(),
    };
  }
}

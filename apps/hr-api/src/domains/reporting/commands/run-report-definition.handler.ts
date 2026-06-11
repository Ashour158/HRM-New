import { Injectable } from '@nestjs/common';
import { CommandHandler } from '../../../platform/command-bus/command-handler.decorator.js';
import type { CommandResult, HrCommandEnvelope } from '@hcm/command-contracts';
import { Uuid, ValidationError } from '@hcm/shared-kernel';
import { FsmFramework } from '../../../platform/workflow/fsm-framework.js';
import { ReportExecution } from '../aggregates/report-execution.aggregate.js';
import { ReportDefinitionRepository } from '../repositories/report-definition.repository.js';
import { ReportExecutionRepository } from '../repositories/report-execution.repository.js';
import { ReportingEventsPublisher } from '../events/reporting-events.publisher.js';
import { ReportSemanticQueryService, type SemanticReportQueryInput } from '../services/report-semantic-query.service.js';

export interface RunReportDefinitionPayload {
  reportDefinitionId: string;
  reportExecutionId?: string;
  parameters?: Record<string, unknown>;
  limit?: number;
}

@Injectable()
@CommandHandler('RunReportDefinition')
export class RunReportDefinitionHandler {
  constructor(
    private readonly reportDefinitions: ReportDefinitionRepository,
    private readonly reportExecutions: ReportExecutionRepository,
    private readonly semanticQuery: ReportSemanticQueryService,
    private readonly fsm: FsmFramework,
    private readonly publisher: ReportingEventsPublisher,
  ) {}

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>> {
    const payload = command.payload as RunReportDefinitionPayload;
    const reportDefinitionId = new Uuid(payload.reportDefinitionId);
    const definition = await this.reportDefinitions.findByIdForTenant(reportDefinitionId, command.tenantId);
    if (!definition) throw new Error('Report definition not found');
    if (definition.status !== 'PUBLISHED') {
      throw new ValidationError(`Cannot run report definition from state ${definition.status}`);
    }

    const execution = ReportExecution.create({
      id: new Uuid(payload.reportExecutionId ?? Uuid.generate().value),
      tenantId: command.tenantId,
      reportDefinitionId,
      executedBy: command.actor.actorId,
      parameters: payload.parameters,
    }, command.correlationId);

    const eventsEmitted: string[] = [];
    eventsEmitted.push(...await this.saveAndPublish(execution));
    execution.queue(command.correlationId);
    eventsEmitted.push(...await this.saveAndPublish(execution));
    execution.start(command.correlationId);
    eventsEmitted.push(...await this.saveAndPublish(execution));

    try {
      const result = await this.semanticQuery.run(this.buildSemanticInput(definition, payload, command.tenantId.value));
      const rowCount = result.drillThroughCount;
      const resultUrl = `reporting://executions/${execution.id.value}/semantic-result`;
      execution.complete(command.correlationId, resultUrl, rowCount, result as unknown as Record<string, unknown>);
      eventsEmitted.push(...await this.saveAndPublish(execution));

      return {
        success: true,
        data: {
          reportExecutionId: execution.id.value,
          reportDefinitionId: definition.id.value,
          status: execution.status,
          rowCount,
          resultUrl,
          result,
        },
        commandId: command.commandId,
        correlationId: command.correlationId,
        aggregateId: execution.id,
        newState: execution.status,
        newVersion: execution.aggregateVersion,
        allowedNextActions: this.fsm.getAllowedActionsFromState(execution.status, 'ReportExecution'),
        fieldAccessDecisions: {},
        eventsEmitted,
        auditRecordId: Uuid.generate(),
      };
    } catch (error) {
      execution.fail(command.correlationId, errorMessage(error));
      eventsEmitted.push(...await this.saveAndPublish(execution));
      throw error;
    }
  }

  private async saveAndPublish(execution: ReportExecution): Promise<string[]> {
    const events = execution.domainEvents.map((event) => event.eventName);
    await this.reportExecutions.save(execution);
    await this.publisher.publishFromAggregate(execution);
    execution.clearDomainEvents();
    return events;
  }

  private buildSemanticInput(
    definition: {
      dataSource: string;
      queryDefinition: Record<string, unknown>;
      parameters: Record<string, unknown>;
    },
    payload: RunReportDefinitionPayload,
    tenantId: string,
  ): SemanticReportQueryInput {
    const parameters = { ...definition.parameters, ...(payload.parameters ?? {}) };
    return {
      dataSource: definition.dataSource,
      tenantId,
      queryDefinition: mergeQueryDefinition(definition.queryDefinition, parameters),
      parameters,
      limit: payload.limit,
    };
  }
}

function mergeQueryDefinition(queryDefinition: Record<string, unknown>, parameters: Record<string, unknown>): Record<string, unknown> {
  const period = typeof parameters.period === 'string' ? parameters.period : undefined;
  if (!period) return queryDefinition;
  const filters = Array.isArray(queryDefinition.filters)
    ? queryDefinition.filters.filter((filter) => !isFilterWithCode(filter, 'period'))
    : [];
  return {
    ...queryDefinition,
    filters: [{ code: 'period', value: period }, ...filters],
  };
}

function isFilterWithCode(value: unknown, code: string): boolean {
  return Boolean(value && typeof value === 'object' && (value as Record<string, unknown>).code === code);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

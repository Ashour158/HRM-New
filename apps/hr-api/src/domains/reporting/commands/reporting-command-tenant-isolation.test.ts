import { describe, expect, it, vi } from 'vitest';
import { Uuid } from '@hcm/shared-kernel';
import type { HrCommandEnvelope } from '@hcm/command-contracts';
import { QueueReportExecutionHandler } from './queue-report-execution.handler.js';
import { ActivateReportScheduleHandler } from './activate-report-schedule.handler.js';
import { ActivateCalculatedFieldHandler } from './activate-calculated-field.handler.js';

const tenantId = new Uuid('00000000-0000-0000-0000-000000000001');

function command<TPayload>(payload: TPayload): HrCommandEnvelope<TPayload> {
  return {
    commandId: Uuid.generate(),
    commandName: 'TestReportingCommand',
    commandSchemaVersion: 1,
    tenantId,
    actor: {
      actorType: 'USER',
      actorId: new Uuid('00000000-0000-0000-0000-000000000101'),
      roles: ['REPORTING_ADMIN'],
      permissions: [],
      mfaAuthenticated: true,
      email: 'reporting.admin@example.com',
    },
    aggregateType: 'Reporting',
    idempotencyKey: 'test-key',
    correlationId: Uuid.generate(),
    reason: 'test',
    payload,
    metadata: {},
  };
}

function dependencies() {
  return {
    fsm: {
      getAllowedActionsFromState: vi.fn().mockReturnValue([]),
    },
    publisher: {
      publishFromAggregate: vi.fn(),
    },
  };
}

describe('reporting command tenant isolation', () => {
  it('does not modify a report execution that is not in the command tenant', async () => {
    const repo = {
      findByIdForTenant: vi.fn().mockResolvedValue(undefined),
      save: vi.fn(),
    };
    const { fsm, publisher } = dependencies();
    const handler = new QueueReportExecutionHandler(repo as never, fsm as never, publisher as never);
    const reportExecutionId = '00000000-0000-0000-0000-000000000201';

    await expect(handler.handle(command({ reportExecutionId }))).rejects.toThrow('ReportExecution not found');

    expect(repo.findByIdForTenant).toHaveBeenCalledWith(new Uuid(reportExecutionId), tenantId);
    expect(repo.save).not.toHaveBeenCalled();
    expect(publisher.publishFromAggregate).not.toHaveBeenCalled();
  });

  it('does not modify a report schedule that is not in the command tenant', async () => {
    const repo = {
      findByIdForTenant: vi.fn().mockResolvedValue(undefined),
      save: vi.fn(),
    };
    const { fsm, publisher } = dependencies();
    const handler = new ActivateReportScheduleHandler(repo as never, fsm as never, publisher as never);
    const reportScheduleId = '00000000-0000-0000-0000-000000000301';

    await expect(handler.handle(command({ reportScheduleId }))).rejects.toThrow('ReportSchedule not found');

    expect(repo.findByIdForTenant).toHaveBeenCalledWith(new Uuid(reportScheduleId), tenantId);
    expect(repo.save).not.toHaveBeenCalled();
    expect(publisher.publishFromAggregate).not.toHaveBeenCalled();
  });

  it('does not modify a calculated field that is not in the command tenant', async () => {
    const repo = {
      findByIdForTenant: vi.fn().mockResolvedValue(undefined),
      save: vi.fn(),
    };
    const { fsm, publisher } = dependencies();
    const catalog = { getCatalog: vi.fn() };
    const handler = new ActivateCalculatedFieldHandler(repo as never, fsm as never, publisher as never, catalog as never);
    const calculatedFieldId = '00000000-0000-0000-0000-000000000401';

    await expect(handler.handle(command({ calculatedFieldId }))).rejects.toThrow('CalculatedField not found');

    expect(repo.findByIdForTenant).toHaveBeenCalledWith(new Uuid(calculatedFieldId), tenantId);
    expect(repo.save).not.toHaveBeenCalled();
    expect(publisher.publishFromAggregate).not.toHaveBeenCalled();
  });
});

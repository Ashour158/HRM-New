import { describe, expect, it, vi } from 'vitest';
import { Uuid } from '@hcm/shared-kernel';
import { ActivateCalculatedFieldHandler } from './activate-calculated-field.handler.js';
import { CalculatedField } from '../aggregates/calculated-field.aggregate.js';
import { ReportBuilderCatalogService } from '../services/report-builder-catalog.service.js';

const tenantId = new Uuid('00000000-0000-0000-0000-000000000001');
const actorId = new Uuid('00000000-0000-0000-0000-000000000101');
const commandId = new Uuid('00000000-0000-0000-0000-00000000c001');
const correlationId = new Uuid('00000000-0000-0000-0000-00000000c002');
const calculatedFieldId = new Uuid('00000000-0000-0000-0000-00000000c501');

function command(payload: Record<string, unknown>) {
  return {
    commandId,
    commandName: 'ActivateCalculatedField',
    commandSchemaVersion: 1,
    tenantId,
    actor: {
      actorType: 'USER',
      actorId,
      roles: ['REPORTING_ADMIN'],
      permissions: [],
      mfaAuthenticated: true,
      email: 'reporting.admin@example.com',
    },
    aggregateType: 'CalculatedField',
    aggregateId: calculatedFieldId,
    correlationId,
    idempotencyKey: 'activate-calculated-field-test',
    reason: 'Activate calculated field',
    payload,
    metadata: { clientType: 'HR_ADMIN' },
  } as never;
}

function dependencies() {
  const fsm = { getAllowedActionsFromState: vi.fn().mockReturnValue([]) };
  const publisher = { publishFromAggregate: vi.fn() };
  const catalog = new ReportBuilderCatalogService();
  return { fsm, publisher, catalog };
}

describe('ActivateCalculatedFieldHandler', () => {
  it('activates a draft calculated field with a valid expression', async () => {
    const entity = new CalculatedField({
      id: calculatedFieldId,
      tenantId,
      fieldName: 'Net payroll cost',
      expression: 'grossPay - deductionAmount',
      dataType: 'currency',
      dataSource: 'PAYROLL',
      sourceFields: ['grossPay', 'deductionAmount'],
      status: 'DRAFT',
    });
    const repo = { findByIdForTenant: vi.fn().mockResolvedValue(entity), save: vi.fn() };
    const { fsm, publisher, catalog } = dependencies();
    const handler = new ActivateCalculatedFieldHandler(repo as never, fsm as never, publisher as never, catalog);

    const result = await handler.handle(command({ calculatedFieldId: calculatedFieldId.value }));

    expect(result).toMatchObject({ success: true, newState: 'ACTIVE' });
    expect(repo.save).toHaveBeenCalledTimes(1);
  });

  it('refuses to activate a calculated field whose expression is no longer valid for its data source', async () => {
    const entity = new CalculatedField({
      id: calculatedFieldId,
      tenantId,
      fieldName: 'Stale metric',
      expression: 'grossPay - fieldThatNoLongerExists',
      dataType: 'currency',
      dataSource: 'PAYROLL',
      sourceFields: ['grossPay', 'fieldThatNoLongerExists'],
      status: 'DRAFT',
    });
    const repo = { findByIdForTenant: vi.fn().mockResolvedValue(entity), save: vi.fn() };
    const { fsm, publisher, catalog } = dependencies();
    const handler = new ActivateCalculatedFieldHandler(repo as never, fsm as never, publisher as never, catalog);

    await expect(handler.handle(command({ calculatedFieldId: calculatedFieldId.value })))
      .rejects.toThrow(/Cannot activate calculated field with invalid expression/);
    expect(repo.save).not.toHaveBeenCalled();
  });
});

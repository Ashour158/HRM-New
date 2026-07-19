import { describe, expect, it, vi } from 'vitest';
import { Uuid } from '@hcm/shared-kernel';
import { CreateCalculatedFieldHandler } from './create-calculated-field.handler.js';
import { ReportBuilderCatalogService } from '../services/report-builder-catalog.service.js';

const tenantId = new Uuid('00000000-0000-0000-0000-000000000001');
const actorId = new Uuid('00000000-0000-0000-0000-000000000101');
const commandId = new Uuid('00000000-0000-0000-0000-00000000c001');
const correlationId = new Uuid('00000000-0000-0000-0000-00000000c002');

function command(payload: Record<string, unknown>) {
  return {
    commandId,
    commandName: 'CreateCalculatedField',
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
    correlationId,
    idempotencyKey: 'create-calculated-field-test',
    reason: 'Create calculated field',
    payload,
    metadata: { clientType: 'HR_ADMIN' },
  } as never;
}

function dependencies() {
  const repo = { save: vi.fn() };
  const fsm = { getAllowedActionsFromState: vi.fn().mockReturnValue([]) };
  const publisher = { publishFromAggregate: vi.fn() };
  const catalog = new ReportBuilderCatalogService();
  return { repo, fsm, publisher, catalog };
}

describe('CreateCalculatedFieldHandler', () => {
  it('creates a calculated field, deriving sourceFields from the parsed expression', async () => {
    const { repo, fsm, publisher, catalog } = dependencies();
    const handler = new CreateCalculatedFieldHandler(repo as never, fsm as never, publisher as never, catalog);

    const result = await handler.handle(command({
      calculatedFieldId: '00000000-0000-0000-0000-00000000c501',
      fieldName: 'Net payroll cost',
      expression: 'grossPay - deductionAmount',
      dataType: 'currency',
      dataSource: 'PAYROLL',
    }));

    expect(result).toMatchObject({ success: true, newState: 'DRAFT' });
    expect(repo.save).toHaveBeenCalledTimes(1);
    const saved = repo.save.mock.calls[0][0];
    expect(saved.dataSource).toBe('PAYROLL');
    expect(saved.sourceFields).toEqual(['grossPay', 'deductionAmount']);
    expect(publisher.publishFromAggregate).toHaveBeenCalledTimes(1);
  });

  it('rejects an unknown data source', async () => {
    const { repo, fsm, publisher, catalog } = dependencies();
    const handler = new CreateCalculatedFieldHandler(repo as never, fsm as never, publisher as never, catalog);

    await expect(handler.handle(command({
      calculatedFieldId: '00000000-0000-0000-0000-00000000c502',
      fieldName: 'Bad source',
      expression: '1 + 1',
      dataType: 'number',
      dataSource: 'NOT_A_REAL_SOURCE',
    }))).rejects.toThrow('Unknown reporting data source: NOT_A_REAL_SOURCE');
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('rejects an expression referencing a field that does not exist for the data source', async () => {
    const { repo, fsm, publisher, catalog } = dependencies();
    const handler = new CreateCalculatedFieldHandler(repo as never, fsm as never, publisher as never, catalog);

    await expect(handler.handle(command({
      calculatedFieldId: '00000000-0000-0000-0000-00000000c503',
      fieldName: 'Bad field',
      expression: 'grossPay - totallyMadeUpField',
      dataType: 'currency',
      dataSource: 'PAYROLL',
    }))).rejects.toThrow(/Unknown field "totallyMadeUpField"/);
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('rejects a syntactically malformed expression', async () => {
    const { repo, fsm, publisher, catalog } = dependencies();
    const handler = new CreateCalculatedFieldHandler(repo as never, fsm as never, publisher as never, catalog);

    await expect(handler.handle(command({
      calculatedFieldId: '00000000-0000-0000-0000-00000000c504',
      fieldName: 'Malformed',
      expression: 'grossPay +',
      dataType: 'currency',
      dataSource: 'PAYROLL',
    }))).rejects.toThrow(/Invalid calculated field expression/);
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('rejects expressions with function calls', async () => {
    const { repo, fsm, publisher, catalog } = dependencies();
    const handler = new CreateCalculatedFieldHandler(repo as never, fsm as never, publisher as never, catalog);

    await expect(handler.handle(command({
      calculatedFieldId: '00000000-0000-0000-0000-00000000c505',
      fieldName: 'Function call',
      expression: 'SUM(grossPay)',
      dataType: 'currency',
      dataSource: 'PAYROLL',
    }))).rejects.toThrow(/Invalid calculated field expression/);
    expect(repo.save).not.toHaveBeenCalled();
  });
});

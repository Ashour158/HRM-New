import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Uuid } from '@hcm/shared-kernel';
import { ReportExecution } from '../aggregates/report-execution.aggregate.js';
import { ReportSchedule } from '../aggregates/report-schedule.aggregate.js';
import { CalculatedField } from '../aggregates/calculated-field.aggregate.js';
import { ReportExecutionRepository } from './report-execution.repository.js';
import { ReportScheduleRepository } from './report-schedule.repository.js';
import { CalculatedFieldRepository } from './calculated-field.repository.js';

const kyselyMock = vi.hoisted(() => ({ current: undefined as unknown }));

vi.mock('@hcm/database', () => ({
  getPool: vi.fn(),
  createKyselyInstance: vi.fn(() => kyselyMock.current),
}));

const tenantId = new Uuid('00000000-0000-0000-0000-000000000001');
const otherId = new Uuid('00000000-0000-0000-0000-000000000002');
const reportDefinitionId = new Uuid('00000000-0000-0000-0000-000000000201');
const actorId = new Uuid('00000000-0000-0000-0000-000000000101');

function queryBuilder(firstRow?: Record<string, unknown>, rows: Record<string, unknown>[] = []) {
  const builder = {
    selectAll: vi.fn(() => builder),
    select: vi.fn(() => builder),
    where: vi.fn(() => builder),
    executeTakeFirst: vi.fn(async () => firstRow),
    execute: vi.fn(async () => rows),
    set: vi.fn(() => builder),
    values: vi.fn(() => builder),
  };
  return builder;
}

function installDb(firstRow?: Record<string, unknown>) {
  const selectBuilder = queryBuilder(firstRow);
  const updateBuilder = queryBuilder();
  const insertBuilder = queryBuilder();
  const db = {
    selectFrom: vi.fn(() => selectBuilder),
    updateTable: vi.fn(() => updateBuilder),
    insertInto: vi.fn(() => insertBuilder),
  };
  kyselyMock.current = db;
  return { db, selectBuilder, updateBuilder, insertBuilder };
}

describe('reporting repository tenant isolation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('scopes report execution reads and updates by tenant', async () => {
    const { selectBuilder, updateBuilder } = installDb({
      id: otherId.value,
      tenant_id: tenantId.value,
      report_definition_id: reportDefinitionId.value,
      executed_by: actorId.value,
      parameters: {},
      status: 'QUEUED',
      aggregate_version: 1,
    });
    const repo = new ReportExecutionRepository();

    await repo.findByIdForTenant(otherId, tenantId);
    await repo.findByReportDefinitionIdForTenant(reportDefinitionId, tenantId);
    await repo.save(new ReportExecution({
      id: otherId,
      tenantId,
      reportDefinitionId,
      executedBy: new Uuid('00000000-0000-0000-0000-000000000101'),
      parameters: {},
    }));

    expect(selectBuilder.where).toHaveBeenCalledWith('id', '=', otherId.value);
    expect(selectBuilder.where).toHaveBeenCalledWith('report_definition_id', '=', reportDefinitionId.value);
    expect(selectBuilder.where).toHaveBeenCalledWith('tenant_id', '=', tenantId.value);
    expect(updateBuilder.where).toHaveBeenCalledWith('id', '=', otherId.value);
    expect(updateBuilder.where).toHaveBeenCalledWith('tenant_id', '=', tenantId.value);
  });

  it('scopes report schedule reads and updates by tenant', async () => {
    const { selectBuilder, updateBuilder } = installDb({
      id: otherId.value,
      tenant_id: tenantId.value,
      report_definition_id: reportDefinitionId.value,
      frequency: 'DAILY',
      recipients: ['hr@example.com'],
      status: 'ACTIVE',
      aggregate_version: 1,
    });
    const repo = new ReportScheduleRepository();

    await repo.findByIdForTenant(otherId, tenantId);
    await repo.findByReportDefinitionIdForTenant(reportDefinitionId, tenantId);
    await repo.save(new ReportSchedule({
      id: otherId,
      tenantId,
      reportDefinitionId,
      frequency: 'DAILY',
      recipients: ['hr@example.com'],
    }));

    expect(selectBuilder.where).toHaveBeenCalledWith('id', '=', otherId.value);
    expect(selectBuilder.where).toHaveBeenCalledWith('report_definition_id', '=', reportDefinitionId.value);
    expect(selectBuilder.where).toHaveBeenCalledWith('tenant_id', '=', tenantId.value);
    expect(updateBuilder.where).toHaveBeenCalledWith('id', '=', otherId.value);
    expect(updateBuilder.where).toHaveBeenCalledWith('tenant_id', '=', tenantId.value);
  });

  it('scopes calculated field reads and updates by tenant', async () => {
    const { selectBuilder, updateBuilder } = installDb({
      id: otherId.value,
      tenant_id: tenantId.value,
      field_name: 'netPay',
      expression: 'grossPay - tax',
      data_type: 'number',
      source_fields: ['grossPay', 'tax'],
      status: 'DRAFT',
      aggregate_version: 1,
    });
    const repo = new CalculatedFieldRepository();

    await repo.findByIdForTenant(otherId, tenantId);
    await repo.findByStatusForTenant('DRAFT', tenantId);
    await repo.save(new CalculatedField({
      id: otherId,
      tenantId,
      fieldName: 'netPay',
      expression: 'grossPay - tax',
      dataType: 'number',
      sourceFields: ['grossPay', 'tax'],
    }));

    expect(selectBuilder.where).toHaveBeenCalledWith('id', '=', otherId.value);
    expect(selectBuilder.where).toHaveBeenCalledWith('status', '=', 'DRAFT');
    expect(selectBuilder.where).toHaveBeenCalledWith('tenant_id', '=', tenantId.value);
    expect(updateBuilder.where).toHaveBeenCalledWith('id', '=', otherId.value);
    expect(updateBuilder.where).toHaveBeenCalledWith('tenant_id', '=', tenantId.value);
  });
});

import { describe, expect, it, vi } from 'vitest';
import type { Request } from 'express';
import { Uuid } from '@hcm/shared-kernel';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { AdminModuleOperationsController } from './admin-module-operations.controller.js';
import type { AdminModuleOperationsRepository } from './admin-module-operations.repository.js';
import type { NativeModuleOperationAdapterService } from './native-module-operation-adapter.service.js';

const tenantId = '00000000-0000-0000-0000-000000000001';
const actorId = '00000000-0000-0000-0000-000000000123';

function adminRequest(): Request {
  return {
    tenantId,
    actor: {
      actorId: new Uuid(actorId),
      roles: ['HR_ADMIN'],
      permissions: [],
    },
  } as unknown as Request;
}

function employeeRequest(): Request {
  return {
    tenantId,
    actor: {
      actorId: new Uuid(actorId),
      roles: ['EMPLOYEE'],
      permissions: [],
    },
  } as unknown as Request;
}

function recordRow(overrides: Record<string, unknown> = {}) {
  return {
    id: '00000000-0000-0000-0000-000000000201',
    tenant_id: tenantId,
    module_id: 'compensation',
    object_type: 'Comp plan',
    owner_role: 'Compensation Admin',
    workflow_name: 'Start compensation cycle',
    status: 'In Review',
    risk: 'Medium',
    last_event: 'Cycle staged',
    source: 'native',
    native_source: 'compensation_plans',
    native_record_id: '00000000-0000-0000-0000-000000000901',
    native_route: '/admin/modules/compensation/operations',
    payload: { source: 'test' },
    created_by: actorId,
    updated_by: actorId,
    aggregate_version: 0,
    created_at: new Date('2026-06-02T10:00:00.000Z'),
    updated_at: new Date('2026-06-02T10:00:00.000Z'),
    ...overrides,
  };
}

function nativeAdapter(): NativeModuleOperationAdapterService {
  return {
    syncNativeRecords: vi.fn().mockResolvedValue(0),
    applyRecordStatusUpdate: vi.fn().mockResolvedValue(true),
  } as unknown as NativeModuleOperationAdapterService;
}

function workflowRow(overrides: Record<string, unknown> = {}) {
  return {
    id: '00000000-0000-0000-0000-000000000301',
    tenant_id: tenantId,
    module_id: 'compensation',
    workflow_name: 'Start compensation cycle',
    owner_role: 'Compensation Admin',
    state: 'Queued',
    sla_target: '1d',
    last_event: 'Workflow queued',
    payload: { source: 'test' },
    created_by: actorId,
    updated_by: actorId,
    aggregate_version: 0,
    created_at: new Date('2026-06-02T10:00:00.000Z'),
    updated_at: new Date('2026-06-02T10:00:00.000Z'),
    ...overrides,
  };
}

function controlRow(overrides: Record<string, unknown> = {}) {
  return {
    id: '00000000-0000-0000-0000-000000000401',
    tenant_id: tenantId,
    module_id: 'compensation',
    control_name: 'Salary visibility',
    control_type: 'Access control',
    owner_role: 'Compensation Admin',
    status: 'Draft',
    last_event: 'Control drafted',
    payload: { source: 'test' },
    created_by: actorId,
    updated_by: actorId,
    aggregate_version: 0,
    created_at: new Date('2026-06-02T10:00:00.000Z'),
    updated_at: new Date('2026-06-02T10:00:00.000Z'),
    ...overrides,
  };
}

describe('AdminModuleOperationsController', () => {
  it('lists records and workflows for an admin module workspace', async () => {
    const repository = {
      findRecords: vi.fn().mockResolvedValue([recordRow()]),
      findWorkflows: vi.fn().mockResolvedValue([workflowRow()]),
      findControls: vi.fn().mockResolvedValue([controlRow()]),
    } as unknown as AdminModuleOperationsRepository;
    const adapter = nativeAdapter();
    const controller = new AdminModuleOperationsController(repository, adapter);

    const workspace = await controller.getWorkspace('compensation', adminRequest());

    expect(adapter.syncNativeRecords).toHaveBeenCalledWith(new Uuid(tenantId), 'compensation', actorId);
    expect(repository.findRecords).toHaveBeenCalledWith(new Uuid(tenantId), 'compensation');
    expect(repository.findWorkflows).toHaveBeenCalledWith(new Uuid(tenantId), 'compensation');
    expect(workspace).toMatchObject({
      moduleId: 'compensation',
      records: [{
        id: '00000000-0000-0000-0000-000000000201',
        objectType: 'Comp plan',
        source: 'native',
        nativeSource: 'compensation_plans',
        nativeId: '00000000-0000-0000-0000-000000000901',
      }],
      workflows: [{ id: '00000000-0000-0000-0000-000000000301', state: 'Queued' }],
      controls: [{ id: '00000000-0000-0000-0000-000000000401', status: 'Draft' }],
    });
  });

  it('returns module depth evidence for records, workflows, native wiring, ownership, and risk controls', async () => {
    const repository = {
      findRecords: vi.fn().mockResolvedValue([recordRow({ status: 'Blocked', risk: 'High' })]),
      findWorkflows: vi.fn().mockResolvedValue([workflowRow({ state: 'Ready' })]),
      findControls: vi.fn().mockResolvedValue([controlRow({ status: 'Applied' })]),
    } as unknown as AdminModuleOperationsRepository;
    const controller = new AdminModuleOperationsController(repository, nativeAdapter());

    const workspace = await controller.getWorkspace('compensation', adminRequest());

    expect(workspace.moduleDepth).toMatchObject({
      status: 'Needs Work',
      score: expect.any(Number),
      blockers: [],
      capabilities: expect.arrayContaining([
        expect.objectContaining({ code: 'records', status: 'Ready' }),
        expect.objectContaining({ code: 'workflows', status: 'Ready' }),
        expect.objectContaining({ code: 'nativeWiring', status: 'Ready' }),
        expect.objectContaining({ code: 'ownership', status: 'Ready' }),
        expect.objectContaining({ code: 'riskControls', status: 'Needs Work' }),
        expect.objectContaining({ code: 'governanceControls', status: 'Ready' }),
      ]),
    });
    expect(workspace.moduleDepth.nextActions).toContain('Resolve blocked or high-risk operation records before closing the module readiness review.');
  });

  it('creates, edits, approves, and applies governance controls through explicit lifecycle commands', async () => {
    const repository = {
      createControl: vi.fn().mockResolvedValue(controlRow()),
      findControl: vi.fn()
        .mockResolvedValueOnce(controlRow())
        .mockResolvedValueOnce(controlRow({ status: 'In Review' }))
        .mockResolvedValueOnce(controlRow({ status: 'Approved' })),
      updateControl: vi.fn()
        .mockResolvedValueOnce(controlRow({ owner_role: 'HR Admin', aggregate_version: 1 }))
        .mockResolvedValueOnce(controlRow({ status: 'In Review', last_event: 'Control submitted for review', aggregate_version: 2 }))
        .mockResolvedValueOnce(controlRow({ status: 'Approved', last_event: 'Control approved', aggregate_version: 3 }))
        .mockResolvedValueOnce(controlRow({ status: 'Applied', last_event: 'Control applied', aggregate_version: 4 })),
    } as unknown as AdminModuleOperationsRepository;
    const controller = new AdminModuleOperationsController(repository, nativeAdapter());

    const created = await controller.createControl('compensation', {
      controlName: 'Salary visibility',
      controlType: 'Access control',
      ownerRole: 'Compensation Admin',
      lastEvent: 'Control drafted',
      payload: { description: 'Salary fields require restricted access.' },
    }, adminRequest());
    const edited = await controller.updateControl('compensation', created.id, { ownerRole: 'HR Admin' }, adminRequest());
    const submitted = await controller.submitControlForReview('compensation', created.id, adminRequest());
    const approved = await controller.approveControl('compensation', created.id, adminRequest());
    const applied = await controller.applyControl('compensation', created.id, adminRequest());

    expect(repository.createControl).toHaveBeenCalledWith(expect.objectContaining({
      moduleId: 'compensation',
      controlName: 'Salary visibility',
      status: 'Draft',
      actorId,
    }));
    expect(edited).toMatchObject({ ownerRole: 'HR Admin', aggregateVersion: 1 });
    expect(submitted).toMatchObject({ status: 'In Review', lastEvent: 'Control submitted for review' });
    expect(approved).toMatchObject({ status: 'Approved', lastEvent: 'Control approved' });
    expect(applied).toMatchObject({ status: 'Applied', lastEvent: 'Control applied' });
  });

  it('creates and serializes an operational record', async () => {
    const repository = {
      createRecord: vi.fn().mockResolvedValue(recordRow({ status: 'Active', risk: 'Low' })),
    } as unknown as AdminModuleOperationsRepository;
    const controller = new AdminModuleOperationsController(repository, nativeAdapter());

    const created = await controller.createRecord('compensation', {
      objectType: 'Comp plan',
      ownerRole: 'Compensation Admin',
      workflowName: 'Start compensation cycle',
      status: 'Active',
      risk: 'Low',
      lastEvent: 'Created from test',
      payload: { source: 'spec' },
    }, adminRequest());

    expect(repository.createRecord).toHaveBeenCalledWith(expect.objectContaining({
      moduleId: 'compensation',
      objectType: 'Comp plan',
      status: 'Active',
      risk: 'Low',
      actorId,
    }));
    expect(created).toMatchObject({
      moduleId: 'compensation',
      objectType: 'Comp plan',
      status: 'Active',
      risk: 'Low',
      payload: { source: 'test' },
    });
  });

  it('updates workflow state for an admin user', async () => {
    const repository = {
      updateWorkflow: vi.fn().mockResolvedValue(workflowRow({ state: 'Ready', aggregate_version: 1 })),
    } as unknown as AdminModuleOperationsRepository;
    const controller = new AdminModuleOperationsController(repository, nativeAdapter());

    const updated = await controller.updateWorkflow(
      'compensation',
      '00000000-0000-0000-0000-000000000301',
      { state: 'Ready', lastEvent: 'Advanced by admin' },
      adminRequest(),
    );

    expect(repository.updateWorkflow).toHaveBeenCalledWith(
      new Uuid(tenantId),
      'compensation',
      new Uuid('00000000-0000-0000-0000-000000000301'),
      expect.objectContaining({ state: 'Ready', lastEvent: 'Advanced by admin', actorId }),
    );
    expect(updated).toMatchObject({ state: 'Ready', aggregateVersion: 1 });
  });

  it('advances native record status through the native adapter', async () => {
    const repository = {
      findRecord: vi.fn()
        .mockResolvedValueOnce(recordRow())
        .mockResolvedValueOnce(recordRow({ status: 'Active', last_event: 'Comp plan synced from compensation_plans (ACTIVE)' })),
    } as unknown as AdminModuleOperationsRepository;
    const adapter = nativeAdapter();
    const request = adminRequest();
    const controller = new AdminModuleOperationsController(repository, adapter);

    const updated = await controller.updateRecord(
      'compensation',
      '00000000-0000-0000-0000-000000000201',
      { status: 'Active', lastEvent: 'Comp plan status advanced' },
      request,
    );

    expect(adapter.applyRecordStatusUpdate).toHaveBeenCalledWith(
      new Uuid(tenantId),
      'compensation',
      'compensation_plans',
      '00000000-0000-0000-0000-000000000901',
      'Active',
      request.actor,
    );
    expect(adapter.syncNativeRecords).toHaveBeenCalledWith(new Uuid(tenantId), 'compensation', actorId);
    expect(updated).toMatchObject({
      id: '00000000-0000-0000-0000-000000000201',
      status: 'Active',
      source: 'native',
    });
  });

  it('rejects unsupported native record status updates instead of writing through generically', async () => {
    const repository = {
      findRecord: vi.fn().mockResolvedValue(recordRow({ native_source: 'compensation_bands' })),
    } as unknown as AdminModuleOperationsRepository;
    const adapter = nativeAdapter();
    vi.mocked(adapter.applyRecordStatusUpdate).mockResolvedValue(false);
    const controller = new AdminModuleOperationsController(repository, adapter);

    await expect(controller.updateRecord(
      'compensation',
      '00000000-0000-0000-0000-000000000201',
      { status: 'Active', lastEvent: 'Unsupported native transition' },
      adminRequest(),
    )).rejects.toBeInstanceOf(BadRequestException);

    expect(adapter.applyRecordStatusUpdate).toHaveBeenCalledWith(
      new Uuid(tenantId),
      'compensation',
      'compensation_bands',
      '00000000-0000-0000-0000-000000000901',
      'Active',
      expect.any(Object),
    );
  });

  it('rejects non-admin module operation access', async () => {
    const repository = {
      findRecords: vi.fn(),
      findWorkflows: vi.fn(),
    } as unknown as AdminModuleOperationsRepository;
    const controller = new AdminModuleOperationsController(repository, nativeAdapter());

    await expect(controller.getWorkspace('compensation', employeeRequest())).rejects.toBeInstanceOf(ForbiddenException);
  });
});

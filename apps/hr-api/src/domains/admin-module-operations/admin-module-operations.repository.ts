import { Injectable } from '@nestjs/common';
import { createKyselyInstance, getPool, type Database } from '@hcm/database';
import { sql, type Insertable, type Kysely, type Selectable } from 'kysely';
import { Uuid } from '@hcm/shared-kernel';

export type OperationRecordStatus = 'Draft' | 'Active' | 'In Review' | 'Blocked' | 'Closed';
export type OperationRisk = 'Low' | 'Medium' | 'High';
export type OperationWorkflowState = 'Queued' | 'In Progress' | 'Needs Approval' | 'Ready';
export type OperationControlStatus = 'Draft' | 'In Review' | 'Approved' | 'Applied';

export type AdminModuleOperationRecord = Selectable<Database['admin_module_operation_records']>;
export type AdminModuleOperationWorkflow = Selectable<Database['admin_module_operation_workflows']>;
export type AdminModuleOperationControl = Selectable<Database['admin_module_operation_controls']>;

export type CreateOperationRecordInput = {
  tenantId: Uuid;
  moduleId: string;
  objectType: string;
  ownerRole: string;
  workflowName: string;
  status: OperationRecordStatus;
  risk: OperationRisk;
  lastEvent: string;
  source?: string;
  nativeSource?: string;
  nativeRecordId?: string;
  nativeRoute?: string;
  payload?: unknown;
  actorId?: string;
};

export type UpdateOperationRecordInput = Partial<{
  objectType: string;
  ownerRole: string;
  workflowName: string;
  status: OperationRecordStatus;
  risk: OperationRisk;
  lastEvent: string;
  source: string;
  nativeSource: string | null;
  nativeRecordId: string | null;
  nativeRoute: string | null;
  payload: unknown;
  actorId: string;
}>;

export type CreateOperationWorkflowInput = {
  tenantId: Uuid;
  moduleId: string;
  workflowName: string;
  ownerRole: string;
  state: OperationWorkflowState;
  slaTarget: string;
  lastEvent: string;
  payload?: unknown;
  actorId?: string;
};

export type UpdateOperationWorkflowInput = Partial<{
  workflowName: string;
  ownerRole: string;
  state: OperationWorkflowState;
  slaTarget: string;
  lastEvent: string;
  payload: unknown;
  actorId: string;
}>;

export type CreateOperationControlInput = {
  tenantId: Uuid;
  moduleId: string;
  controlName: string;
  controlType: string;
  ownerRole: string;
  status: OperationControlStatus;
  lastEvent: string;
  payload?: unknown;
  actorId?: string;
};

export type UpdateOperationControlInput = Partial<{
  controlName: string;
  controlType: string;
  ownerRole: string;
  status: OperationControlStatus;
  lastEvent: string;
  payload: unknown;
  actorId: string;
}>;

@Injectable()
export class AdminModuleOperationsRepository {
  private readonly db: Kysely<Database>;

  constructor() {
    this.db = createKyselyInstance(getPool());
  }

  async findRecords(tenantId: Uuid, moduleId: string): Promise<AdminModuleOperationRecord[]> {
    return this.db
      .selectFrom('admin_module_operation_records')
      .selectAll()
      .where('tenant_id', '=', tenantId.value)
      .where('module_id', '=', moduleId)
      .orderBy('updated_at', 'desc')
      .execute();
  }

  async findRecord(tenantId: Uuid, moduleId: string, recordId: Uuid): Promise<AdminModuleOperationRecord | undefined> {
    return this.db
      .selectFrom('admin_module_operation_records')
      .selectAll()
      .where('tenant_id', '=', tenantId.value)
      .where('module_id', '=', moduleId)
      .where('id', '=', recordId.value)
      .executeTakeFirst();
  }

  async findWorkflows(tenantId: Uuid, moduleId: string): Promise<AdminModuleOperationWorkflow[]> {
    return this.db
      .selectFrom('admin_module_operation_workflows')
      .selectAll()
      .where('tenant_id', '=', tenantId.value)
      .where('module_id', '=', moduleId)
      .orderBy('created_at', 'asc')
      .execute();
  }

  async findControls(tenantId: Uuid, moduleId: string): Promise<AdminModuleOperationControl[]> {
    return this.db
      .selectFrom('admin_module_operation_controls')
      .selectAll()
      .where('tenant_id', '=', tenantId.value)
      .where('module_id', '=', moduleId)
      .orderBy('created_at', 'asc')
      .execute();
  }

  async findControl(tenantId: Uuid, moduleId: string, controlId: Uuid): Promise<AdminModuleOperationControl | undefined> {
    return this.db
      .selectFrom('admin_module_operation_controls')
      .selectAll()
      .where('tenant_id', '=', tenantId.value)
      .where('module_id', '=', moduleId)
      .where('id', '=', controlId.value)
      .executeTakeFirst();
  }

  async createRecord(input: CreateOperationRecordInput): Promise<AdminModuleOperationRecord> {
    const now = new Date();
    const row: Insertable<Database['admin_module_operation_records']> = {
      id: Uuid.generate().value,
      tenant_id: input.tenantId.value,
      module_id: input.moduleId,
      object_type: input.objectType,
      owner_role: input.ownerRole,
      workflow_name: input.workflowName,
      status: input.status,
      risk: input.risk,
      last_event: input.lastEvent,
      source: input.source ?? 'operations',
      native_source: input.nativeSource ?? null,
      native_record_id: input.nativeRecordId ?? null,
      native_route: input.nativeRoute ?? null,
      payload: input.payload ?? {},
      created_by: input.actorId ?? null,
      updated_by: input.actorId ?? null,
      aggregate_version: 0,
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
    };

    return this.db
      .insertInto('admin_module_operation_records')
      .values(row)
      .returningAll()
      .executeTakeFirstOrThrow();
  }

  async updateRecord(
    tenantId: Uuid,
    moduleId: string,
    recordId: Uuid,
    input: UpdateOperationRecordInput,
  ): Promise<AdminModuleOperationRecord | undefined> {
    const row = {
      ...(input.objectType !== undefined ? { object_type: input.objectType } : {}),
      ...(input.ownerRole !== undefined ? { owner_role: input.ownerRole } : {}),
      ...(input.workflowName !== undefined ? { workflow_name: input.workflowName } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(input.risk !== undefined ? { risk: input.risk } : {}),
      ...(input.lastEvent !== undefined ? { last_event: input.lastEvent } : {}),
      ...(input.source !== undefined ? { source: input.source } : {}),
      ...(input.nativeSource !== undefined ? { native_source: input.nativeSource } : {}),
      ...(input.nativeRecordId !== undefined ? { native_record_id: input.nativeRecordId } : {}),
      ...(input.nativeRoute !== undefined ? { native_route: input.nativeRoute } : {}),
      ...(input.payload !== undefined ? { payload: input.payload } : {}),
      ...(input.actorId !== undefined ? { updated_by: input.actorId } : {}),
      updated_at: new Date().toISOString(),
      aggregate_version: sql<number>`aggregate_version + 1`,
    };

    return this.db
      .updateTable('admin_module_operation_records')
      .set(row as never)
      .where('tenant_id', '=', tenantId.value)
      .where('module_id', '=', moduleId)
      .where('id', '=', recordId.value)
      .returningAll()
      .executeTakeFirst();
  }

  async upsertNativeRecord(input: CreateOperationRecordInput): Promise<AdminModuleOperationRecord> {
    const nativeSource = input.nativeSource;
    const nativeRecordId = input.nativeRecordId;
    if (!nativeSource || !nativeRecordId) {
      throw new Error('nativeSource and nativeRecordId are required for native operation records');
    }

    const now = new Date();
    const row: Insertable<Database['admin_module_operation_records']> = {
      id: Uuid.generate().value,
      tenant_id: input.tenantId.value,
      module_id: input.moduleId,
      object_type: input.objectType,
      owner_role: input.ownerRole,
      workflow_name: input.workflowName,
      status: input.status,
      risk: input.risk,
      last_event: input.lastEvent,
      source: input.source ?? 'native',
      native_source: nativeSource,
      native_record_id: nativeRecordId,
      native_route: input.nativeRoute ?? null,
      payload: input.payload ?? {},
      created_by: input.actorId ?? null,
      updated_by: input.actorId ?? null,
      aggregate_version: 0,
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
    };

    return this.db
      .insertInto('admin_module_operation_records')
      .values(row)
      .onConflict((oc) => oc
        .columns(['tenant_id', 'module_id', 'native_source', 'native_record_id'])
        .where('native_source', 'is not', null)
        .where('native_record_id', 'is not', null)
        .doUpdateSet({
          object_type: input.objectType,
          owner_role: input.ownerRole,
          workflow_name: input.workflowName,
          status: input.status,
          risk: input.risk,
          last_event: input.lastEvent,
          source: input.source ?? 'native',
          native_route: input.nativeRoute ?? null,
          payload: input.payload ?? {},
          updated_by: input.actorId ?? null,
          updated_at: now.toISOString(),
          aggregate_version: sql<number>`admin_module_operation_records.aggregate_version + 1`,
        }))
      .returningAll()
      .executeTakeFirstOrThrow();
  }

  async upsertWorkflow(input: CreateOperationWorkflowInput): Promise<AdminModuleOperationWorkflow> {
    const now = new Date();
    const row: Insertable<Database['admin_module_operation_workflows']> = {
      id: Uuid.generate().value,
      tenant_id: input.tenantId.value,
      module_id: input.moduleId,
      workflow_name: input.workflowName,
      owner_role: input.ownerRole,
      state: input.state,
      sla_target: input.slaTarget,
      last_event: input.lastEvent,
      payload: input.payload ?? {},
      created_by: input.actorId ?? null,
      updated_by: input.actorId ?? null,
      aggregate_version: 0,
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
    };

    return this.db
      .insertInto('admin_module_operation_workflows')
      .values(row)
      .onConflict((oc) => oc
        .columns(['tenant_id', 'module_id', 'workflow_name'])
        .doUpdateSet({
          owner_role: input.ownerRole,
          state: input.state,
          sla_target: input.slaTarget,
          last_event: input.lastEvent,
          payload: input.payload ?? {},
          updated_by: input.actorId ?? null,
          updated_at: now.toISOString(),
          aggregate_version: sql<number>`admin_module_operation_workflows.aggregate_version + 1`,
        }))
      .returningAll()
      .executeTakeFirstOrThrow();
  }

  async updateWorkflow(
    tenantId: Uuid,
    moduleId: string,
    workflowId: Uuid,
    input: UpdateOperationWorkflowInput,
  ): Promise<AdminModuleOperationWorkflow | undefined> {
    const row = {
      ...(input.workflowName !== undefined ? { workflow_name: input.workflowName } : {}),
      ...(input.ownerRole !== undefined ? { owner_role: input.ownerRole } : {}),
      ...(input.state !== undefined ? { state: input.state } : {}),
      ...(input.slaTarget !== undefined ? { sla_target: input.slaTarget } : {}),
      ...(input.lastEvent !== undefined ? { last_event: input.lastEvent } : {}),
      ...(input.payload !== undefined ? { payload: input.payload } : {}),
      ...(input.actorId !== undefined ? { updated_by: input.actorId } : {}),
      updated_at: new Date().toISOString(),
      aggregate_version: sql<number>`aggregate_version + 1`,
    };

    return this.db
      .updateTable('admin_module_operation_workflows')
      .set(row as never)
      .where('tenant_id', '=', tenantId.value)
      .where('module_id', '=', moduleId)
      .where('id', '=', workflowId.value)
      .returningAll()
      .executeTakeFirst();
  }

  async createControl(input: CreateOperationControlInput): Promise<AdminModuleOperationControl> {
    const now = new Date();
    const row: Insertable<Database['admin_module_operation_controls']> = {
      id: Uuid.generate().value,
      tenant_id: input.tenantId.value,
      module_id: input.moduleId,
      control_name: input.controlName,
      control_type: input.controlType,
      owner_role: input.ownerRole,
      status: input.status,
      last_event: input.lastEvent,
      payload: input.payload ?? {},
      created_by: input.actorId ?? null,
      updated_by: input.actorId ?? null,
      aggregate_version: 0,
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
    };

    return this.db
      .insertInto('admin_module_operation_controls')
      .values(row)
      .onConflict((oc) => oc
        .columns(['tenant_id', 'module_id', 'control_name'])
        .doUpdateSet({
          control_type: input.controlType,
          owner_role: input.ownerRole,
          status: input.status,
          last_event: input.lastEvent,
          payload: input.payload ?? {},
          updated_by: input.actorId ?? null,
          updated_at: now.toISOString(),
          aggregate_version: sql<number>`admin_module_operation_controls.aggregate_version + 1`,
        }))
      .returningAll()
      .executeTakeFirstOrThrow();
  }

  async updateControl(
    tenantId: Uuid,
    moduleId: string,
    controlId: Uuid,
    input: UpdateOperationControlInput,
  ): Promise<AdminModuleOperationControl | undefined> {
    const row = {
      ...(input.controlName !== undefined ? { control_name: input.controlName } : {}),
      ...(input.controlType !== undefined ? { control_type: input.controlType } : {}),
      ...(input.ownerRole !== undefined ? { owner_role: input.ownerRole } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(input.lastEvent !== undefined ? { last_event: input.lastEvent } : {}),
      ...(input.payload !== undefined ? { payload: input.payload } : {}),
      ...(input.actorId !== undefined ? { updated_by: input.actorId } : {}),
      updated_at: new Date().toISOString(),
      aggregate_version: sql<number>`aggregate_version + 1`,
    };

    return this.db
      .updateTable('admin_module_operation_controls')
      .set(row as never)
      .where('tenant_id', '=', tenantId.value)
      .where('module_id', '=', moduleId)
      .where('id', '=', controlId.value)
      .returningAll()
      .executeTakeFirst();
  }
}

import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { Uuid } from '@hcm/shared-kernel';
import { AuthGuard } from '../../guards/auth.guard.js';
import {
  AdminModuleOperationsRepository,
  type AdminModuleOperationRecord,
  type AdminModuleOperationWorkflow,
  type OperationRecordStatus,
  type OperationRisk,
  type OperationWorkflowState,
} from './admin-module-operations.repository.js';
import { NativeModuleOperationAdapterService } from './native-module-operation-adapter.service.js';

type CreateRecordDto = {
  objectType?: string;
  ownerRole?: string;
  workflowName?: string;
  status?: OperationRecordStatus;
  risk?: OperationRisk;
  lastEvent?: string;
  payload?: unknown;
};

type UpdateRecordDto = Partial<CreateRecordDto>;

type CreateWorkflowDto = {
  workflowName?: string;
  ownerRole?: string;
  state?: OperationWorkflowState;
  slaTarget?: string;
  lastEvent?: string;
  payload?: unknown;
};

type UpdateWorkflowDto = Partial<CreateWorkflowDto>;

const ADMIN_OPERATION_ROLES = new Set([
  'APP_ADMIN',
  'PLATFORM_ADMIN',
  'SUPER_ADMIN',
  'HR_ADMIN',
  'HRBP',
  'PAYROLL_ADMIN',
  'COMPENSATION_ADMIN',
  'BENEFITS_ADMIN',
  'COMPLIANCE_OFFICER',
  'ER_SPECIALIST',
]);

const RECORD_STATUSES: OperationRecordStatus[] = ['Draft', 'Active', 'In Review', 'Blocked', 'Closed'];
const RISKS: OperationRisk[] = ['Low', 'Medium', 'High'];
const WORKFLOW_STATES: OperationWorkflowState[] = ['Queued', 'In Progress', 'Needs Approval', 'Ready'];

function requiredString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new BadRequestException(`${field} is required`);
  }
  return value.trim();
}

function optionalEnum<T extends string>(value: unknown, allowed: readonly T[], field: string, fallback?: T): T | undefined {
  if (value === undefined || value === null || value === '') return fallback;
  if (typeof value === 'string' && allowed.includes(value as T)) return value as T;
  throw new BadRequestException(`${field} must be one of: ${allowed.join(', ')}`);
}

function actorIdValue(req: Request): string | undefined {
  const actorId = req.actor?.actorId;
  if (!actorId) return undefined;
  if (actorId instanceof Uuid) return actorId.value;
  if (typeof actorId === 'string') return actorId;
  const actorIdLike = actorId as { value?: unknown };
  return typeof actorIdLike.value === 'string' ? actorIdLike.value : undefined;
}

@ApiTags('Admin Module Operations')
@UseGuards(AuthGuard)
@Controller('admin/module-operations')
export class AdminModuleOperationsController {
  constructor(
    private readonly repository: AdminModuleOperationsRepository,
    private readonly nativeAdapter: NativeModuleOperationAdapterService,
  ) {}

  @Get(':moduleId')
  async getWorkspace(@Param('moduleId') moduleIdParam: string, @Req() req: Request) {
    const moduleId = this.normalizeModuleId(moduleIdParam);
    const tenantId = this.getTenantId(req);
    this.assertAdminScope(req);
    await this.nativeAdapter.syncNativeRecords(tenantId, moduleId, actorIdValue(req));
    const [records, workflows] = await Promise.all([
      this.repository.findRecords(tenantId, moduleId),
      this.repository.findWorkflows(tenantId, moduleId),
    ]);

    return {
      moduleId,
      records: records.map((record) => this.serializeRecord(record)),
      workflows: workflows.map((workflow) => this.serializeWorkflow(workflow)),
    };
  }

  @Get(':moduleId/records')
  async listRecords(@Param('moduleId') moduleIdParam: string, @Req() req: Request) {
    const moduleId = this.normalizeModuleId(moduleIdParam);
    this.assertAdminScope(req);
    const tenantId = this.getTenantId(req);
    await this.nativeAdapter.syncNativeRecords(tenantId, moduleId, actorIdValue(req));
    const records = await this.repository.findRecords(tenantId, moduleId);
    return records.map((record) => this.serializeRecord(record));
  }

  @Post(':moduleId/records')
  async createRecord(@Param('moduleId') moduleIdParam: string, @Body() dto: CreateRecordDto, @Req() req: Request) {
    const moduleId = this.normalizeModuleId(moduleIdParam);
    this.assertAdminScope(req);
    const record = await this.repository.createRecord({
      tenantId: this.getTenantId(req),
      moduleId,
      objectType: requiredString(dto.objectType, 'objectType'),
      ownerRole: requiredString(dto.ownerRole, 'ownerRole'),
      workflowName: requiredString(dto.workflowName, 'workflowName'),
      status: optionalEnum(dto.status, RECORD_STATUSES, 'status', 'In Review') ?? 'In Review',
      risk: optionalEnum(dto.risk, RISKS, 'risk', 'Medium') ?? 'Medium',
      lastEvent: requiredString(dto.lastEvent, 'lastEvent'),
      payload: dto.payload ?? {},
      actorId: actorIdValue(req),
    });
    return this.serializeRecord(record);
  }

  @Patch(':moduleId/records/:recordId')
  async updateRecord(
    @Param('moduleId') moduleIdParam: string,
    @Param('recordId') recordIdParam: string,
    @Body() dto: UpdateRecordDto,
    @Req() req: Request,
  ) {
    const moduleId = this.normalizeModuleId(moduleIdParam);
    const recordId = this.normalizeUuid(recordIdParam, 'recordId');
    this.assertAdminScope(req);
    const tenantId = this.getTenantId(req);
    const existingRecord = await this.repository.findRecord(tenantId, moduleId, recordId);
    if (!existingRecord) throw new NotFoundException('Module operation record not found');

    if (existingRecord.source === 'native') {
      if (dto.status === undefined) {
        throw new BadRequestException('Native operation records can only be advanced by status through this workspace');
      }
      const status = optionalEnum(dto.status, RECORD_STATUSES, 'status');
      if (!existingRecord.native_source || !existingRecord.native_record_id || !status) {
        throw new BadRequestException('Native operation record is missing source linkage');
      }
      const applied = await this.nativeAdapter.applyRecordStatusUpdate(
        tenantId,
        moduleId,
        existingRecord.native_source,
        existingRecord.native_record_id,
        status,
        req.actor,
      );
      if (!applied) {
        throw new BadRequestException('Native operation status cannot be updated through this workspace for this source');
      }
      await this.nativeAdapter.syncNativeRecords(tenantId, moduleId, actorIdValue(req));
      const refreshedRecord = await this.repository.findRecord(tenantId, moduleId, recordId);
      return this.serializeRecord(refreshedRecord ?? existingRecord);
    }

    const record = await this.repository.updateRecord(tenantId, moduleId, recordId, {
      ...(dto.objectType !== undefined ? { objectType: requiredString(dto.objectType, 'objectType') } : {}),
      ...(dto.ownerRole !== undefined ? { ownerRole: requiredString(dto.ownerRole, 'ownerRole') } : {}),
      ...(dto.workflowName !== undefined ? { workflowName: requiredString(dto.workflowName, 'workflowName') } : {}),
      ...(dto.status !== undefined ? { status: optionalEnum(dto.status, RECORD_STATUSES, 'status') } : {}),
      ...(dto.risk !== undefined ? { risk: optionalEnum(dto.risk, RISKS, 'risk') } : {}),
      ...(dto.lastEvent !== undefined ? { lastEvent: requiredString(dto.lastEvent, 'lastEvent') } : {}),
      ...(dto.payload !== undefined ? { payload: dto.payload } : {}),
      actorId: actorIdValue(req),
    });
    if (!record) throw new NotFoundException('Module operation record not found');
    return this.serializeRecord(record);
  }

  @Get(':moduleId/workflows')
  async listWorkflows(@Param('moduleId') moduleIdParam: string, @Req() req: Request) {
    const moduleId = this.normalizeModuleId(moduleIdParam);
    this.assertAdminScope(req);
    const workflows = await this.repository.findWorkflows(this.getTenantId(req), moduleId);
    return workflows.map((workflow) => this.serializeWorkflow(workflow));
  }

  @Post(':moduleId/workflows')
  async createWorkflow(@Param('moduleId') moduleIdParam: string, @Body() dto: CreateWorkflowDto, @Req() req: Request) {
    const moduleId = this.normalizeModuleId(moduleIdParam);
    this.assertAdminScope(req);
    const workflow = await this.repository.upsertWorkflow({
      tenantId: this.getTenantId(req),
      moduleId,
      workflowName: requiredString(dto.workflowName, 'workflowName'),
      ownerRole: requiredString(dto.ownerRole, 'ownerRole'),
      state: optionalEnum(dto.state, WORKFLOW_STATES, 'state', 'Queued') ?? 'Queued',
      slaTarget: typeof dto.slaTarget === 'string' && dto.slaTarget.trim() ? dto.slaTarget.trim() : '1d',
      lastEvent: requiredString(dto.lastEvent, 'lastEvent'),
      payload: dto.payload ?? {},
      actorId: actorIdValue(req),
    });
    return this.serializeWorkflow(workflow);
  }

  @Patch(':moduleId/workflows/:workflowId')
  async updateWorkflow(
    @Param('moduleId') moduleIdParam: string,
    @Param('workflowId') workflowIdParam: string,
    @Body() dto: UpdateWorkflowDto,
    @Req() req: Request,
  ) {
    const moduleId = this.normalizeModuleId(moduleIdParam);
    const workflowId = this.normalizeUuid(workflowIdParam, 'workflowId');
    this.assertAdminScope(req);
    const workflow = await this.repository.updateWorkflow(this.getTenantId(req), moduleId, workflowId, {
      ...(dto.workflowName !== undefined ? { workflowName: requiredString(dto.workflowName, 'workflowName') } : {}),
      ...(dto.ownerRole !== undefined ? { ownerRole: requiredString(dto.ownerRole, 'ownerRole') } : {}),
      ...(dto.state !== undefined ? { state: optionalEnum(dto.state, WORKFLOW_STATES, 'state') } : {}),
      ...(dto.slaTarget !== undefined ? { slaTarget: requiredString(dto.slaTarget, 'slaTarget') } : {}),
      ...(dto.lastEvent !== undefined ? { lastEvent: requiredString(dto.lastEvent, 'lastEvent') } : {}),
      ...(dto.payload !== undefined ? { payload: dto.payload } : {}),
      actorId: actorIdValue(req),
    });
    if (!workflow) throw new NotFoundException('Module operation workflow not found');
    return this.serializeWorkflow(workflow);
  }

  private getTenantId(req: Request): Uuid {
    return new Uuid((req.tenantId as string | undefined) ?? '00000000-0000-0000-0000-000000000001');
  }

  private assertAdminScope(req: Request): void {
    const roles = req.actor?.roles ?? [];
    if (!roles.some((role) => ADMIN_OPERATION_ROLES.has(role))) {
      throw new ForbiddenException('Admin module operations require an HR administrator role');
    }
  }

  private normalizeModuleId(value: string): string {
    const moduleId = requiredString(value, 'moduleId').toLowerCase();
    if (!/^[a-z0-9-]+$/.test(moduleId)) {
      throw new BadRequestException('moduleId must contain only lowercase letters, numbers, and dashes');
    }
    return moduleId;
  }

  private normalizeUuid(value: string, field: string): Uuid {
    if (!Uuid.isValid(value)) throw new BadRequestException(`${field} must be a valid UUID`);
    return new Uuid(value);
  }

  private serializeDate(value: Date): string {
    return value.toISOString();
  }

  private serializeRecord(record: AdminModuleOperationRecord) {
    return {
      id: record.id,
      moduleId: record.module_id,
      objectType: record.object_type,
      ownerRole: record.owner_role,
      workflowName: record.workflow_name,
      status: record.status,
      risk: record.risk,
      lastEvent: record.last_event,
      source: record.source,
      nativeSource: record.native_source,
      nativeId: record.native_record_id,
      nativeRoute: record.native_route,
      payload: record.payload,
      aggregateVersion: record.aggregate_version,
      createdAt: this.serializeDate(record.created_at),
      updatedAt: this.serializeDate(record.updated_at),
    };
  }

  private serializeWorkflow(workflow: AdminModuleOperationWorkflow) {
    return {
      id: workflow.id,
      moduleId: workflow.module_id,
      workflowName: workflow.workflow_name,
      ownerRole: workflow.owner_role,
      state: workflow.state,
      slaTarget: workflow.sla_target,
      lastEvent: workflow.last_event,
      payload: workflow.payload,
      aggregateVersion: workflow.aggregate_version,
      createdAt: this.serializeDate(workflow.created_at),
      updatedAt: this.serializeDate(workflow.updated_at),
    };
  }
}

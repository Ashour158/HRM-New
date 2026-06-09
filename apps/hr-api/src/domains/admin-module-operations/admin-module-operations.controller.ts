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
  type AdminModuleOperationControl,
  type OperationControlStatus,
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

type CreateControlDto = {
  controlName?: string;
  controlType?: string;
  ownerRole?: string;
  status?: OperationControlStatus;
  lastEvent?: string;
  payload?: unknown;
};

type UpdateControlDto = Partial<CreateControlDto>;

type SerializedOperationRecord = {
  id: string;
  moduleId: string;
  objectType: string;
  ownerRole: string;
  workflowName: string;
  status: OperationRecordStatus;
  risk: OperationRisk;
  lastEvent: string;
  source: string;
  nativeSource: string | null;
  nativeId: string | null;
  nativeRoute: string | null;
  payload: unknown;
  aggregateVersion: number;
  createdAt: string;
  updatedAt: string;
};

type SerializedOperationWorkflow = {
  id: string;
  moduleId: string;
  workflowName: string;
  ownerRole: string;
  state: OperationWorkflowState;
  slaTarget: string;
  lastEvent: string;
  payload: unknown;
  aggregateVersion: number;
  createdAt: string;
  updatedAt: string;
};

type SerializedOperationControl = {
  id: string;
  moduleId: string;
  controlName: string;
  controlType: string;
  ownerRole: string;
  status: OperationControlStatus;
  lastEvent: string;
  payload: unknown;
  aggregateVersion: number;
  createdAt: string;
  updatedAt: string;
};

type ModuleDepthCapabilityStatus = 'Ready' | 'Needs Work' | 'Blocked';
type ModuleDepthStatus = ModuleDepthCapabilityStatus;

type ModuleDepthCapability = {
  code: 'records' | 'workflows' | 'nativeWiring' | 'ownership' | 'riskControls' | 'governanceControls';
  label: string;
  status: ModuleDepthCapabilityStatus;
  evidence: string;
};

type ModuleDepthSummary = {
  score: number;
  status: ModuleDepthStatus;
  capabilities: ModuleDepthCapability[];
  blockers: string[];
  nextActions: string[];
};

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
const CONTROL_STATUSES: OperationControlStatus[] = ['Draft', 'In Review', 'Approved', 'Applied'];

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
    const [records, workflows, controls] = await Promise.all([
      this.repository.findRecords(tenantId, moduleId),
      this.repository.findWorkflows(tenantId, moduleId),
      this.repository.findControls(tenantId, moduleId),
    ]);

    const serializedRecords = records.map((record) => this.serializeRecord(record));
    const serializedWorkflows = workflows.map((workflow) => this.serializeWorkflow(workflow));
    const serializedControls = controls.map((control) => this.serializeControl(control));

    return {
      moduleId,
      records: serializedRecords,
      workflows: serializedWorkflows,
      controls: serializedControls,
      moduleDepth: this.buildModuleDepth(serializedRecords, serializedWorkflows, serializedControls),
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

  @Post(':moduleId/controls')
  async createControl(@Param('moduleId') moduleIdParam: string, @Body() dto: CreateControlDto, @Req() req: Request) {
    const moduleId = this.normalizeModuleId(moduleIdParam);
    this.assertAdminScope(req);
    const control = await this.repository.createControl({
      tenantId: this.getTenantId(req),
      moduleId,
      controlName: requiredString(dto.controlName, 'controlName'),
      controlType: requiredString(dto.controlType, 'controlType'),
      ownerRole: requiredString(dto.ownerRole, 'ownerRole'),
      status: optionalEnum(dto.status, CONTROL_STATUSES, 'status', 'Draft') ?? 'Draft',
      lastEvent: typeof dto.lastEvent === 'string' && dto.lastEvent.trim() ? dto.lastEvent.trim() : 'Control drafted',
      payload: dto.payload ?? {},
      actorId: actorIdValue(req),
    });
    return this.serializeControl(control);
  }

  @Patch(':moduleId/controls/:controlId')
  async updateControl(
    @Param('moduleId') moduleIdParam: string,
    @Param('controlId') controlIdParam: string,
    @Body() dto: UpdateControlDto,
    @Req() req: Request,
  ) {
    const moduleId = this.normalizeModuleId(moduleIdParam);
    const controlId = this.normalizeUuid(controlIdParam, 'controlId');
    this.assertAdminScope(req);
    const control = await this.repository.updateControl(this.getTenantId(req), moduleId, controlId, {
      ...(dto.controlName !== undefined ? { controlName: requiredString(dto.controlName, 'controlName') } : {}),
      ...(dto.controlType !== undefined ? { controlType: requiredString(dto.controlType, 'controlType') } : {}),
      ...(dto.ownerRole !== undefined ? { ownerRole: requiredString(dto.ownerRole, 'ownerRole') } : {}),
      ...(dto.status !== undefined ? { status: optionalEnum(dto.status, CONTROL_STATUSES, 'status') } : {}),
      ...(dto.lastEvent !== undefined ? { lastEvent: requiredString(dto.lastEvent, 'lastEvent') } : {}),
      ...(dto.payload !== undefined ? { payload: dto.payload } : {}),
      actorId: actorIdValue(req),
    });
    if (!control) throw new NotFoundException('Module governance control not found');
    return this.serializeControl(control);
  }

  @Post(':moduleId/controls/:controlId/commands/submit-review')
  async submitControlForReview(
    @Param('moduleId') moduleIdParam: string,
    @Param('controlId') controlIdParam: string,
    @Req() req: Request,
  ) {
    return this.advanceControl(moduleIdParam, controlIdParam, req, {
      expectedStatus: 'Draft',
      nextStatus: 'In Review',
      lastEvent: 'Control submitted for review',
    });
  }

  @Post(':moduleId/controls/:controlId/commands/approve')
  async approveControl(
    @Param('moduleId') moduleIdParam: string,
    @Param('controlId') controlIdParam: string,
    @Req() req: Request,
  ) {
    return this.advanceControl(moduleIdParam, controlIdParam, req, {
      expectedStatus: 'In Review',
      nextStatus: 'Approved',
      lastEvent: 'Control approved',
    });
  }

  @Post(':moduleId/controls/:controlId/commands/apply')
  async applyControl(
    @Param('moduleId') moduleIdParam: string,
    @Param('controlId') controlIdParam: string,
    @Req() req: Request,
  ) {
    return this.advanceControl(moduleIdParam, controlIdParam, req, {
      expectedStatus: 'Approved',
      nextStatus: 'Applied',
      lastEvent: 'Control applied',
    });
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

  private serializeRecord(record: AdminModuleOperationRecord): SerializedOperationRecord {
    return {
      id: record.id,
      moduleId: record.module_id,
      objectType: record.object_type,
      ownerRole: record.owner_role,
      workflowName: record.workflow_name,
      status: record.status as OperationRecordStatus,
      risk: record.risk as OperationRisk,
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

  private serializeWorkflow(workflow: AdminModuleOperationWorkflow): SerializedOperationWorkflow {
    return {
      id: workflow.id,
      moduleId: workflow.module_id,
      workflowName: workflow.workflow_name,
      ownerRole: workflow.owner_role,
      state: workflow.state as OperationWorkflowState,
      slaTarget: workflow.sla_target,
      lastEvent: workflow.last_event,
      payload: workflow.payload,
      aggregateVersion: workflow.aggregate_version,
      createdAt: this.serializeDate(workflow.created_at),
      updatedAt: this.serializeDate(workflow.updated_at),
    };
  }

  private serializeControl(control: AdminModuleOperationControl): SerializedOperationControl {
    return {
      id: control.id,
      moduleId: control.module_id,
      controlName: control.control_name,
      controlType: control.control_type,
      ownerRole: control.owner_role,
      status: control.status as OperationControlStatus,
      lastEvent: control.last_event,
      payload: control.payload,
      aggregateVersion: control.aggregate_version,
      createdAt: this.serializeDate(control.created_at),
      updatedAt: this.serializeDate(control.updated_at),
    };
  }

  private async advanceControl(
    moduleIdParam: string,
    controlIdParam: string,
    req: Request,
    transition: {
      expectedStatus: OperationControlStatus;
      nextStatus: OperationControlStatus;
      lastEvent: string;
    },
  ): Promise<SerializedOperationControl> {
    const moduleId = this.normalizeModuleId(moduleIdParam);
    const controlId = this.normalizeUuid(controlIdParam, 'controlId');
    this.assertAdminScope(req);
    const tenantId = this.getTenantId(req);
    const existingControl = await this.repository.findControl(tenantId, moduleId, controlId);
    if (!existingControl) throw new NotFoundException('Module governance control not found');
    if (existingControl.status !== transition.expectedStatus) {
      throw new BadRequestException(`Control must be ${transition.expectedStatus} before it can move to ${transition.nextStatus}`);
    }
    const control = await this.repository.updateControl(tenantId, moduleId, controlId, {
      status: transition.nextStatus,
      lastEvent: transition.lastEvent,
      actorId: actorIdValue(req),
    });
    if (!control) throw new NotFoundException('Module governance control not found');
    return this.serializeControl(control);
  }

  private buildModuleDepth(
    records: SerializedOperationRecord[],
    workflows: SerializedOperationWorkflow[],
    controls: SerializedOperationControl[],
  ): ModuleDepthSummary {
    const blockers: string[] = [];
    const nextActions: string[] = [];
    const recordsCapability = this.recordsCapability(records, blockers, nextActions);
    const workflowsCapability = this.workflowsCapability(workflows, blockers, nextActions);
    const nativeWiringCapability = this.nativeWiringCapability(records, nextActions);
    const ownershipCapability = this.ownershipCapability(records, workflows, nextActions);
    const riskControlsCapability = this.riskControlsCapability(records, nextActions);
    const governanceControlsCapability = this.governanceControlsCapability(controls, blockers, nextActions);
    const capabilities: ModuleDepthCapability[] = [
      recordsCapability,
      workflowsCapability,
      nativeWiringCapability,
      ownershipCapability,
      riskControlsCapability,
      governanceControlsCapability,
    ];
    const score = Math.round(
      capabilities.reduce((total, capability) => total + this.capabilityScore(capability.status), 0) / capabilities.length,
    );
    const status: ModuleDepthStatus = capabilities.some((capability) => capability.status === 'Blocked')
      ? 'Blocked'
      : capabilities.some((capability) => capability.status === 'Needs Work')
        ? 'Needs Work'
        : 'Ready';

    return {
      score,
      status,
      capabilities,
      blockers,
      nextActions: Array.from(new Set(nextActions)),
    };
  }

  private recordsCapability(
    records: SerializedOperationRecord[],
    blockers: string[],
    nextActions: string[],
  ): ModuleDepthCapability {
    if (records.length === 0) {
      blockers.push('No operational records are available for this module.');
      nextActions.push('Create or sync the first operational record for this module.');
      return {
        code: 'records',
        label: 'Operational records',
        status: 'Blocked',
        evidence: 'No persisted records were found.',
      };
    }
    return {
      code: 'records',
      label: 'Operational records',
      status: 'Ready',
      evidence: `${records.length} persisted record${records.length === 1 ? '' : 's'} available.`,
    };
  }

  private workflowsCapability(
    workflows: SerializedOperationWorkflow[],
    blockers: string[],
    nextActions: string[],
  ): ModuleDepthCapability {
    if (workflows.length === 0) {
      blockers.push('No operational workflows are configured for this module.');
      nextActions.push('Sync the workflow blueprint or create the first workflow owner queue.');
      return {
        code: 'workflows',
        label: 'Workflow coverage',
        status: 'Blocked',
        evidence: 'No persisted workflows were found.',
      };
    }
    return {
      code: 'workflows',
      label: 'Workflow coverage',
      status: 'Ready',
      evidence: `${workflows.length} workflow${workflows.length === 1 ? '' : 's'} configured.`,
    };
  }

  private nativeWiringCapability(
    records: SerializedOperationRecord[],
    nextActions: string[],
  ): ModuleDepthCapability {
    if (records.length === 0) {
      return {
        code: 'nativeWiring',
        label: 'Native module wiring',
        status: 'Blocked',
        evidence: 'No records exist to verify native module wiring.',
      };
    }
    const nativeRecords = records.filter((record) => record.source === 'native' && record.nativeSource && record.nativeId);
    if (nativeRecords.length === 0) {
      nextActions.push('Link operational records to their native module objects before marking the module as fully wired.');
      return {
        code: 'nativeWiring',
        label: 'Native module wiring',
        status: 'Needs Work',
        evidence: 'Records exist, but no native module linkage was found.',
      };
    }
    return {
      code: 'nativeWiring',
      label: 'Native module wiring',
      status: 'Ready',
      evidence: `${nativeRecords.length} native module link${nativeRecords.length === 1 ? '' : 's'} verified.`,
    };
  }

  private ownershipCapability(
    records: SerializedOperationRecord[],
    workflows: SerializedOperationWorkflow[],
    nextActions: string[],
  ): ModuleDepthCapability {
    const missingRecordOwners = records.filter((record) => record.ownerRole.trim().length === 0).length;
    const missingWorkflowOwners = workflows.filter((workflow) => workflow.ownerRole.trim().length === 0).length;
    const missingOwners = missingRecordOwners + missingWorkflowOwners;
    if (missingOwners > 0) {
      nextActions.push('Assign owners to every operation record and workflow before production use.');
      return {
        code: 'ownership',
        label: 'Ownership',
        status: 'Needs Work',
        evidence: `${missingOwners} item${missingOwners === 1 ? '' : 's'} missing an owner.`,
      };
    }
    if (records.length === 0 && workflows.length === 0) {
      return {
        code: 'ownership',
        label: 'Ownership',
        status: 'Blocked',
        evidence: 'No records or workflows exist to verify ownership.',
      };
    }
    return {
      code: 'ownership',
      label: 'Ownership',
      status: 'Ready',
      evidence: 'All records and workflows have accountable owners.',
    };
  }

  private riskControlsCapability(
    records: SerializedOperationRecord[],
    nextActions: string[],
  ): ModuleDepthCapability {
    const highRiskCount = records.filter((record) => record.risk === 'High' || record.status === 'Blocked').length;
    if (highRiskCount > 0) {
      nextActions.push('Resolve blocked or high-risk operation records before closing the module readiness review.');
      return {
        code: 'riskControls',
        label: 'Risk controls',
        status: 'Needs Work',
        evidence: `${highRiskCount} blocked or high-risk item${highRiskCount === 1 ? '' : 's'} need review.`,
      };
    }
    if (records.length === 0) {
      return {
        code: 'riskControls',
        label: 'Risk controls',
        status: 'Blocked',
        evidence: 'No records exist to verify risk controls.',
      };
    }
    return {
      code: 'riskControls',
      label: 'Risk controls',
      status: 'Ready',
      evidence: 'No blocked or high-risk operation records are open.',
    };
  }

  private governanceControlsCapability(
    controls: SerializedOperationControl[],
    blockers: string[],
    nextActions: string[],
  ): ModuleDepthCapability {
    if (controls.length === 0) {
      blockers.push('No governance controls are configured for this module.');
      nextActions.push('Create and apply the governance controls that protect this module.');
      return {
        code: 'governanceControls',
        label: 'Governance controls',
        status: 'Blocked',
        evidence: 'No governed controls were found.',
      };
    }
    const unappliedControls = controls.filter((control) => control.status !== 'Applied').length;
    if (unappliedControls > 0) {
      nextActions.push('Review, approve, and apply every governance control before production use.');
      return {
        code: 'governanceControls',
        label: 'Governance controls',
        status: 'Needs Work',
        evidence: `${unappliedControls} control${unappliedControls === 1 ? '' : 's'} not applied yet.`,
      };
    }
    return {
      code: 'governanceControls',
      label: 'Governance controls',
      status: 'Ready',
      evidence: `${controls.length} applied control${controls.length === 1 ? '' : 's'} protecting this module.`,
    };
  }

  private capabilityScore(status: ModuleDepthCapabilityStatus): number {
    if (status === 'Ready') return 100;
    if (status === 'Needs Work') return 60;
    return 0;
  }
}

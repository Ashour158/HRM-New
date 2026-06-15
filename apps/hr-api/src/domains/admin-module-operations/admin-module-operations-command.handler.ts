import { BadRequestException, Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import type { CommandResult, HrCommandEnvelope } from '@hcm/command-contracts';
import { Uuid } from '@hcm/shared-kernel';
import { CommandBus, type CommandHandler as ICommandHandler } from '../../platform/command-bus/command-bus.js';
import {
  AdminModuleOperationsRepository,
  type AdminModuleOperationControl,
  type AdminModuleOperationRecord,
  type AdminModuleOperationWorkflow,
  type CreateOperationControlInput,
  type CreateOperationRecordInput,
  type CreateOperationWorkflowInput,
  type OperationControlStatus,
  type UpdateOperationControlInput,
  type UpdateOperationRecordInput,
  type UpdateOperationWorkflowInput,
} from './admin-module-operations.repository.js';
import { NativeModuleOperationAdapterService, type NativeOperationAction } from './native-module-operation-adapter.service.js';

export const ADMIN_MODULE_OPERATION_COMMAND_NAMES = [
  'ImportAdminModuleOperationRecords',
  'CreateAdminModuleOperationRecord',
  'UpdateAdminModuleOperationRecord',
  'UpsertAdminModuleOperationWorkflow',
  'UpdateAdminModuleOperationWorkflow',
  'CreateAdminModuleOperationControl',
  'UpdateAdminModuleOperationControl',
  'AdvanceAdminModuleOperationControl',
] as const;

type AdminModuleOperationPayload = {
  moduleId: string;
  records?: Omit<CreateOperationRecordInput, 'tenantId'>[];
  record?: Omit<CreateOperationRecordInput, 'tenantId'>;
  recordId?: string;
  recordUpdate?: UpdateOperationRecordInput;
  nativeStatus?: string;
  nativeOperationAction?: NativeOperationAction;
  workflow?: Omit<CreateOperationWorkflowInput, 'tenantId'>;
  workflowId?: string;
  workflowUpdate?: UpdateOperationWorkflowInput;
  control?: Omit<CreateOperationControlInput, 'tenantId'>;
  controlId?: string;
  controlUpdate?: UpdateOperationControlInput;
  controlTransition?: {
    expectedStatus: OperationControlStatus;
    nextStatus: OperationControlStatus;
    lastEvent: string;
  };
  actorId?: string;
  actor?: HrCommandEnvelope<unknown>['actor'];
};

@Injectable()
export class AdminModuleOperationsCommandHandler implements ICommandHandler, OnModuleInit {
  readonly commandName = 'AdminModuleOperationsCommand';

  constructor(
    private readonly repository: AdminModuleOperationsRepository,
    private readonly nativeAdapter: NativeModuleOperationAdapterService,
    private readonly commandBus: CommandBus,
  ) {}

  onModuleInit(): void {
    for (const commandName of ADMIN_MODULE_OPERATION_COMMAND_NAMES) {
      this.commandBus.registerHandler(commandName, this);
    }
  }

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>> {
    const data = await this.execute(command, command.payload as AdminModuleOperationPayload);
    return {
      success: true,
      data,
      commandId: command.commandId,
      correlationId: command.correlationId,
      aggregateId: this.aggregateId(command, data),
      newState: this.state(data),
      newVersion: this.version(data),
      allowedNextActions: ['ReviewAdminModuleOperations'],
      fieldAccessDecisions: {},
      eventsEmitted: [command.commandName],
      auditRecordId: Uuid.generate(),
    };
  }

  private async execute(command: HrCommandEnvelope<unknown>, payload: AdminModuleOperationPayload): Promise<unknown> {
    switch (command.commandName) {
      case 'ImportAdminModuleOperationRecords':
        return this.repository.createRecords((payload.records ?? []).map((record) => ({
          ...record,
          tenantId: command.tenantId,
        })));
      case 'CreateAdminModuleOperationRecord':
        if (!payload.record) throw new BadRequestException('record payload is required');
        return this.repository.createRecord({ ...payload.record, tenantId: command.tenantId });
      case 'UpdateAdminModuleOperationRecord':
        return this.updateRecord(command.tenantId, payload);
      case 'UpsertAdminModuleOperationWorkflow':
        if (!payload.workflow) throw new BadRequestException('workflow payload is required');
        return this.repository.upsertWorkflow({ ...payload.workflow, tenantId: command.tenantId });
      case 'UpdateAdminModuleOperationWorkflow':
        return this.updateWorkflow(command.tenantId, payload);
      case 'CreateAdminModuleOperationControl':
        if (!payload.control) throw new BadRequestException('control payload is required');
        return this.repository.createControl({ ...payload.control, tenantId: command.tenantId });
      case 'UpdateAdminModuleOperationControl':
        return this.updateControl(command.tenantId, payload);
      case 'AdvanceAdminModuleOperationControl':
        return this.advanceControl(command.tenantId, payload);
      default:
        throw new Error(`Unsupported admin module operation command ${command.commandName}`);
    }
  }

  private async updateRecord(tenantId: Uuid, payload: AdminModuleOperationPayload): Promise<AdminModuleOperationRecord> {
    const recordId = this.uuid(payload.recordId, 'recordId');
    const existingRecord = await this.repository.findRecord(tenantId, payload.moduleId, recordId);
    if (!existingRecord) throw new NotFoundException('Module operation record not found');

    if (existingRecord.source === 'native') {
      if (payload.nativeStatus === undefined) {
        throw new BadRequestException('Native operation records can only be advanced by status through this workspace');
      }
      if (!existingRecord.native_source || !existingRecord.native_record_id) {
        throw new BadRequestException('Native operation record is missing source linkage');
      }
      const applied = await this.nativeAdapter.applyRecordStatusUpdate(
        tenantId,
        payload.moduleId,
        existingRecord.native_source,
        existingRecord.native_record_id,
        payload.nativeStatus as never,
        payload.actor,
        payload.nativeOperationAction,
      );
      if (!applied) {
        throw new BadRequestException('Native operation status cannot be updated through this workspace for this source');
      }
      await this.nativeAdapter.syncNativeRecords(tenantId, payload.moduleId, payload.actorId);
      return (await this.repository.findRecord(tenantId, payload.moduleId, recordId)) ?? existingRecord;
    }

    const record = await this.repository.updateRecord(tenantId, payload.moduleId, recordId, payload.recordUpdate ?? {});
    if (!record) throw new NotFoundException('Module operation record not found');
    return record;
  }

  private async updateWorkflow(tenantId: Uuid, payload: AdminModuleOperationPayload): Promise<AdminModuleOperationWorkflow> {
    const workflow = await this.repository.updateWorkflow(
      tenantId,
      payload.moduleId,
      this.uuid(payload.workflowId, 'workflowId'),
      payload.workflowUpdate ?? {},
    );
    if (!workflow) throw new NotFoundException('Module operation workflow not found');
    return workflow;
  }

  private async updateControl(tenantId: Uuid, payload: AdminModuleOperationPayload): Promise<AdminModuleOperationControl> {
    const control = await this.repository.updateControl(
      tenantId,
      payload.moduleId,
      this.uuid(payload.controlId, 'controlId'),
      payload.controlUpdate ?? {},
    );
    if (!control) throw new NotFoundException('Module governance control not found');
    return control;
  }

  private async advanceControl(tenantId: Uuid, payload: AdminModuleOperationPayload): Promise<AdminModuleOperationControl> {
    if (!payload.controlTransition) throw new BadRequestException('controlTransition payload is required');
    const controlId = this.uuid(payload.controlId, 'controlId');
    const control = await this.repository.updateControlIfStatus(
      tenantId,
      payload.moduleId,
      controlId,
      payload.controlTransition.expectedStatus,
      {
        status: payload.controlTransition.nextStatus,
        lastEvent: payload.controlTransition.lastEvent,
        actorId: payload.actorId,
      },
    );
    if (!control) {
      const existingControl = await this.repository.findControl(tenantId, payload.moduleId, controlId);
      if (!existingControl) throw new NotFoundException('Module governance control not found');
      throw new BadRequestException(`Control must be ${payload.controlTransition.expectedStatus} before it can move to ${payload.controlTransition.nextStatus}`);
    }
    return control;
  }

  private uuid(value: string | undefined, field: string): Uuid {
    if (!value || !Uuid.isValid(value)) throw new BadRequestException(`${field} must be a valid UUID`);
    return new Uuid(value);
  }

  private aggregateId(command: HrCommandEnvelope<unknown>, data: unknown): Uuid {
    const record = typeof data === 'object' && data !== null
      ? Array.isArray(data)
        ? data[0] as Record<string, unknown> | undefined
        : data as Record<string, unknown>
      : undefined;
    const id = typeof record?.id === 'string' ? record.id : undefined;
    return id && Uuid.isValid(id) ? new Uuid(id) : command.aggregateId ?? command.tenantId;
  }

  private state(data: unknown): string {
    const record = typeof data === 'object' && data !== null
      ? Array.isArray(data)
        ? data[0] as Record<string, unknown> | undefined
        : data as Record<string, unknown>
      : undefined;
    const state = record?.status ?? record?.state;
    return typeof state === 'string' ? state : 'COMPLETED';
  }

  private version(data: unknown): number {
    const record = typeof data === 'object' && data !== null
      ? Array.isArray(data)
        ? data[0] as Record<string, unknown> | undefined
        : data as Record<string, unknown>
      : undefined;
    const version = record?.aggregate_version;
    return typeof version === 'number' && Number.isFinite(version) ? version : 1;
  }
}

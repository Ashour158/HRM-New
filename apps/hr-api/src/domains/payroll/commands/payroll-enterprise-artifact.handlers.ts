import { BadRequestException, Injectable } from '@nestjs/common';
import type { CommandResult, HrCommandEnvelope } from '@hcm/command-contracts';
import { Uuid } from '@hcm/shared-kernel';
import { CommandHandler } from '../../../platform/command-bus/command-handler.decorator.js';
import type { CommandHandler as ICommandHandler } from '../../../platform/command-bus/command-bus.js';
import { PayrollPaymentBatchRepository } from '../repositories/payroll-payment-batch.repository.js';
import { PayrollPayslipArtifactRepository } from '../repositories/payroll-payslip-artifact.repository.js';
import { PayrollExportJobRepository } from '../repositories/payroll-export-job.repository.js';
import { PayrollGlPostingRepository } from '../repositories/payroll-gl-posting.repository.js';
import {
  PayrollArtifactService,
  type PayrollExportJobRecord,
  type PayrollPaymentBatchRecord,
  type PayrollPayslipArtifactRecord,
} from '../services/payroll-artifact.service.js';
import { PayrollBankFileService, type PayrollBankFileFormat } from '../services/payroll-bank-file.service.js';
import {
  PayrollEnterpriseWorkflowService,
  type PayrollReconciliationRow,
} from '../services/payroll-enterprise-workflow.service.js';
import type { PayrollGlPostingRecord } from '../services/payroll-gl-posting.service.js';

type PaymentBatchPayload = { paymentBatchId: string };
type ExportPaymentBatchPayload = PaymentBatchPayload & { format?: PayrollBankFileFormat };
type ReconcilePaymentBatchPayload = PaymentBatchPayload & { rows?: PayrollReconciliationRow[] };
type CreatePaymentBatchPayload = { record: PayrollPaymentBatchRecord };
type GeneratePayslipArtifactsPayload = { payrollCycleId: string; records: PayrollPayslipArtifactRecord[] };
type PayrollCyclePayload = { payrollCycleId: string };
type CreateGlPostingPayload = { record: PayrollGlPostingRecord };
type SaveExportJobPayload = { record: PayrollExportJobRecord };

abstract class PayrollEnterpriseArtifactHandler<TPayload, TResult> implements ICommandHandler {
  abstract readonly commandName: string;

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<TResult>> {
    const typedCommand = command as HrCommandEnvelope<TPayload>;
    const data = await this.execute(typedCommand);
    return this.result(command, data);
  }

  protected abstract execute(command: HrCommandEnvelope<TPayload>): Promise<TResult>;

  protected actorId(command: HrCommandEnvelope<unknown>): string {
    return command.actor.actorId.value;
  }

  private result(command: HrCommandEnvelope<unknown>, data: TResult): CommandResult<TResult> {
    return {
      success: true,
      data,
      commandId: command.commandId,
      correlationId: command.correlationId,
      aggregateId: this.aggregateId(command, data),
      newState: this.state(data),
      newVersion: 1,
      allowedNextActions: ['ViewPayrollCycle'],
      fieldAccessDecisions: {},
      eventsEmitted: [command.commandName],
      auditRecordId: Uuid.generate(),
    };
  }

  private aggregateId(command: HrCommandEnvelope<unknown>, data: TResult): Uuid {
    const record = typeof data === 'object' && data !== null ? data as Record<string, unknown> : {};
    const id = typeof record.id === 'string'
      ? record.id
      : typeof record.paymentBatchId === 'string'
        ? record.paymentBatchId
        : typeof record.payrollCycleId === 'string'
          ? record.payrollCycleId
          : undefined;
    if (id && Uuid.isValid(id)) {
      return new Uuid(id);
    }
    return command.aggregateId ?? command.tenantId;
  }

  private state(data: TResult): string {
    const record = typeof data === 'object' && data !== null ? data as Record<string, unknown> : {};
    return typeof record.status === 'string' ? record.status : 'COMPLETED';
  }
}

@Injectable()
@CommandHandler('CreatePayrollPaymentBatch')
export class CreatePayrollPaymentBatchHandler extends PayrollEnterpriseArtifactHandler<CreatePaymentBatchPayload, PayrollPaymentBatchRecord> {
  readonly commandName = 'CreatePayrollPaymentBatch';

  constructor(private readonly paymentBatchRepo: PayrollPaymentBatchRepository) {
    super();
  }

  protected async execute(command: HrCommandEnvelope<CreatePaymentBatchPayload>): Promise<PayrollPaymentBatchRecord> {
    await this.paymentBatchRepo.save(command.payload.record);
    return command.payload.record;
  }
}

@Injectable()
@CommandHandler('ApprovePayrollPaymentBatch')
export class ApprovePayrollPaymentBatchHandler extends PayrollEnterpriseArtifactHandler<PaymentBatchPayload, PayrollPaymentBatchRecord> {
  readonly commandName = 'ApprovePayrollPaymentBatch';

  constructor(
    private readonly paymentBatchRepo: PayrollPaymentBatchRepository,
    private readonly payrollEnterpriseWorkflow: PayrollEnterpriseWorkflowService,
  ) {
    super();
  }

  protected async execute(command: HrCommandEnvelope<PaymentBatchPayload>): Promise<PayrollPaymentBatchRecord> {
    const batch = await this.paymentBatchRepo.findById(command.tenantId, new Uuid(command.payload.paymentBatchId));
    if (!batch) throw new BadRequestException('Payment batch not found');
    const approved = this.payrollEnterpriseWorkflow.approvePaymentBatch(batch, this.actorId(command));
    await this.paymentBatchRepo.save(approved);
    return approved;
  }
}

@Injectable()
@CommandHandler('ExportPayrollPaymentBatch')
export class ExportPayrollPaymentBatchHandler extends PayrollEnterpriseArtifactHandler<ExportPaymentBatchPayload, {
  paymentBatch: PayrollPaymentBatchRecord;
  fileName: string;
  contentType: string;
  content: string;
  rowCount: number;
  events: string[];
}> {
  readonly commandName = 'ExportPayrollPaymentBatch';

  constructor(
    private readonly paymentBatchRepo: PayrollPaymentBatchRepository,
    private readonly exportJobRepo: PayrollExportJobRepository,
    private readonly payrollEnterpriseWorkflow: PayrollEnterpriseWorkflowService,
    private readonly payrollBankFile: PayrollBankFileService,
    private readonly payrollArtifact: PayrollArtifactService,
  ) {
    super();
  }

  protected async execute(command: HrCommandEnvelope<ExportPaymentBatchPayload>) {
    const batch = await this.paymentBatchRepo.findById(command.tenantId, new Uuid(command.payload.paymentBatchId));
    if (!batch) throw new BadRequestException('Payment batch not found');
    const format = command.payload.format ?? 'CSV';
    const bankFile = this.payrollBankFile.render(batch, format);
    const exported = this.payrollEnterpriseWorkflow.markPaymentBatchExported(batch, format, this.actorId(command));
    await this.paymentBatchRepo.save(exported);
    await this.exportJobRepo.save(this.payrollArtifact.buildExportJobRecord({
      tenantId: command.tenantId.value,
      payrollCycleId: batch.payrollCycleId,
      requestedBy: this.actorId(command),
      exportType: `BANK_PAYMENT_${format}`,
      fileName: bankFile.fileName,
      content: bankFile.content,
      rowCount: bankFile.rowCount,
      filters: { paymentBatchId: command.payload.paymentBatchId, format },
      purpose: 'Approved bank payment file export',
    }));
    return {
      paymentBatch: exported,
      fileName: bankFile.fileName,
      contentType: bankFile.contentType,
      content: bankFile.content,
      rowCount: bankFile.rowCount,
      events: ['PaymentBatchExported', 'PayrollBankFileRendered'],
    };
  }
}

@Injectable()
@CommandHandler('ReconcilePayrollPaymentBatch')
export class ReconcilePayrollPaymentBatchHandler extends PayrollEnterpriseArtifactHandler<ReconcilePaymentBatchPayload, PayrollPaymentBatchRecord> {
  readonly commandName = 'ReconcilePayrollPaymentBatch';

  constructor(
    private readonly paymentBatchRepo: PayrollPaymentBatchRepository,
    private readonly payrollEnterpriseWorkflow: PayrollEnterpriseWorkflowService,
  ) {
    super();
  }

  protected async execute(command: HrCommandEnvelope<ReconcilePaymentBatchPayload>): Promise<PayrollPaymentBatchRecord> {
    const batch = await this.paymentBatchRepo.findById(command.tenantId, new Uuid(command.payload.paymentBatchId));
    if (!batch) throw new BadRequestException('Payment batch not found');
    const reconciled = this.payrollEnterpriseWorkflow.reconcilePaymentBatch(
      batch,
      command.payload.rows ?? [],
      this.actorId(command),
    );
    await this.paymentBatchRepo.save(reconciled);
    return reconciled;
  }
}

@Injectable()
@CommandHandler('GeneratePayrollPayslipArtifacts')
export class GeneratePayrollPayslipArtifactsHandler extends PayrollEnterpriseArtifactHandler<GeneratePayslipArtifactsPayload, {
  payrollCycleId: string;
  generatedCount: number;
  artifacts: Array<{ id: string; workerId: string; employeeId: string; status: string }>;
}> {
  readonly commandName = 'GeneratePayrollPayslipArtifacts';

  constructor(private readonly payslipArtifactRepo: PayrollPayslipArtifactRepository) {
    super();
  }

  protected async execute(command: HrCommandEnvelope<GeneratePayslipArtifactsPayload>) {
    await this.payslipArtifactRepo.saveMany(command.payload.records);
    return {
      payrollCycleId: command.payload.payrollCycleId,
      generatedCount: command.payload.records.length,
      artifacts: command.payload.records.map((artifact) => ({
        id: artifact.id,
        workerId: artifact.workerId,
        employeeId: artifact.employeeId,
        status: artifact.status,
      })),
    };
  }
}

@Injectable()
@CommandHandler('PublishPayrollCyclePayslips')
export class PublishPayrollCyclePayslipsHandler extends PayrollEnterpriseArtifactHandler<PayrollCyclePayload, {
  payrollCycleId: string;
  publishedCount: number;
  artifacts: Array<{ id: string; workerId: string; employeeId: string; status: string; publishedAt?: Date }>;
  events: string[];
}> {
  readonly commandName = 'PublishPayrollCyclePayslips';

  constructor(
    private readonly payslipArtifactRepo: PayrollPayslipArtifactRepository,
    private readonly payrollEnterpriseWorkflow: PayrollEnterpriseWorkflowService,
  ) {
    super();
  }

  protected async execute(command: HrCommandEnvelope<PayrollCyclePayload>) {
    const artifacts = await this.payslipArtifactRepo.findByPayrollCycle(command.tenantId, new Uuid(command.payload.payrollCycleId));
    const published = artifacts.map((artifact) => (
      artifact.status === 'GENERATED'
        ? this.payrollEnterpriseWorkflow.publishPayslip(artifact, this.actorId(command))
        : artifact
    ));
    await this.payslipArtifactRepo.saveMany(published);
    return {
      payrollCycleId: command.payload.payrollCycleId,
      publishedCount: published.filter((artifact) => artifact.status === 'PUBLISHED').length,
      artifacts: published.map((artifact) => ({
        id: artifact.id,
        workerId: artifact.workerId,
        employeeId: artifact.employeeId,
        status: artifact.status,
        publishedAt: artifact.publishedAt,
      })),
      events: ['PayrollPayslipsPublished'],
    };
  }
}

@Injectable()
@CommandHandler('SavePayrollExportJob')
export class SavePayrollExportJobHandler extends PayrollEnterpriseArtifactHandler<SaveExportJobPayload, PayrollExportJobRecord> {
  readonly commandName = 'SavePayrollExportJob';

  constructor(private readonly exportJobRepo: PayrollExportJobRepository) {
    super();
  }

  protected async execute(command: HrCommandEnvelope<SaveExportJobPayload>): Promise<PayrollExportJobRecord> {
    await this.exportJobRepo.save(command.payload.record);
    return command.payload.record;
  }
}

@Injectable()
@CommandHandler('CreatePayrollGlPosting')
export class CreatePayrollGlPostingHandler extends PayrollEnterpriseArtifactHandler<CreateGlPostingPayload, PayrollGlPostingRecord & { events: string[] }> {
  readonly commandName = 'CreatePayrollGlPosting';

  constructor(private readonly glPostingRepo: PayrollGlPostingRepository) {
    super();
  }

  protected async execute(command: HrCommandEnvelope<CreateGlPostingPayload>): Promise<PayrollGlPostingRecord & { events: string[] }> {
    await this.glPostingRepo.save(command.payload.record);
    return {
      ...command.payload.record,
      events: ['PayrollGlPostingBuilt'],
    };
  }
}

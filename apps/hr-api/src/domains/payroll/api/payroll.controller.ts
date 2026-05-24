import { Controller, Get, Post, Body, Param, Req, BadRequestException } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { randomUUID } from 'crypto';
import { CommandBus } from '../../../platform/command-bus/command-bus.js';

import { Uuid } from '@hcm/shared-kernel';
import { computeRequestHash } from '@hcm/platform-core';
import type { HrCommandEnvelope } from '@hcm/command-contracts';
import { PayrollCycleRepository } from '../repositories/payroll-cycle.repository.js';
import { PayrollInputRepository } from '../repositories/payroll-input.repository.js';
import { PayrollCalculationRunRepository } from '../repositories/payroll-calculation-run.repository.js';
import { PayrollResultLineRepository } from '../repositories/payroll-result-line.repository.js';
import type * as dtos from './dtos.js';
import {
  CreatePayrollCycleDtoSchema, CreatePayrollInputDtoSchema,
  StartPayrollCalculationRunDtoSchema, CalculatePayrollResultLineDtoSchema, ZodValidationPipe,
} from './dtos.js';

@ApiTags('Payroll')
@Controller('payroll')
export class PayrollController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly payrollCycleRepo: PayrollCycleRepository,
    private readonly payrollInputRepo: PayrollInputRepository,
    private readonly calculationRunRepo: PayrollCalculationRunRepository,
    private readonly resultLineRepo: PayrollResultLineRepository,
  ) {}

  private buildCommand<TPayload>(
    commandName: string,
    aggregateType: string,
    payload: TPayload,
    req: Request,
    options?: { aggregateId?: Uuid; expectedState?: string; expectedVersion?: number; subjectWorkerId?: Uuid },
  ): HrCommandEnvelope<TPayload> {
    const tenantId = new Uuid((req['tenantId'] as string | undefined) ?? '00000000-0000-0000-0000-000000000001');
    return {
      commandId: Uuid.generate(),
      commandName,
      commandSchemaVersion: 1,
      tenantId,
      actor: { actorType: 'SYSTEM', actorId: Uuid.generate(), roles: ['HR_ADMIN'], permissions: ['PAYROLL_WRITE'], mfaAuthenticated: true },
      aggregateType,
      aggregateId: options?.aggregateId,
      expectedState: options?.expectedState,
      expectedVersion: options?.expectedVersion,
      subjectWorkerId: options?.subjectWorkerId,
      idempotencyKey: randomUUID(),
      correlationId: Uuid.generate(),
      reason: 'API request',
      payload,
      metadata: { requestHash: computeRequestHash(payload), clientType: 'HR_ADMIN' },
    };
  }

  /* Payroll Cycles */
  @Post('cycles')
  async createPayrollCycle(@Body(new ZodValidationPipe(CreatePayrollCycleDtoSchema)) dto: dtos.CreatePayrollCycleDto, @Req() req: Request) {
    return this.commandBus.execute(this.buildCommand('CreatePayrollCycle', 'PayrollCycle', dto, req));
  }

  @Post('cycles/:id/commands/open')
  async openPayrollCycle(@Param('id') id: string, @Req() req: Request) {
    const pc = await this.payrollCycleRepo.findById(new Uuid(id));
    if (!pc) throw new BadRequestException('Payroll cycle not found');
    return this.commandBus.execute(this.buildCommand('OpenPayrollCycle', 'PayrollCycle', { payrollCycleId: new Uuid(id) }, req, { aggregateId: new Uuid(id), expectedState: pc.status, expectedVersion: pc.aggregateVersion }));
  }

  @Post('cycles/:id/commands/start-input-collection')
  async startInputCollection(@Param('id') id: string, @Req() req: Request) {
    const pc = await this.payrollCycleRepo.findById(new Uuid(id));
    if (!pc) throw new BadRequestException('Payroll cycle not found');
    return this.commandBus.execute(this.buildCommand('StartPayrollInputCollection', 'PayrollCycle', { payrollCycleId: new Uuid(id) }, req, { aggregateId: new Uuid(id), expectedState: pc.status, expectedVersion: pc.aggregateVersion }));
  }

  @Post('cycles/:id/commands/start-validation')
  async startValidation(@Param('id') id: string, @Req() req: Request) {
    const pc = await this.payrollCycleRepo.findById(new Uuid(id));
    if (!pc) throw new BadRequestException('Payroll cycle not found');
    return this.commandBus.execute(this.buildCommand('StartPayrollValidation', 'PayrollCycle', { payrollCycleId: new Uuid(id) }, req, { aggregateId: new Uuid(id), expectedState: pc.status, expectedVersion: pc.aggregateVersion }));
  }

  @Post('cycles/:id/commands/start-calculation')
  async startCalculation(@Param('id') id: string, @Req() req: Request) {
    const pc = await this.payrollCycleRepo.findById(new Uuid(id));
    if (!pc) throw new BadRequestException('Payroll cycle not found');
    return this.commandBus.execute(this.buildCommand('StartPayrollCalculation', 'PayrollCycle', { payrollCycleId: new Uuid(id) }, req, { aggregateId: new Uuid(id), expectedState: pc.status, expectedVersion: pc.aggregateVersion }));
  }

  @Post('cycles/:id/commands/start-review')
  async startReview(@Param('id') id: string, @Req() req: Request) {
    const pc = await this.payrollCycleRepo.findById(new Uuid(id));
    if (!pc) throw new BadRequestException('Payroll cycle not found');
    return this.commandBus.execute(this.buildCommand('StartPayrollReview', 'PayrollCycle', { payrollCycleId: new Uuid(id) }, req, { aggregateId: new Uuid(id), expectedState: pc.status, expectedVersion: pc.aggregateVersion }));
  }

  @Post('cycles/:id/commands/approve')
  async approvePayrollCycle(@Param('id') id: string, @Req() req: Request) {
    const pc = await this.payrollCycleRepo.findById(new Uuid(id));
    if (!pc) throw new BadRequestException('Payroll cycle not found');
    return this.commandBus.execute(this.buildCommand('ApprovePayrollCycle', 'PayrollCycle', { payrollCycleId: new Uuid(id), approvedBy: Uuid.generate() }, req, { aggregateId: new Uuid(id), expectedState: pc.status, expectedVersion: pc.aggregateVersion }));
  }

  @Post('cycles/:id/commands/close')
  async closePayrollCycle(@Param('id') id: string, @Req() req: Request) {
    const pc = await this.payrollCycleRepo.findById(new Uuid(id));
    if (!pc) throw new BadRequestException('Payroll cycle not found');
    return this.commandBus.execute(this.buildCommand('ClosePayrollCycle', 'PayrollCycle', { payrollCycleId: new Uuid(id) }, req, { aggregateId: new Uuid(id), expectedState: pc.status, expectedVersion: pc.aggregateVersion }));
  }

  @Post('cycles/:id/commands/export')
  async exportPayrollCycle(@Param('id') id: string, @Req() req: Request) {
    const pc = await this.payrollCycleRepo.findById(new Uuid(id));
    if (!pc) throw new BadRequestException('Payroll cycle not found');
    return this.commandBus.execute(this.buildCommand('ExportPayrollCycle', 'PayrollCycle', { payrollCycleId: new Uuid(id) }, req, { aggregateId: new Uuid(id), expectedState: pc.status, expectedVersion: pc.aggregateVersion }));
  }

  @Post('cycles/:id/commands/cancel')
  async cancelPayrollCycle(@Param('id') id: string, @Req() req: Request) {
    const pc = await this.payrollCycleRepo.findById(new Uuid(id));
    if (!pc) throw new BadRequestException('Payroll cycle not found');
    return this.commandBus.execute(this.buildCommand('CancelPayrollCycle', 'PayrollCycle', { payrollCycleId: new Uuid(id) }, req, { aggregateId: new Uuid(id), expectedState: pc.status, expectedVersion: pc.aggregateVersion }));
  }

  @Get('cycles/:id')
  async getPayrollCycle(@Param('id') id: string) {
    return this.payrollCycleRepo.findById(new Uuid(id));
  }

  /* Payroll Inputs */
  @Post('inputs')
  async createPayrollInput(@Body(new ZodValidationPipe(CreatePayrollInputDtoSchema)) dto: dtos.CreatePayrollInputDto, @Req() req: Request) {
    return this.commandBus.execute(this.buildCommand('CreatePayrollInput', 'PayrollInput', dto, req));
  }

  @Post('inputs/:id/commands/submit')
  async submitPayrollInput(@Param('id') id: string, @Req() req: Request) {
    const pi = await this.payrollInputRepo.findById(new Uuid(id));
    if (!pi) throw new BadRequestException('Payroll input not found');
    return this.commandBus.execute(this.buildCommand('SubmitPayrollInput', 'PayrollInput', { payrollInputId: new Uuid(id) }, req, { aggregateId: new Uuid(id), expectedState: pi.status, expectedVersion: pi.aggregateVersion }));
  }

  @Post('inputs/:id/commands/approve')
  async approvePayrollInput(@Param('id') id: string, @Req() req: Request) {
    const pi = await this.payrollInputRepo.findById(new Uuid(id));
    if (!pi) throw new BadRequestException('Payroll input not found');
    return this.commandBus.execute(this.buildCommand('ApprovePayrollInput', 'PayrollInput', { payrollInputId: new Uuid(id) }, req, { aggregateId: new Uuid(id), expectedState: pi.status, expectedVersion: pi.aggregateVersion }));
  }

  @Post('inputs/:id/commands/reject')
  async rejectPayrollInput(@Param('id') id: string, @Req() req: Request) {
    const pi = await this.payrollInputRepo.findById(new Uuid(id));
    if (!pi) throw new BadRequestException('Payroll input not found');
    return this.commandBus.execute(this.buildCommand('RejectPayrollInput', 'PayrollInput', { payrollInputId: new Uuid(id) }, req, { aggregateId: new Uuid(id), expectedState: pi.status, expectedVersion: pi.aggregateVersion }));
  }

  @Post('inputs/:id/commands/correct')
  async correctPayrollInput(@Param('id') id: string, @Req() req: Request) {
    const pi = await this.payrollInputRepo.findById(new Uuid(id));
    if (!pi) throw new BadRequestException('Payroll input not found');
    return this.commandBus.execute(this.buildCommand('CorrectPayrollInput', 'PayrollInput', { payrollInputId: new Uuid(id) }, req, { aggregateId: new Uuid(id), expectedState: pi.status, expectedVersion: pi.aggregateVersion }));
  }

  @Get('inputs/cycle/:cycleId')
  async getPayrollInputsByCycle(@Param('cycleId') cycleId: string) {
    return this.payrollInputRepo.findByPayrollCycle(new Uuid(cycleId));
  }

  /* Calculation Runs */
  @Post('calculation-runs')
  async startCalculationRun(@Body(new ZodValidationPipe(StartPayrollCalculationRunDtoSchema)) dto: dtos.StartPayrollCalculationRunDto, @Req() req: Request) {
    return this.commandBus.execute(this.buildCommand('StartPayrollCalculationRun', 'PayrollCalculationRun', dto, req));
  }

  @Post('calculation-runs/:id/commands/validate')
  async validateCalculationRun(@Param('id') id: string, @Req() req: Request) {
    const run = await this.calculationRunRepo.findById(new Uuid(id));
    if (!run) throw new BadRequestException('Calculation run not found');
    return this.commandBus.execute(this.buildCommand('ValidatePayrollCalculationRun', 'PayrollCalculationRun', { payrollCalculationRunId: new Uuid(id) }, req, { aggregateId: new Uuid(id), expectedState: run.status, expectedVersion: run.aggregateVersion }));
  }

  @Post('calculation-runs/:id/commands/finalize')
  async finalizeCalculationRun(@Param('id') id: string, @Req() req: Request) {
    const run = await this.calculationRunRepo.findById(new Uuid(id));
    if (!run) throw new BadRequestException('Calculation run not found');
    return this.commandBus.execute(this.buildCommand('FinalizePayrollCalculationRun', 'PayrollCalculationRun', { payrollCalculationRunId: new Uuid(id) }, req, { aggregateId: new Uuid(id), expectedState: run.status, expectedVersion: run.aggregateVersion }));
  }

  @Post('calculation-runs/:id/commands/fail')
  async failCalculationRun(@Param('id') id: string, @Req() req: Request) {
    const run = await this.calculationRunRepo.findById(new Uuid(id));
    if (!run) throw new BadRequestException('Calculation run not found');
    return this.commandBus.execute(this.buildCommand('FailPayrollCalculationRun', 'PayrollCalculationRun', { payrollCalculationRunId: new Uuid(id) }, req, { aggregateId: new Uuid(id), expectedState: run.status, expectedVersion: run.aggregateVersion }));
  }

  @Get('calculation-runs/cycle/:cycleId')
  async getCalculationRunsByCycle(@Param('cycleId') cycleId: string) {
    return this.calculationRunRepo.findByPayrollCycle(new Uuid(cycleId));
  }

  /* Result Lines */
  @Post('result-lines')
  async calculateResultLine(@Body(new ZodValidationPipe(CalculatePayrollResultLineDtoSchema)) dto: dtos.CalculatePayrollResultLineDto, @Req() req: Request) {
    return this.commandBus.execute(this.buildCommand('CalculatePayrollResultLine', 'PayrollResultLine', dto, req));
  }

  @Post('result-lines/:id/commands/explain')
  async explainResultLine(@Param('id') id: string, @Body() body: { explanation: string }, @Req() req: Request) {
    const line = await this.resultLineRepo.findById(new Uuid(id));
    if (!line) throw new BadRequestException('Result line not found');
    return this.commandBus.execute(this.buildCommand('ExplainPayrollResultLine', 'PayrollResultLine', { payrollResultLineId: new Uuid(id), explanation: body.explanation }, req, { aggregateId: new Uuid(id), expectedState: line.status, expectedVersion: line.aggregateVersion }));
  }

  @Post('result-lines/:id/commands/review')
  async reviewResultLine(@Param('id') id: string, @Req() req: Request) {
    const line = await this.resultLineRepo.findById(new Uuid(id));
    if (!line) throw new BadRequestException('Result line not found');
    return this.commandBus.execute(this.buildCommand('ReviewPayrollResultLine', 'PayrollResultLine', { payrollResultLineId: new Uuid(id) }, req, { aggregateId: new Uuid(id), expectedState: line.status, expectedVersion: line.aggregateVersion }));
  }

  @Post('result-lines/:id/commands/lock')
  async lockResultLine(@Param('id') id: string, @Req() req: Request) {
    const line = await this.resultLineRepo.findById(new Uuid(id));
    if (!line) throw new BadRequestException('Result line not found');
    return this.commandBus.execute(this.buildCommand('LockPayrollResultLine', 'PayrollResultLine', { payrollResultLineId: new Uuid(id) }, req, { aggregateId: new Uuid(id), expectedState: line.status, expectedVersion: line.aggregateVersion }));
  }

  @Get('result-lines/cycle/:cycleId')
  async getResultLinesByCycle(@Param('cycleId') cycleId: string) {
    return this.resultLineRepo.findByPayrollCycle(new Uuid(cycleId));
  }
}

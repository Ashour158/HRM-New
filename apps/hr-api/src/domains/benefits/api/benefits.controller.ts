import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  Req,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { CommandBus } from '../../../platform/command-bus/command-bus.js';
import { Uuid } from '@hcm/shared-kernel';
import { computeRequestHash } from '@hcm/platform-core';
import type { HrCommandEnvelope } from '@hcm/command-contracts';
import { AuthGuard } from '../../../guards/auth.guard.js';

import { BenefitsProgramRepository } from '../repositories/benefits-program.repository.js';
import { BenefitsEnrollmentRepository } from '../repositories/benefits-enrollment.repository.js';
import { BenefitsLifeEventRepository } from '../repositories/benefits-life-event.repository.js';
import { SpendingAccountRepository } from '../repositories/spending-account.repository.js';
import { CarrierReconciliationRunRepository } from '../repositories/carrier-reconciliation-run.repository.js';

import {
  CreateBenefitsProgramDto,
  ActivateBenefitsProgramDto,
  SuspendBenefitsProgramDto,
  CloseBenefitsProgramDto,
  CreateBenefitsEnrollmentDto,
  CreateBenefitsLifeEventDto,
  ApproveBenefitsEnrollmentDto,
  RejectBenefitsEnrollmentDto,
  TerminateBenefitsEnrollmentDto,
  ProcessBenefitsLifeEventDto,
  RejectBenefitsLifeEventDto,
  CreateSpendingAccountDto,
  RecordSpendingAccountUsageDto,
  CloseSpendingAccountDto,
  CreateCarrierReconciliationRunDto,
  DetectCarrierReconciliationVarianceDto,
  ReconcileCarrierReconciliationRunDto,
  FailCarrierReconciliationRunDto,
} from './dtos.js';

const BENEFITS_ADMIN_ROLES = new Set(['APP_ADMIN', 'PLATFORM_ADMIN', 'SUPER_ADMIN', 'HR_ADMIN', 'HRBP', 'BENEFITS_ADMIN']);

@ApiTags('Benefits')
@UseGuards(AuthGuard)
@Controller('hr/benefits')
export class BenefitsController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly programRepo: BenefitsProgramRepository,
    private readonly enrollmentRepo: BenefitsEnrollmentRepository,
    private readonly lifeEventRepo: BenefitsLifeEventRepository,
    private readonly spendingAccountRepo: SpendingAccountRepository,
    private readonly reconciliationRunRepo: CarrierReconciliationRunRepository,
  ) {}

  private buildCommand<TPayload>(
    req: Request,
    commandName: string,
    aggregateType: string,
    aggregateId: string | undefined,
    payload: TPayload,
    options?: { subjectWorkerId?: Uuid },
  ): HrCommandEnvelope<TPayload> {
    const tenantId = req.tenantId;
    if (!tenantId) {
      throw new BadRequestException('Tenant ID missing');
    }
    const actor = req.actor;
    if (!actor) {
      throw new BadRequestException('Actor missing');
    }
    this.assertBenefitsAdminScope(req);
    return {
      commandId: Uuid.generate(),
      commandName,
      commandSchemaVersion: 1,
      tenantId: new Uuid(tenantId),
      actor,
      subjectWorkerId: options?.subjectWorkerId,
      aggregateType,
      aggregateId: aggregateId ? new Uuid(aggregateId) : undefined,
      idempotencyKey: crypto.randomUUID(),
      correlationId: Uuid.generate(),
      reason: `${commandName} via API`,
      payload,
      metadata: {
        requestHash: computeRequestHash(payload),
        clientType: 'HR_ADMIN',
        hrDataSensitivity: 'LOW',
      },
    };
  }

  /* ---------------------------------------------------------------- */
  /*  Benefits Programs                                                 */
  /* ---------------------------------------------------------------- */

  @Post('programs')
  async createProgram(@Body() dto: CreateBenefitsProgramDto, @Req() req: Request) {
    const command = this.buildCommand(req, 'CreateBenefitsProgram', 'BenefitsProgram', undefined, {
      programId: new Uuid(dto.programId),
      programName: dto.programName,
      programType: dto.programType,
      carrierId: dto.carrierId ? new Uuid(dto.carrierId) : undefined,
      effectiveFrom: dto.effectiveFrom,
      effectiveUntil: dto.effectiveUntil,
      monthlyPremium: dto.monthlyPremium,
      currency: dto.currency,
    });
    return this.commandBus.execute(command);
  }

  @Get('programs')
  async listPrograms(@Req() req: Request) {
    this.assertBenefitsAdminScope(req);
    const tenantId = req.tenantId;
    if (!tenantId) throw new BadRequestException('Tenant ID missing');
    return this.programRepo.findByTenant(new Uuid(tenantId));
  }

  @Get('programs/:id')
  async getProgram(@Param('id') id: string, @Req() req: Request) {
    this.assertBenefitsAdminScope(req);
    const program = await this.programRepo.findById(new Uuid(id));
    if (!program) throw new NotFoundException('BenefitsProgram not found');
    return program;
  }

  @Post('programs/:id/commands/activate')
  async activateProgram(@Param('id') id: string, @Body() _dto: ActivateBenefitsProgramDto = {}, @Req() req: Request) {
    await this.getProgramForCommand(id);
    const command = this.buildCommand(req, 'ActivateBenefitsProgram', 'BenefitsProgram', id, {
      programId: new Uuid(id),
    });
    return this.commandBus.execute(command);
  }

  @Post('programs/:id/commands/suspend')
  async suspendProgram(@Param('id') id: string, @Body() dto: SuspendBenefitsProgramDto = {}, @Req() req: Request) {
    await this.getProgramForCommand(id);
    const command = this.buildCommand(req, 'SuspendBenefitsProgram', 'BenefitsProgram', id, {
      programId: new Uuid(id),
      reason: dto.reason,
    });
    return this.commandBus.execute(command);
  }

  @Post('programs/:id/commands/close')
  async closeProgram(@Param('id') id: string, @Body() dto: CloseBenefitsProgramDto = {}, @Req() req: Request) {
    await this.getProgramForCommand(id);
    const command = this.buildCommand(req, 'CloseBenefitsProgram', 'BenefitsProgram', id, {
      programId: new Uuid(id),
      reason: dto.reason,
    });
    return this.commandBus.execute(command);
  }

  /* ---------------------------------------------------------------- */
  /*  Benefits Enrollments                                              */
  /* ---------------------------------------------------------------- */

  @Post('enrollments')
  async createEnrollment(@Body() dto: CreateBenefitsEnrollmentDto, @Req() req: Request) {
    const workerId = new Uuid(dto.workerId);
    const command = this.buildCommand(req, 'CreateBenefitsEnrollment', 'BenefitsEnrollment', undefined, {
      enrollmentId: new Uuid(dto.enrollmentId),
      workerId,
      programId: new Uuid(dto.programId),
      coverageLevel: dto.coverageLevel,
      dependents: dto.dependents,
      effectiveDate: dto.effectiveDate,
    }, {
      subjectWorkerId: workerId,
    });
    return this.commandBus.execute(command);
  }

  @Post('enrollments/:id/commands/approve')
  async approveEnrollment(@Param('id') id: string, @Body() dto: ApproveBenefitsEnrollmentDto = {}, @Req() req: Request) {
    const enrollment = await this.getEnrollmentForCommand(id);
    const approvedBy = dto.approvedBy ? new Uuid(dto.approvedBy) : this.actorId(req);
    const command = this.buildCommand(req, 'ApproveBenefitsEnrollment', 'BenefitsEnrollment', id, {
      enrollmentId: new Uuid(id),
      approvedBy,
    }, {
      subjectWorkerId: enrollment.workerId,
    });
    return this.commandBus.execute(command);
  }

  @Post('enrollments/:id/commands/reject')
  async rejectEnrollment(@Param('id') id: string, @Body() dto: RejectBenefitsEnrollmentDto = {}, @Req() req: Request) {
    const enrollment = await this.getEnrollmentForCommand(id);
    const command = this.buildCommand(req, 'RejectBenefitsEnrollment', 'BenefitsEnrollment', id, {
      enrollmentId: new Uuid(id),
      rejectedBy: dto.rejectedBy ? new Uuid(dto.rejectedBy) : this.actorId(req),
      reason: dto.reason,
    }, {
      subjectWorkerId: enrollment.workerId,
    });
    return this.commandBus.execute(command);
  }

  @Post('enrollments/:id/commands/make-effective')
  async makeEnrollmentEffective(@Param('id') id: string, @Req() req: Request) {
    const enrollment = await this.getEnrollmentForCommand(id);
    const command = this.buildCommand(req, 'MakeEffectiveBenefitsEnrollment', 'BenefitsEnrollment', id, {
      enrollmentId: new Uuid(id),
    }, {
      subjectWorkerId: enrollment.workerId,
    });
    return this.commandBus.execute(command);
  }

  @Post('enrollments/:id/commands/terminate')
  async terminateEnrollment(@Param('id') id: string, @Body() dto: TerminateBenefitsEnrollmentDto = {}, @Req() req: Request) {
    const enrollment = await this.getEnrollmentForCommand(id);
    const command = this.buildCommand(req, 'TerminateBenefitsEnrollment', 'BenefitsEnrollment', id, {
      enrollmentId: new Uuid(id),
      reason: dto.reason,
    }, {
      subjectWorkerId: enrollment.workerId,
    });
    return this.commandBus.execute(command);
  }

  @Get('enrollments/worker/:workerId')
  async getEnrollmentsByWorker(@Param('workerId') workerId: string, @Req() req: Request) {
    this.assertBenefitsAdminScope(req);
    return this.enrollmentRepo.findByWorker(new Uuid(workerId));
  }

  @Get('enrollments/program/:programId')
  async getEnrollmentsByProgram(@Param('programId') programId: string, @Req() req: Request) {
    this.assertBenefitsAdminScope(req);
    return this.enrollmentRepo.findByProgram(new Uuid(programId));
  }

  @Get('enrollments/:id/allowed-actions')
  async getEnrollmentAllowedActions(@Param('id') id: string, @Req() req: Request) {
    this.assertBenefitsAdminScope(req);
    const enrollment = await this.getEnrollmentForCommand(id);
    const actionsByState: Record<string, string[]> = {
      DRAFT: ['Submit'],
      SUBMITTED: ['Approve', 'Reject'],
      PENDING_APPROVAL: ['Approve', 'Reject'],
      APPROVED: ['MakeEffective', 'Terminate'],
      EFFECTIVE: ['Terminate'],
      TERMINATED: [],
      REJECTED: [],
    };
    return { allowedActions: actionsByState[enrollment.status] ?? [] };
  }

  /* ---------------------------------------------------------------- */
  /*  Benefits Life Events                                              */
  /* ---------------------------------------------------------------- */

  @Post('life-events')
  async createLifeEvent(@Body() dto: CreateBenefitsLifeEventDto, @Req() req: Request) {
    const workerId = new Uuid(dto.workerId);
    const command = this.buildCommand(req, 'CreateBenefitsLifeEvent', 'BenefitsLifeEvent', undefined, {
      lifeEventId: new Uuid(dto.lifeEventId),
      workerId,
      eventType: dto.eventType,
      eventDate: dto.eventDate,
      description: dto.description,
    }, {
      subjectWorkerId: workerId,
    });
    return this.commandBus.execute(command);
  }

  @Post('life-events/:id/commands/process')
  async processLifeEvent(@Param('id') id: string, @Body() dto: ProcessBenefitsLifeEventDto = {}, @Req() req: Request) {
    const event = await this.getLifeEventForCommand(id);
    const command = this.buildCommand(req, 'ProcessBenefitsLifeEvent', 'BenefitsLifeEvent', id, {
      lifeEventId: new Uuid(id),
      processedBy: dto.processedBy ? new Uuid(dto.processedBy) : this.actorId(req),
    }, {
      subjectWorkerId: event.workerId,
    });
    return this.commandBus.execute(command);
  }

  @Post('life-events/:id/commands/reject')
  async rejectLifeEvent(@Param('id') id: string, @Body() dto: RejectBenefitsLifeEventDto = {}, @Req() req: Request) {
    const event = await this.getLifeEventForCommand(id);
    const command = this.buildCommand(req, 'RejectBenefitsLifeEvent', 'BenefitsLifeEvent', id, {
      lifeEventId: new Uuid(id),
      rejectedBy: dto.rejectedBy ? new Uuid(dto.rejectedBy) : this.actorId(req),
      reason: dto.reason,
    }, {
      subjectWorkerId: event.workerId,
    });
    return this.commandBus.execute(command);
  }

  @Get('life-events/worker/:workerId')
  async getLifeEventsByWorker(@Param('workerId') workerId: string, @Req() req: Request) {
    this.assertBenefitsAdminScope(req);
    return this.lifeEventRepo.findByWorker(new Uuid(workerId));
  }

  @Get('life-events/:id/allowed-actions')
  async getLifeEventAllowedActions(@Param('id') id: string, @Req() req: Request) {
    this.assertBenefitsAdminScope(req);
    const event = await this.getLifeEventForCommand(id);
    return { allowedActions: event.status === 'RECORDED' || event.status === 'PENDING_PROCESSING' ? ['Process', 'Reject'] : [] };
  }

  /* ---------------------------------------------------------------- */
  /*  Spending Accounts                                                 */
  /* ---------------------------------------------------------------- */

  @Post('spending-accounts')
  async createSpendingAccount(@Body() dto: CreateSpendingAccountDto, @Req() req: Request) {
    const command = this.buildCommand(req, 'CreateSpendingAccount', 'SpendingAccount', undefined, {
      accountId: new Uuid(dto.accountId),
      workerId: new Uuid(dto.workerId),
      accountType: dto.accountType,
      annualElection: dto.annualElection,
      currency: dto.currency,
    });
    return this.commandBus.execute(command);
  }

  @Get('spending-accounts/worker/:workerId')
  async getSpendingAccountsByWorker(@Param('workerId') workerId: string, @Req() req: Request) {
    this.assertBenefitsAdminScope(req);
    return this.spendingAccountRepo.findByWorker(new Uuid(workerId));
  }

  @Post('spending-accounts/:id/commands/record-usage')
  async recordSpendingAccountUsage(@Param('id') id: string, @Body() dto: RecordSpendingAccountUsageDto, @Req() req: Request) {
    const account = await this.getSpendingAccountForCommand(id);
    const command = this.buildCommand(req, 'RecordSpendingAccountUsage', 'SpendingAccount', id, {
      accountId: new Uuid(id),
      amount: dto.amount,
    }, {
      subjectWorkerId: account.workerId,
    });
    return this.commandBus.execute(command);
  }

  @Post('spending-accounts/:id/commands/close')
  async closeSpendingAccount(@Param('id') id: string, @Body() _dto: CloseSpendingAccountDto = {}, @Req() req: Request) {
    const account = await this.getSpendingAccountForCommand(id);
    const command = this.buildCommand(req, 'CloseSpendingAccount', 'SpendingAccount', id, {
      accountId: new Uuid(id),
    }, {
      subjectWorkerId: account.workerId,
    });
    return this.commandBus.execute(command);
  }

  /* ---------------------------------------------------------------- */
  /*  Carrier Reconciliation Runs                                       */
  /* ---------------------------------------------------------------- */

  @Post('carrier-reconciliation-runs')
  async createCarrierReconciliationRun(@Body() dto: CreateCarrierReconciliationRunDto, @Req() req: Request) {
    const command = this.buildCommand(req, 'CreateCarrierReconciliationRun', 'CarrierReconciliationRun', undefined, {
      runId: new Uuid(dto.runId),
      carrierId: new Uuid(dto.carrierId),
      periodStart: dto.periodStart,
      periodEnd: dto.periodEnd,
      totalPremium: dto.totalPremium,
      totalCollected: dto.totalCollected,
      varianceAmount: dto.varianceAmount,
      currency: dto.currency,
    });
    return this.commandBus.execute(command);
  }

  @Get('carrier-reconciliation-runs/carrier/:carrierId')
  async getReconciliationRunsByCarrier(@Param('carrierId') carrierId: string, @Req() req: Request) {
    this.assertBenefitsAdminScope(req);
    return this.reconciliationRunRepo.findByCarrier(new Uuid(carrierId));
  }

  @Post('carrier-reconciliation-runs/:id/commands/detect-variance')
  async detectReconciliationVariance(@Param('id') id: string, @Body() dto: DetectCarrierReconciliationVarianceDto, @Req() req: Request) {
    await this.getReconciliationRunForCommand(id);
    const command = this.buildCommand(req, 'DetectCarrierReconciliationVariance', 'CarrierReconciliationRun', id, {
      runId: new Uuid(id),
      varianceAmount: dto.varianceAmount,
    });
    return this.commandBus.execute(command);
  }

  @Post('carrier-reconciliation-runs/:id/commands/reconcile')
  async reconcileReconciliationRun(@Param('id') id: string, @Body() _dto: ReconcileCarrierReconciliationRunDto = {}, @Req() req: Request) {
    await this.getReconciliationRunForCommand(id);
    const command = this.buildCommand(req, 'ReconcileCarrierReconciliationRun', 'CarrierReconciliationRun', id, {
      runId: new Uuid(id),
    });
    return this.commandBus.execute(command);
  }

  @Post('carrier-reconciliation-runs/:id/commands/fail')
  async failReconciliationRun(@Param('id') id: string, @Body() dto: FailCarrierReconciliationRunDto = {}, @Req() req: Request) {
    await this.getReconciliationRunForCommand(id);
    const command = this.buildCommand(req, 'FailCarrierReconciliationRun', 'CarrierReconciliationRun', id, {
      runId: new Uuid(id),
      reason: dto.reason,
    });
    return this.commandBus.execute(command);
  }

  private assertBenefitsAdminScope(req: Request): void {
    const roles = req.actor?.roles ?? [];
    if (roles.some((role) => BENEFITS_ADMIN_ROLES.has(role))) return;
    throw new ForbiddenException('Only HR or benefits administrators can access benefits administration');
  }

  private async getEnrollmentForCommand(id: string) {
    const enrollment = await this.enrollmentRepo.findById(new Uuid(id));
    if (!enrollment) throw new NotFoundException('BenefitsEnrollment not found');
    return enrollment;
  }

  private async getLifeEventForCommand(id: string) {
    const event = await this.lifeEventRepo.findById(new Uuid(id));
    if (!event) throw new NotFoundException('BenefitsLifeEvent not found');
    return event;
  }

  private async getProgramForCommand(id: string) {
    const program = await this.programRepo.findById(new Uuid(id));
    if (!program) throw new NotFoundException('BenefitsProgram not found');
    return program;
  }

  private async getSpendingAccountForCommand(id: string) {
    const account = await this.spendingAccountRepo.findById(new Uuid(id));
    if (!account) throw new NotFoundException('SpendingAccount not found');
    return account;
  }

  private async getReconciliationRunForCommand(id: string) {
    const run = await this.reconciliationRunRepo.findById(new Uuid(id));
    if (!run) throw new NotFoundException('CarrierReconciliationRun not found');
    return run;
  }

  private actorId(req: Request): Uuid {
    const actorId = req.actor?.actorId;
    if (actorId instanceof Uuid) return actorId;
    const actorIdLike = actorId as { value?: unknown } | undefined;
    if (typeof actorIdLike?.value === 'string' && Uuid.isValid(actorIdLike.value)) {
      return new Uuid(actorIdLike.value);
    }
    throw new BadRequestException('Actor missing');
  }
}

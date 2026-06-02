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
  CreateBenefitsEnrollmentDto,
  CreateBenefitsLifeEventDto,
  CreateSpendingAccountDto,
  CreateCarrierReconciliationRunDto,
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
      aggregateType,
      aggregateId: aggregateId ? new Uuid(aggregateId) : undefined,
      idempotencyKey: crypto.randomUUID(),
      correlationId: Uuid.generate(),
      reason: `${commandName} via API`,
      payload,
      metadata: {
        requestHash: computeRequestHash(payload),
        clientType: 'HR_ADMIN',
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

  /* ---------------------------------------------------------------- */
  /*  Benefits Enrollments                                              */
  /* ---------------------------------------------------------------- */

  @Post('enrollments')
  async createEnrollment(@Body() dto: CreateBenefitsEnrollmentDto, @Req() req: Request) {
    const command = this.buildCommand(req, 'CreateBenefitsEnrollment', 'BenefitsEnrollment', undefined, {
      enrollmentId: new Uuid(dto.enrollmentId),
      workerId: new Uuid(dto.workerId),
      programId: new Uuid(dto.programId),
      coverageLevel: dto.coverageLevel,
      dependents: dto.dependents,
      effectiveDate: dto.effectiveDate,
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

  /* ---------------------------------------------------------------- */
  /*  Benefits Life Events                                              */
  /* ---------------------------------------------------------------- */

  @Post('life-events')
  async createLifeEvent(@Body() dto: CreateBenefitsLifeEventDto, @Req() req: Request) {
    const command = this.buildCommand(req, 'CreateBenefitsLifeEvent', 'BenefitsLifeEvent', undefined, {
      lifeEventId: new Uuid(dto.lifeEventId),
      workerId: new Uuid(dto.workerId),
      eventType: dto.eventType,
      eventDate: dto.eventDate,
      description: dto.description,
    });
    return this.commandBus.execute(command);
  }

  @Get('life-events/worker/:workerId')
  async getLifeEventsByWorker(@Param('workerId') workerId: string, @Req() req: Request) {
    this.assertBenefitsAdminScope(req);
    return this.lifeEventRepo.findByWorker(new Uuid(workerId));
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

  private assertBenefitsAdminScope(req: Request): void {
    const roles = req.actor?.roles ?? [];
    if (roles.some((role) => BENEFITS_ADMIN_ROLES.has(role))) return;
    throw new ForbiddenException('Only HR or benefits administrators can access benefits administration');
  }
}

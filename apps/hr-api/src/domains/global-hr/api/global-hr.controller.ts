import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  Req,
  BadRequestException,
  ForbiddenException,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { randomUUID } from 'crypto';
import { CommandBus } from '../../../platform/command-bus/command-bus.js';
import { Uuid } from '@hcm/shared-kernel';
import { computeRequestHash } from '@hcm/platform-core';
import type { HrCommandEnvelope } from '@hcm/command-contracts';
import { AuthGuard } from '../../../guards/auth.guard.js';
import { actorClientType, requireActor, requireTenantId } from '../../../platform/http/request-context.js';
import { CountryRuleSetRepository } from '../repositories/country-rule-set.repository.js';
import { StatutoryLeaveTypeRepository } from '../repositories/statutory-leave-type.repository.js';
import { WorksCouncilConsultationRepository } from '../repositories/works-council-consultation.repository.js';
import { WorkAuthorizationCaseRepository } from '../repositories/work-authorization-case.repository.js';
import { InternationalAssignmentRepository } from '../repositories/international-assignment.repository.js';

import type * as dtos from './dtos.js';
import {
  CreateCountryRuleSetDtoSchema,
  CreateStatutoryLeaveTypeDtoSchema,
  CreateWorksCouncilConsultationDtoSchema,
  CreateWorkAuthorizationCaseDtoSchema,
  ApproveWorkAuthorizationCaseDtoSchema,
  RenewWorkAuthorizationCaseDtoSchema,
  CreateInternationalAssignmentDtoSchema,
  ZodValidationPipe,
} from './dtos.js';

// Global-HR records include personal data (work authorization, international
// assignments) and works-council consultations. Mutations and personal-data reads
// are restricted to global-mobility / HR / platform administrators. Reference data
// (country rule sets, statutory leave types) requires only authentication.
const GLOBAL_HR_ADMIN_ROLES = new Set([
  'APP_ADMIN',
  'PLATFORM_ADMIN',
  'SUPER_ADMIN',
  'HR_ADMIN',
  'HRBP',
  'GLOBAL_MOBILITY_ADMIN',
]);

@ApiTags('Global HR')
@Controller('global-hr')
@UseGuards(AuthGuard)
export class GlobalHrController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly countryRuleSetRepo: CountryRuleSetRepository,
    private readonly statutoryLeaveTypeRepo: StatutoryLeaveTypeRepository,
    private readonly worksCouncilConsultationRepo: WorksCouncilConsultationRepository,
    private readonly workAuthorizationCaseRepo: WorkAuthorizationCaseRepository,
    private readonly internationalAssignmentRepo: InternationalAssignmentRepository,
  ) {}

  private buildCommand<TPayload>(
    commandName: string,
    aggregateType: string,
    payload: TPayload,
    req: Request,
    options?: {
      aggregateId?: Uuid;
      expectedState?: string;
      expectedVersion?: number;
      subjectWorkerId?: Uuid;
      effectiveDate?: Date;
    },
  ): HrCommandEnvelope<TPayload> {
    this.assertGlobalHrAdminScope(req);
    const tenantId = requireTenantId(req, 'Global HR');
    const actor = requireActor(req, 'Global HR');
    return {
      commandId: Uuid.generate(),
      commandName,
      commandSchemaVersion: 1,
      tenantId,
      actor,
      aggregateType,
      aggregateId: options?.aggregateId,
      expectedState: options?.expectedState,
      expectedVersion: options?.expectedVersion,
      subjectWorkerId: options?.subjectWorkerId,
      effectiveDate: options?.effectiveDate,
      idempotencyKey: randomUUID(),
      correlationId: Uuid.generate(),
      reason: 'API request',
      payload,
      metadata: {
        requestHash: computeRequestHash(payload),
        clientType: actorClientType(actor),
      },
    };
  }

  private assertGlobalHrAdminScope(req: Request): void {
    const roles = req.actor?.roles ?? [];
    if (roles.some((role) => GLOBAL_HR_ADMIN_ROLES.has(role))) return;
    throw new ForbiddenException('Only global-mobility or HR administrators can access global-HR personal data');
  }

  private requireMatchingTenant(req: Request, tenantId: string): Uuid {
    this.assertGlobalHrAdminScope(req);
    const requestTenantId = requireTenantId(req, 'Global HR');
    if (requestTenantId.value !== tenantId) {
      throw new BadRequestException('Tenant mismatch');
    }
    return requestTenantId;
  }

  private async getWorkAuthorizationForCommand(id: string) {
    const authCase = await this.workAuthorizationCaseRepo.findById(new Uuid(id));
    if (!authCase) throw new BadRequestException('Work authorization case not found');
    return authCase;
  }

  private async getInternationalAssignmentForCommand(id: string) {
    const assignment = await this.internationalAssignmentRepo.findById(new Uuid(id));
    if (!assignment) throw new BadRequestException('International assignment not found');
    return assignment;
  }

  /* ---------------------------------------------------------------- */
  /*  Country Rule Sets                                                 */
  /* ---------------------------------------------------------------- */

  @Post('country-rule-sets')
  async createCountryRuleSet(
    @Body(new ZodValidationPipe(CreateCountryRuleSetDtoSchema)) dto: dtos.CreateCountryRuleSetDto,
    @Req() req: Request,
  ) {
    const command = this.buildCommand('CreateCountryRuleSet', 'CountryRuleSet', dto, req);
    return this.commandBus.execute(command);
  }

  @Get('country-rule-sets')
  async listCountryRuleSets(@Query('countryCode') countryCode?: string) {
    if (countryCode) {
      return this.countryRuleSetRepo.findByCountryCode(countryCode);
    }
    return [];
  }

  @Get('country-rule-sets/:id')
  async getCountryRuleSet(@Param('id') id: string, @Req() req: Request) {
    const tenantId = requireTenantId(req, 'Global HR');
    return this.countryRuleSetRepo.findByIdForTenant(new Uuid(id), tenantId);
  }

  /* ---------------------------------------------------------------- */
  /*  Statutory Leave Types                                             */
  /* ---------------------------------------------------------------- */

  @Post('statutory-leave-types')
  async createStatutoryLeaveType(
    @Body(new ZodValidationPipe(CreateStatutoryLeaveTypeDtoSchema)) dto: dtos.CreateStatutoryLeaveTypeDto,
    @Req() req: Request,
  ) {
    const command = this.buildCommand('CreateStatutoryLeaveType', 'StatutoryLeaveType', dto, req);
    return this.commandBus.execute(command);
  }

  @Get('statutory-leave-types')
  async listStatutoryLeaveTypes(@Query('countryCode') countryCode?: string) {
    if (countryCode) {
      return this.statutoryLeaveTypeRepo.findByCountryCode(countryCode);
    }
    return [];
  }

  @Get('statutory-leave-types/:id')
  async getStatutoryLeaveType(@Param('id') id: string, @Req() req: Request) {
    const tenantId = requireTenantId(req, 'Global HR');
    return this.statutoryLeaveTypeRepo.findByIdForTenant(new Uuid(id), tenantId);
  }

  /* ---------------------------------------------------------------- */
  /*  Works Council Consultations                                       */
  /* ---------------------------------------------------------------- */

  @Post('works-council-consultations')
  async createWorksCouncilConsultation(
    @Body(new ZodValidationPipe(CreateWorksCouncilConsultationDtoSchema)) dto: dtos.CreateWorksCouncilConsultationDto,
    @Req() req: Request,
  ) {
    const command = this.buildCommand('CreateWorksCouncilConsultation', 'WorksCouncilConsultation', dto, req);
    return this.commandBus.execute(command);
  }

  @Get('works-council-consultations/legal-entity/:legalEntityId')
  async getWorksCouncilConsultationsByLegalEntity(@Param('legalEntityId') legalEntityId: string, @Req() req: Request) {
    this.assertGlobalHrAdminScope(req);
    return this.worksCouncilConsultationRepo.findByLegalEntity(new Uuid(legalEntityId));
  }

  @Get('works-council-consultations/:id')
  async getWorksCouncilConsultation(@Param('id') id: string, @Req() req: Request) {
    this.assertGlobalHrAdminScope(req);
    return this.worksCouncilConsultationRepo.findById(new Uuid(id));
  }

  /* ---------------------------------------------------------------- */
  /*  Work Authorization Cases                                          */
  /* ---------------------------------------------------------------- */

  @Post('work-authorization-cases')
  async createWorkAuthorizationCase(
    @Body(new ZodValidationPipe(CreateWorkAuthorizationCaseDtoSchema)) dto: dtos.CreateWorkAuthorizationCaseDto,
    @Req() req: Request,
  ) {
    const command = this.buildCommand('CreateWorkAuthorizationCase', 'WorkAuthorizationCase', dto, req);
    return this.commandBus.execute(command);
  }

  @Post('work-authorization-cases/:id/commands/start-review')
  async startWorkAuthorizationReview(@Param('id') id: string, @Req() req: Request) {
    const authCase = await this.getWorkAuthorizationForCommand(id);
    return this.commandBus.execute(this.buildCommand(
      'StartWorkAuthorizationReview',
      'WorkAuthorizationCase',
      { workAuthorizationCaseId: new Uuid(id) },
      req,
      {
        aggregateId: new Uuid(id),
        expectedState: authCase.status,
        expectedVersion: authCase.aggregateVersion,
        subjectWorkerId: authCase.workerId,
      },
    ));
  }

  @Post('work-authorization-cases/:id/commands/approve')
  async approveWorkAuthorizationCase(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(ApproveWorkAuthorizationCaseDtoSchema)) dto: dtos.ApproveWorkAuthorizationCaseDto,
    @Req() req: Request,
  ) {
    const authCase = await this.getWorkAuthorizationForCommand(id);
    return this.commandBus.execute(this.buildCommand(
      'ApproveWorkAuthorizationCase',
      'WorkAuthorizationCase',
      {
        workAuthorizationCaseId: new Uuid(id),
        validFrom: dto.validFrom,
        validUntil: dto.validUntil,
        documentNumber: dto.documentNumber,
      },
      req,
      {
        aggregateId: new Uuid(id),
        expectedState: authCase.status,
        expectedVersion: authCase.aggregateVersion,
        subjectWorkerId: authCase.workerId,
      },
    ));
  }

  @Post('work-authorization-cases/:id/commands/expire')
  async expireWorkAuthorizationCase(@Param('id') id: string, @Req() req: Request) {
    const authCase = await this.getWorkAuthorizationForCommand(id);
    return this.commandBus.execute(this.buildCommand(
      'ExpireWorkAuthorizationCase',
      'WorkAuthorizationCase',
      { workAuthorizationCaseId: new Uuid(id) },
      req,
      {
        aggregateId: new Uuid(id),
        expectedState: authCase.status,
        expectedVersion: authCase.aggregateVersion,
        subjectWorkerId: authCase.workerId,
      },
    ));
  }

  @Post('work-authorization-cases/:id/commands/renew')
  async renewWorkAuthorizationCase(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(RenewWorkAuthorizationCaseDtoSchema)) dto: dtos.RenewWorkAuthorizationCaseDto,
    @Req() req: Request,
  ) {
    const authCase = await this.getWorkAuthorizationForCommand(id);
    return this.commandBus.execute(this.buildCommand(
      'RenewWorkAuthorizationCase',
      'WorkAuthorizationCase',
      { workAuthorizationCaseId: new Uuid(id), newValidUntil: dto.newValidUntil },
      req,
      {
        aggregateId: new Uuid(id),
        expectedState: authCase.status,
        expectedVersion: authCase.aggregateVersion,
        subjectWorkerId: authCase.workerId,
      },
    ));
  }

  @Post('work-authorization-cases/:id/commands/close')
  async closeWorkAuthorizationCase(@Param('id') id: string, @Req() req: Request) {
    const authCase = await this.getWorkAuthorizationForCommand(id);
    return this.commandBus.execute(this.buildCommand(
      'CloseWorkAuthorizationCase',
      'WorkAuthorizationCase',
      { workAuthorizationCaseId: new Uuid(id) },
      req,
      {
        aggregateId: new Uuid(id),
        expectedState: authCase.status,
        expectedVersion: authCase.aggregateVersion,
        subjectWorkerId: authCase.workerId,
      },
    ));
  }

  @Post('work-authorization-cases/:id/commands/reject')
  async rejectWorkAuthorizationCase(@Param('id') id: string, @Req() req: Request) {
    const authCase = await this.getWorkAuthorizationForCommand(id);
    return this.commandBus.execute(this.buildCommand(
      'RejectWorkAuthorizationCase',
      'WorkAuthorizationCase',
      { workAuthorizationCaseId: new Uuid(id) },
      req,
      {
        aggregateId: new Uuid(id),
        expectedState: authCase.status,
        expectedVersion: authCase.aggregateVersion,
        subjectWorkerId: authCase.workerId,
      },
    ));
  }

  @Get('work-authorization-cases/tenant/:tenantId')
  async getWorkAuthorizationCasesByTenant(@Param('tenantId') tenantId: string, @Req() req: Request) {
    return this.workAuthorizationCaseRepo.findByTenant(this.requireMatchingTenant(req, tenantId));
  }

  @Get('work-authorization-cases/worker/:workerId')
  async getWorkAuthorizationCasesByWorker(@Param('workerId') workerId: string, @Req() req: Request) {
    this.assertGlobalHrAdminScope(req);
    return this.workAuthorizationCaseRepo.findByWorker(new Uuid(workerId));
  }

  @Get('work-authorization-cases/:id')
  async getWorkAuthorizationCase(@Param('id') id: string, @Req() req: Request) {
    this.assertGlobalHrAdminScope(req);
    return this.workAuthorizationCaseRepo.findById(new Uuid(id));
  }

  /* ---------------------------------------------------------------- */
  /*  International Assignments                                        */
  /* ---------------------------------------------------------------- */

  @Post('international-assignments')
  async createInternationalAssignment(
    @Body(new ZodValidationPipe(CreateInternationalAssignmentDtoSchema)) dto: dtos.CreateInternationalAssignmentDto,
    @Req() req: Request,
  ) {
    const command = this.buildCommand('CreateInternationalAssignment', 'InternationalAssignment', dto, req, {
      subjectWorkerId: new Uuid(dto.workerId),
      effectiveDate: dto.startDate,
    });
    return this.commandBus.execute(command);
  }

  @Post('international-assignments/:id/commands/approve')
  async approveInternationalAssignment(@Param('id') id: string, @Req() req: Request) {
    const assignment = await this.getInternationalAssignmentForCommand(id);
    return this.commandBus.execute(this.buildCommand(
      'ApproveInternationalAssignment',
      'InternationalAssignment',
      { internationalAssignmentId: new Uuid(id) },
      req,
      {
        aggregateId: new Uuid(id),
        expectedState: assignment.status,
        expectedVersion: assignment.aggregateVersion,
        subjectWorkerId: assignment.workerId,
      },
    ));
  }

  @Post('international-assignments/:id/commands/activate')
  async activateInternationalAssignment(@Param('id') id: string, @Req() req: Request) {
    const assignment = await this.getInternationalAssignmentForCommand(id);
    return this.commandBus.execute(this.buildCommand(
      'ActivateInternationalAssignment',
      'InternationalAssignment',
      { internationalAssignmentId: new Uuid(id) },
      req,
      {
        aggregateId: new Uuid(id),
        expectedState: assignment.status,
        expectedVersion: assignment.aggregateVersion,
        subjectWorkerId: assignment.workerId,
      },
    ));
  }

  @Post('international-assignments/:id/commands/complete')
  async completeInternationalAssignment(@Param('id') id: string, @Req() req: Request) {
    const assignment = await this.getInternationalAssignmentForCommand(id);
    return this.commandBus.execute(this.buildCommand(
      'CompleteInternationalAssignment',
      'InternationalAssignment',
      { internationalAssignmentId: new Uuid(id) },
      req,
      {
        aggregateId: new Uuid(id),
        expectedState: assignment.status,
        expectedVersion: assignment.aggregateVersion,
        subjectWorkerId: assignment.workerId,
      },
    ));
  }

  @Post('international-assignments/:id/commands/expire')
  async expireInternationalAssignment(@Param('id') id: string, @Req() req: Request) {
    const assignment = await this.getInternationalAssignmentForCommand(id);
    return this.commandBus.execute(this.buildCommand(
      'ExpireInternationalAssignment',
      'InternationalAssignment',
      { internationalAssignmentId: new Uuid(id) },
      req,
      {
        aggregateId: new Uuid(id),
        expectedState: assignment.status,
        expectedVersion: assignment.aggregateVersion,
        subjectWorkerId: assignment.workerId,
      },
    ));
  }

  @Post('international-assignments/:id/commands/cancel')
  async cancelInternationalAssignment(@Param('id') id: string, @Req() req: Request) {
    const assignment = await this.getInternationalAssignmentForCommand(id);
    return this.commandBus.execute(this.buildCommand(
      'CancelInternationalAssignment',
      'InternationalAssignment',
      { internationalAssignmentId: new Uuid(id) },
      req,
      {
        aggregateId: new Uuid(id),
        expectedState: assignment.status,
        expectedVersion: assignment.aggregateVersion,
        subjectWorkerId: assignment.workerId,
      },
    ));
  }

  @Get('international-assignments/tenant/:tenantId')
  async getInternationalAssignmentsByTenant(@Param('tenantId') tenantId: string, @Req() req: Request) {
    return this.internationalAssignmentRepo.findByTenant(this.requireMatchingTenant(req, tenantId));
  }

  @Get('international-assignments/worker/:workerId')
  async getInternationalAssignmentsByWorker(@Param('workerId') workerId: string, @Req() req: Request) {
    this.assertGlobalHrAdminScope(req);
    return this.internationalAssignmentRepo.findByWorker(new Uuid(workerId));
  }

  @Get('international-assignments/:id')
  async getInternationalAssignment(@Param('id') id: string, @Req() req: Request) {
    this.assertGlobalHrAdminScope(req);
    return this.internationalAssignmentRepo.findById(new Uuid(id));
  }
}

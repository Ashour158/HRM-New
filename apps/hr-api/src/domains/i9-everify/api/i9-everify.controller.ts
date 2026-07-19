import { Controller, Get, Post, Body, Param, Req, BadRequestException, ForbiddenException, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { randomUUID } from 'crypto';
import { CommandBus } from '../../../platform/command-bus/command-bus.js';
import { Uuid } from '@hcm/shared-kernel';
import { computeRequestHash } from '@hcm/platform-core';
import type { HrCommandEnvelope } from '@hcm/command-contracts';
import { AuthGuard } from '../../../guards/auth.guard.js';
import { actorClientType, requireActor, requireTenantId } from '../../../platform/http/request-context.js';
import { I9CaseRepository } from '../repositories/i9-case.repository.js';
import { EverifyCaseRepository } from '../repositories/everify-case.repository.js';
import type { I9Case } from '../aggregates/i9-case.aggregate.js';
import type { EverifyCase } from '../aggregates/everify-case.aggregate.js';
import { toI9CaseDto, toEverifyCaseDto } from './dtos.js';
import type * as dtos from './dtos.js';
import {
  CompleteI9CaseSection1DtoSchema,
  CompleteI9CaseSection2DtoSchema,
  RejectI9CaseDtoSchema,
  SubmitEverifyCaseDtoSchema,
  RecordEverifyResultDtoSchema,
  ZodValidationPipe,
} from './dtos.js';

// I9Case/EverifyCase records carry HIGH_SENSITIVITY immigration/work-authorization
// attestation data (Form I-9 Section 1/2, federal E-Verify submissions and
// determinations). Restricted to HR/compliance administrators - the same tier
// that already governs global-hr's work-authorization and country-policy
// records, of which I-9/E-Verify is a part (see GLOBAL_HR_COMPLIANCE_OFFICER's
// role description in packages/hr-access-control/src/rbac/roles.ts).
const I9_EVERIFY_ADMIN_ROLES = new Set([
  'APP_ADMIN',
  'PLATFORM_ADMIN',
  'SUPER_ADMIN',
  'HR_ADMIN',
  'HRBP',
  'COMPLIANCE_OFFICER',
  'GLOBAL_HR_COMPLIANCE_OFFICER',
]);

@ApiTags('I9/E-Verify')
@Controller('i9-everify')
@UseGuards(AuthGuard)
export class I9EverifyController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly i9CaseRepo: I9CaseRepository,
    private readonly everifyCaseRepo: EverifyCaseRepository,
  ) {}

  private buildCommand<TPayload>(
    commandName: string,
    aggregateType: string,
    payload: TPayload,
    req: Request,
    options?: { aggregateId?: Uuid; expectedState?: string; expectedVersion?: number; subjectWorkerId?: Uuid },
  ): HrCommandEnvelope<TPayload> {
    this.assertI9EverifyAdminScope(req);
    const tenantId = requireTenantId(req, 'I9/E-Verify');
    const actor = requireActor(req, 'I9/E-Verify');
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
      idempotencyKey: randomUUID(),
      correlationId: Uuid.generate(),
      reason: 'API request',
      payload,
      metadata: { requestHash: computeRequestHash(payload), clientType: actorClientType(actor) },
    };
  }

  private assertI9EverifyAdminScope(req: Request): void {
    const roles = req.actor?.roles ?? [];
    if (roles.some((role) => I9_EVERIFY_ADMIN_ROLES.has(role))) return;
    throw new ForbiddenException('Only HR or compliance administrators can access I9/E-Verify records');
  }

  /**
   * Loads the I9Case a lifecycle command targets. `I9CaseRepository.findById`
   * is tenant-scoped by construction - it reads the ambient tenant from
   * AsyncLocalStorage (set by `TenantInterceptor`), never anything
   * client-supplied - so a cross-tenant id simply comes back `undefined` here
   * rather than the other tenant's case.
   */
  private async getI9CaseForCommand(id: string, req: Request): Promise<I9Case> {
    this.assertI9EverifyAdminScope(req);
    const i9Case = await this.i9CaseRepo.findById(new Uuid(id));
    if (!i9Case) throw new BadRequestException('I9 case not found');
    return i9Case;
  }

  private async getEverifyCaseForCommand(id: string, req: Request): Promise<EverifyCase> {
    this.assertI9EverifyAdminScope(req);
    const everifyCase = await this.everifyCaseRepo.findById(new Uuid(id));
    if (!everifyCase) throw new BadRequestException('E-Verify case not found');
    return everifyCase;
  }

  /* ---------------------------------------------------------------- */
  /*  I9 Case lifecycle                                                 */
  /* ---------------------------------------------------------------- */

  @Post('i9-cases/:id/commands/complete-section-1')
  async completeI9CaseSection1(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(CompleteI9CaseSection1DtoSchema)) dto: dtos.CompleteI9CaseSection1Dto,
    @Req() req: Request,
  ) {
    const i9Case = await this.getI9CaseForCommand(id, req);
    return this.commandBus.execute(this.buildCommand(
      'CompleteI9CaseSection1',
      'I9Case',
      {
        i9CaseId: i9Case.id,
        citizenshipStatus: dto.citizenshipStatus,
        section1CompletedAt: dto.section1CompletedAt,
      },
      req,
      {
        aggregateId: i9Case.id,
        expectedState: i9Case.status,
        expectedVersion: i9Case.aggregateVersion,
        subjectWorkerId: i9Case.workerId,
      },
    ));
  }

  @Post('i9-cases/:id/commands/complete-section-2')
  async completeI9CaseSection2(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(CompleteI9CaseSection2DtoSchema)) dto: dtos.CompleteI9CaseSection2Dto,
    @Req() req: Request,
  ) {
    const i9Case = await this.getI9CaseForCommand(id, req);
    return this.commandBus.execute(this.buildCommand(
      'CompleteI9CaseSection2',
      'I9Case',
      {
        i9CaseId: i9Case.id,
        documentType: dto.documentType,
        documentDescriptions: dto.documentDescriptions,
        documentExpirationDate: dto.documentExpirationDate,
        reviewerId: dto.reviewerId,
        section2CompletedAt: dto.section2CompletedAt,
      },
      req,
      {
        aggregateId: i9Case.id,
        expectedState: i9Case.status,
        expectedVersion: i9Case.aggregateVersion,
        subjectWorkerId: i9Case.workerId,
      },
    ));
  }

  @Post('i9-cases/:id/commands/reject')
  async rejectI9Case(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(RejectI9CaseDtoSchema)) dto: dtos.RejectI9CaseDto,
    @Req() req: Request,
  ) {
    const i9Case = await this.getI9CaseForCommand(id, req);
    return this.commandBus.execute(this.buildCommand(
      'RejectI9Case',
      'I9Case',
      { i9CaseId: i9Case.id, reason: dto.reason },
      req,
      {
        aggregateId: i9Case.id,
        expectedState: i9Case.status,
        expectedVersion: i9Case.aggregateVersion,
        subjectWorkerId: i9Case.workerId,
      },
    ));
  }

  @Get('i9-cases/worker/:workerId')
  async getI9CasesByWorker(@Param('workerId') workerId: string, @Req() req: Request) {
    this.assertI9EverifyAdminScope(req);
    requireTenantId(req, 'I9/E-Verify');
    const cases = await this.i9CaseRepo.findByWorker(new Uuid(workerId));
    return cases.map(toI9CaseDto);
  }

  @Get('i9-cases/:id')
  async getI9Case(@Param('id') id: string, @Req() req: Request) {
    this.assertI9EverifyAdminScope(req);
    requireTenantId(req, 'I9/E-Verify');
    const i9Case = await this.i9CaseRepo.findById(new Uuid(id));
    return i9Case ? toI9CaseDto(i9Case) : undefined;
  }

  /* ---------------------------------------------------------------- */
  /*  E-Verify Case lifecycle                                           */
  /* ---------------------------------------------------------------- */

  @Post('everify-cases/submit')
  async submitEverifyCase(
    @Body(new ZodValidationPipe(SubmitEverifyCaseDtoSchema)) dto: dtos.SubmitEverifyCaseDto,
    @Req() req: Request,
  ) {
    const i9Case = await this.getI9CaseForCommand(dto.i9CaseId, req);
    return this.commandBus.execute(this.buildCommand(
      'SubmitEverifyCase',
      'I9Case',
      {
        i9CaseId: i9Case.id,
        firstName: dto.firstName,
        lastName: dto.lastName,
        dateOfBirth: dto.dateOfBirth,
      },
      req,
      {
        aggregateId: i9Case.id,
        expectedState: i9Case.status,
        expectedVersion: i9Case.aggregateVersion,
        subjectWorkerId: i9Case.workerId,
      },
    ));
  }

  @Post('everify-cases/:id/commands/record-result')
  async recordEverifyResult(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(RecordEverifyResultDtoSchema)) dto: dtos.RecordEverifyResultDto,
    @Req() req: Request,
  ) {
    const everifyCase = await this.getEverifyCaseForCommand(id, req);
    return this.commandBus.execute(this.buildCommand(
      'RecordEverifyResult',
      'EverifyCase',
      { everifyCaseId: everifyCase.id, result: dto.result, recordedBy: dto.recordedBy },
      req,
      {
        aggregateId: everifyCase.id,
        expectedState: everifyCase.status,
        expectedVersion: everifyCase.aggregateVersion,
        subjectWorkerId: everifyCase.workerId,
      },
    ));
  }

  @Post('everify-cases/:id/commands/contest-tnc')
  async contestEverifyTnc(@Param('id') id: string, @Req() req: Request) {
    const everifyCase = await this.getEverifyCaseForCommand(id, req);
    return this.commandBus.execute(this.buildCommand(
      'ContestEverifyTentativeNonconfirmation',
      'EverifyCase',
      { everifyCaseId: everifyCase.id },
      req,
      {
        aggregateId: everifyCase.id,
        expectedState: everifyCase.status,
        expectedVersion: everifyCase.aggregateVersion,
        subjectWorkerId: everifyCase.workerId,
      },
    ));
  }

  @Get('everify-cases/:id')
  async getEverifyCase(@Param('id') id: string, @Req() req: Request) {
    this.assertI9EverifyAdminScope(req);
    requireTenantId(req, 'I9/E-Verify');
    const everifyCase = await this.everifyCaseRepo.findById(new Uuid(id));
    return everifyCase ? toEverifyCaseDto(everifyCase) : undefined;
  }
}

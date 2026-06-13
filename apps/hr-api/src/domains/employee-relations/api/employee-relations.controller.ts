import { Controller, Get, Post, Body, Param, Req, BadRequestException } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { randomUUID } from 'crypto';
import { CommandBus } from '../../../platform/command-bus/command-bus.js';
import { Uuid } from '@hcm/shared-kernel';
import { computeRequestHash } from '@hcm/platform-core';
import type { HrCommandEnvelope } from '@hcm/command-contracts';
import { actorClientType, requireActor, requireTenantId } from '../../../platform/http/request-context.js';
import { EmployeeRelationsCaseRepository } from '../repositories/employee-relations-case.repository.js';
import { ErInvestigationRepository } from '../repositories/er-investigation.repository.js';
import { DisciplinaryActionRepository } from '../repositories/disciplinary-action.repository.js';
import { AccommodationCaseRepository } from '../repositories/accommodation-case.repository.js';
import type * as dtos from './dtos.js';
import {
  CreateEmployeeRelationsCaseDtoSchema, CreateErInvestigationDtoSchema,
  DraftDisciplinaryActionDtoSchema, CreateAccommodationCaseDtoSchema,
  ZodValidationPipe,
} from './dtos.js';

@ApiTags('Employee Relations')
@Controller('employee-relations')
export class EmployeeRelationsController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly erCaseRepo: EmployeeRelationsCaseRepository,
    private readonly erInvestigationRepo: ErInvestigationRepository,
    private readonly disciplinaryActionRepo: DisciplinaryActionRepository,
    private readonly accommodationCaseRepo: AccommodationCaseRepository,
  ) {}

  private buildCommand<TPayload>(
    commandName: string,
    aggregateType: string,
    payload: TPayload,
    req: Request,
    options?: { aggregateId?: Uuid; expectedState?: string; expectedVersion?: number; subjectWorkerId?: Uuid },
  ): HrCommandEnvelope<TPayload> {
    const tenantId = requireTenantId(req, 'Employee Relations');
    const actor = requireActor(req, 'Employee Relations');
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

  /* Employee Relations Cases */
  @Post('cases')
  async createErCase(@Body(new ZodValidationPipe(CreateEmployeeRelationsCaseDtoSchema)) dto: dtos.CreateEmployeeRelationsCaseDto, @Req() req: Request) {
    return this.commandBus.execute(this.buildCommand('CreateEmployeeRelationsCase', 'EmployeeRelationsCase', dto, req));
  }

  @Post('cases/:id/commands/review')
  async reviewErCase(@Param('id') id: string, @Req() req: Request) {
    const ar = await this.erCaseRepo.findById(new Uuid(id));
    if (!ar) throw new BadRequestException('ER case not found');
    return this.commandBus.execute(this.buildCommand('ReviewEmployeeRelationsCase', 'EmployeeRelationsCase', { employeeRelationsCaseId: new Uuid(id) }, req, { aggregateId: new Uuid(id), expectedState: ar.status, expectedVersion: ar.aggregateVersion }));
  }

  @Post('cases/:id/commands/start-investigation')
  async startInvestigationErCase(@Param('id') id: string, @Req() req: Request) {
    const ar = await this.erCaseRepo.findById(new Uuid(id));
    if (!ar) throw new BadRequestException('ER case not found');
    return this.commandBus.execute(this.buildCommand('StartInvestigationEmployeeRelationsCase', 'EmployeeRelationsCase', { employeeRelationsCaseId: new Uuid(id) }, req, { aggregateId: new Uuid(id), expectedState: ar.status, expectedVersion: ar.aggregateVersion }));
  }

  @Post('cases/:id/commands/move-to-disciplinary')
  async moveToDisciplinaryErCase(@Param('id') id: string, @Req() req: Request) {
    const ar = await this.erCaseRepo.findById(new Uuid(id));
    if (!ar) throw new BadRequestException('ER case not found');
    return this.commandBus.execute(this.buildCommand('MoveToDisciplinaryEmployeeRelationsCase', 'EmployeeRelationsCase', { employeeRelationsCaseId: new Uuid(id) }, req, { aggregateId: new Uuid(id), expectedState: ar.status, expectedVersion: ar.aggregateVersion }));
  }

  @Post('cases/:id/commands/resolve')
  async resolveErCase(@Param('id') id: string, @Req() req: Request) {
    const ar = await this.erCaseRepo.findById(new Uuid(id));
    if (!ar) throw new BadRequestException('ER case not found');
    return this.commandBus.execute(this.buildCommand('ResolveEmployeeRelationsCase', 'EmployeeRelationsCase', { employeeRelationsCaseId: new Uuid(id) }, req, { aggregateId: new Uuid(id), expectedState: ar.status, expectedVersion: ar.aggregateVersion }));
  }

  @Post('cases/:id/commands/close')
  async closeErCase(@Param('id') id: string, @Req() req: Request) {
    const ar = await this.erCaseRepo.findById(new Uuid(id));
    if (!ar) throw new BadRequestException('ER case not found');
    return this.commandBus.execute(this.buildCommand('CloseEmployeeRelationsCase', 'EmployeeRelationsCase', { employeeRelationsCaseId: new Uuid(id) }, req, { aggregateId: new Uuid(id), expectedState: ar.status, expectedVersion: ar.aggregateVersion }));
  }

  @Get('cases/:id')
  async getErCase(@Param('id') id: string) {
    return this.erCaseRepo.findById(new Uuid(id));
  }

  @Get('cases/subject/:workerId')
  async getErCasesBySubject(@Param('workerId') workerId: string) {
    return this.erCaseRepo.findBySubjectWorker(new Uuid(workerId));
  }

  /* ER Investigations */
  @Post('investigations')
  async createErInvestigation(@Body(new ZodValidationPipe(CreateErInvestigationDtoSchema)) dto: dtos.CreateErInvestigationDto, @Req() req: Request) {
    return this.commandBus.execute(this.buildCommand('CreateErInvestigation', 'ErInvestigation', dto, req));
  }

  @Post('investigations/:id/commands/start')
  async startErInvestigation(@Param('id') id: string, @Req() req: Request) {
    const ar = await this.erInvestigationRepo.findById(new Uuid(id));
    if (!ar) throw new BadRequestException('ER investigation not found');
    return this.commandBus.execute(this.buildCommand('StartErInvestigation', 'ErInvestigation', { erInvestigationId: new Uuid(id) }, req, { aggregateId: new Uuid(id), expectedState: ar.status, expectedVersion: ar.aggregateVersion }));
  }

  @Post('investigations/:id/commands/review-evidence')
  async reviewEvidenceErInvestigation(@Param('id') id: string, @Req() req: Request) {
    const ar = await this.erInvestigationRepo.findById(new Uuid(id));
    if (!ar) throw new BadRequestException('ER investigation not found');
    return this.commandBus.execute(this.buildCommand('ReviewEvidenceErInvestigation', 'ErInvestigation', { erInvestigationId: new Uuid(id) }, req, { aggregateId: new Uuid(id), expectedState: ar.status, expectedVersion: ar.aggregateVersion }));
  }

  @Post('investigations/:id/commands/complete')
  async completeErInvestigation(@Param('id') id: string, @Req() req: Request) {
    const ar = await this.erInvestigationRepo.findById(new Uuid(id));
    if (!ar) throw new BadRequestException('ER investigation not found');
    return this.commandBus.execute(this.buildCommand('CompleteErInvestigation', 'ErInvestigation', { erInvestigationId: new Uuid(id) }, req, { aggregateId: new Uuid(id), expectedState: ar.status, expectedVersion: ar.aggregateVersion }));
  }

  @Get('investigations/:id')
  async getErInvestigation(@Param('id') id: string) {
    return this.erInvestigationRepo.findById(new Uuid(id));
  }

  /* Disciplinary Actions */
  @Post('disciplinary-actions')
  async draftDisciplinaryAction(@Body(new ZodValidationPipe(DraftDisciplinaryActionDtoSchema)) dto: dtos.DraftDisciplinaryActionDto, @Req() req: Request) {
    return this.commandBus.execute(this.buildCommand('DraftDisciplinaryAction', 'DisciplinaryAction', dto, req));
  }

  @Post('disciplinary-actions/:id/commands/approve')
  async approveDisciplinaryAction(@Param('id') id: string, @Body() body: { approvedBy: string }, @Req() req: Request) {
    const ar = await this.disciplinaryActionRepo.findById(new Uuid(id));
    if (!ar) throw new BadRequestException('Disciplinary action not found');
    return this.commandBus.execute(this.buildCommand('ApproveDisciplinaryAction', 'DisciplinaryAction', { disciplinaryActionId: new Uuid(id), approvedBy: new Uuid(body.approvedBy) }, req, { aggregateId: new Uuid(id), expectedState: ar.status, expectedVersion: ar.aggregateVersion }));
  }

  @Post('disciplinary-actions/:id/commands/execute')
  async executeDisciplinaryAction(@Param('id') id: string, @Req() req: Request) {
    const ar = await this.disciplinaryActionRepo.findById(new Uuid(id));
    if (!ar) throw new BadRequestException('Disciplinary action not found');
    return this.commandBus.execute(this.buildCommand('ExecuteDisciplinaryAction', 'DisciplinaryAction', { disciplinaryActionId: new Uuid(id) }, req, { aggregateId: new Uuid(id), expectedState: ar.status, expectedVersion: ar.aggregateVersion }));
  }

  @Post('disciplinary-actions/:id/commands/appeal')
  async appealDisciplinaryAction(@Param('id') id: string, @Req() req: Request) {
    const ar = await this.disciplinaryActionRepo.findById(new Uuid(id));
    if (!ar) throw new BadRequestException('Disciplinary action not found');
    return this.commandBus.execute(this.buildCommand('AppealDisciplinaryAction', 'DisciplinaryAction', { disciplinaryActionId: new Uuid(id) }, req, { aggregateId: new Uuid(id), expectedState: ar.status, expectedVersion: ar.aggregateVersion }));
  }

  @Post('disciplinary-actions/:id/commands/uphold')
  async upholdDisciplinaryAction(@Param('id') id: string, @Req() req: Request) {
    const ar = await this.disciplinaryActionRepo.findById(new Uuid(id));
    if (!ar) throw new BadRequestException('Disciplinary action not found');
    return this.commandBus.execute(this.buildCommand('UpholdDisciplinaryAction', 'DisciplinaryAction', { disciplinaryActionId: new Uuid(id) }, req, { aggregateId: new Uuid(id), expectedState: ar.status, expectedVersion: ar.aggregateVersion }));
  }

  @Post('disciplinary-actions/:id/commands/revoke')
  async revokeDisciplinaryAction(@Param('id') id: string, @Req() req: Request) {
    const ar = await this.disciplinaryActionRepo.findById(new Uuid(id));
    if (!ar) throw new BadRequestException('Disciplinary action not found');
    return this.commandBus.execute(this.buildCommand('RevokeDisciplinaryAction', 'DisciplinaryAction', { disciplinaryActionId: new Uuid(id) }, req, { aggregateId: new Uuid(id), expectedState: ar.status, expectedVersion: ar.aggregateVersion }));
  }

  @Get('disciplinary-actions/:id')
  async getDisciplinaryAction(@Param('id') id: string) {
    return this.disciplinaryActionRepo.findById(new Uuid(id));
  }

  /* Accommodation Cases */
  @Post('accommodation-cases')
  async createAccommodationCase(@Body(new ZodValidationPipe(CreateAccommodationCaseDtoSchema)) dto: dtos.CreateAccommodationCaseDto, @Req() req: Request) {
    return this.commandBus.execute(this.buildCommand('CreateAccommodationCase', 'AccommodationCase', dto, req));
  }

  @Post('accommodation-cases/:id/commands/review')
  async reviewAccommodationCase(@Param('id') id: string, @Req() req: Request) {
    const ar = await this.accommodationCaseRepo.findById(new Uuid(id));
    if (!ar) throw new BadRequestException('Accommodation case not found');
    return this.commandBus.execute(this.buildCommand('ReviewAccommodationCase', 'AccommodationCase', { accommodationCaseId: new Uuid(id) }, req, { aggregateId: new Uuid(id), expectedState: ar.status, expectedVersion: ar.aggregateVersion }));
  }

  @Post('accommodation-cases/:id/commands/approve')
  async approveAccommodationCase(@Param('id') id: string, @Body() body: { approvedBy: string }, @Req() req: Request) {
    const ar = await this.accommodationCaseRepo.findById(new Uuid(id));
    if (!ar) throw new BadRequestException('Accommodation case not found');
    return this.commandBus.execute(this.buildCommand('ApproveAccommodationCase', 'AccommodationCase', { accommodationCaseId: new Uuid(id), approvedBy: new Uuid(body.approvedBy) }, req, { aggregateId: new Uuid(id), expectedState: ar.status, expectedVersion: ar.aggregateVersion }));
  }

  @Post('accommodation-cases/:id/commands/implement')
  async implementAccommodationCase(@Param('id') id: string, @Req() req: Request) {
    const ar = await this.accommodationCaseRepo.findById(new Uuid(id));
    if (!ar) throw new BadRequestException('Accommodation case not found');
    return this.commandBus.execute(this.buildCommand('ImplementAccommodationCase', 'AccommodationCase', { accommodationCaseId: new Uuid(id) }, req, { aggregateId: new Uuid(id), expectedState: ar.status, expectedVersion: ar.aggregateVersion }));
  }

  @Post('accommodation-cases/:id/commands/close')
  async closeAccommodationCase(@Param('id') id: string, @Req() req: Request) {
    const ar = await this.accommodationCaseRepo.findById(new Uuid(id));
    if (!ar) throw new BadRequestException('Accommodation case not found');
    return this.commandBus.execute(this.buildCommand('CloseAccommodationCase', 'AccommodationCase', { accommodationCaseId: new Uuid(id) }, req, { aggregateId: new Uuid(id), expectedState: ar.status, expectedVersion: ar.aggregateVersion }));
  }

  @Post('accommodation-cases/:id/commands/reject')
  async rejectAccommodationCase(@Param('id') id: string, @Req() req: Request) {
    const ar = await this.accommodationCaseRepo.findById(new Uuid(id));
    if (!ar) throw new BadRequestException('Accommodation case not found');
    return this.commandBus.execute(this.buildCommand('RejectAccommodationCase', 'AccommodationCase', { accommodationCaseId: new Uuid(id) }, req, { aggregateId: new Uuid(id), expectedState: ar.status, expectedVersion: ar.aggregateVersion }));
  }

  @Get('accommodation-cases/:id')
  async getAccommodationCase(@Param('id') id: string) {
    return this.accommodationCaseRepo.findById(new Uuid(id));
  }
}

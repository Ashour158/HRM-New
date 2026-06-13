import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  Req,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { randomUUID } from 'crypto';
import { CommandBus } from '../../../platform/command-bus/command-bus.js';
import { Uuid } from '@hcm/shared-kernel';
import { computeRequestHash } from '@hcm/platform-core';
import type { HrCommandEnvelope } from '@hcm/command-contracts';
import { actorClientType, requireActor, requireTenantId } from '../../../platform/http/request-context.js';
import { CountryRuleSetRepository } from '../repositories/country-rule-set.repository.js';
import { StatutoryLeaveTypeRepository } from '../repositories/statutory-leave-type.repository.js';
import { WorksCouncilConsultationRepository } from '../repositories/works-council-consultation.repository.js';
import { WorkAuthorizationCaseRepository } from '../repositories/work-authorization-case.repository.js';

import type * as dtos from './dtos.js';
import {
  CreateCountryRuleSetDtoSchema,
  CreateStatutoryLeaveTypeDtoSchema,
  CreateWorksCouncilConsultationDtoSchema,
  CreateWorkAuthorizationCaseDtoSchema,
  ZodValidationPipe,
} from './dtos.js';

@ApiTags('Global HR')
@Controller('global-hr')
export class GlobalHrController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly countryRuleSetRepo: CountryRuleSetRepository,
    private readonly statutoryLeaveTypeRepo: StatutoryLeaveTypeRepository,
    private readonly worksCouncilConsultationRepo: WorksCouncilConsultationRepository,
    private readonly workAuthorizationCaseRepo: WorkAuthorizationCaseRepository,
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
  async getCountryRuleSet(@Param('id') id: string) {
    return this.countryRuleSetRepo.findById(new Uuid(id));
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
  async getStatutoryLeaveType(@Param('id') id: string) {
    return this.statutoryLeaveTypeRepo.findById(new Uuid(id));
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
  async getWorksCouncilConsultationsByLegalEntity(@Param('legalEntityId') legalEntityId: string) {
    return this.worksCouncilConsultationRepo.findByLegalEntity(new Uuid(legalEntityId));
  }

  @Get('works-council-consultations/:id')
  async getWorksCouncilConsultation(@Param('id') id: string) {
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

  @Get('work-authorization-cases/worker/:workerId')
  async getWorkAuthorizationCasesByWorker(@Param('workerId') workerId: string) {
    return this.workAuthorizationCaseRepo.findByWorker(new Uuid(workerId));
  }

  @Get('work-authorization-cases/:id')
  async getWorkAuthorizationCase(@Param('id') id: string) {
    return this.workAuthorizationCaseRepo.findById(new Uuid(id));
  }
}

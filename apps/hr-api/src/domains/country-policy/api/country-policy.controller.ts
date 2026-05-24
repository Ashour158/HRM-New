import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  Req,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { randomUUID } from 'crypto';
import { CommandBus } from '../../../platform/command-bus/command-bus.js';
import { Uuid } from '@hcm/shared-kernel';
import { computeRequestHash } from '@hcm/platform-core';
import type { HrCommandEnvelope } from '@hcm/command-contracts';
import { CountryPolicyPackRepository } from '../repositories/country-policy-pack.repository.js';
import { CountryPolicyValidationRunRepository } from '../repositories/country-policy-validation-run.repository.js';
import { CountryPolicyImpactSimulationRepository } from '../repositories/country-policy-impact-simulation.repository.js';

import type * as dtos from './dtos.js';
import {
  UploadCountryPolicyPackDtoSchema,
  ValidateCountryPolicyPackDtoSchema,
  SimulateCountryPolicyPackImpactDtoSchema,
  ApproveCountryPolicyPackDtoSchema,
  PublishCountryPolicyPackDtoSchema,
  ZodValidationPipe,
} from './dtos.js';

@ApiTags('Country Policy')
@Controller('country-policy')
export class CountryPolicyController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly policyPackRepo: CountryPolicyPackRepository,
    private readonly validationRunRepo: CountryPolicyValidationRunRepository,
    private readonly impactSimRepo: CountryPolicyImpactSimulationRepository,
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
    const tenantId = new Uuid(
      (req['tenantId'] as string | undefined) ?? '00000000-0000-0000-0000-000000000001',
    );
    return {
      commandId: Uuid.generate(),
      commandName,
      commandSchemaVersion: 1,
      tenantId,
      actor: {
        actorType: 'SYSTEM',
        actorId: Uuid.generate(),
        roles: ['HR_ADMIN', 'COUNTRY_POLICY_ADMIN'],
        permissions: ['COUNTRY_POLICY_CREATE', 'COUNTRY_POLICY_UPDATE', 'COUNTRY_POLICY_READ', 'COUNTRY_POLICY_APPROVE'],
        mfaAuthenticated: true,
      },
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
        clientType: 'HR_ADMIN',
      },
    };
  }

  /* ---------------------------------------------------------------- */
  /*  Country Policy Packs                                              */
  /* ---------------------------------------------------------------- */

  @Post('policy-packs')
  async uploadCountryPolicyPack(
    @Body(new ZodValidationPipe(UploadCountryPolicyPackDtoSchema)) dto: dtos.UploadCountryPolicyPackDto,
    @Req() req: Request,
  ) {
    const command = this.buildCommand('UploadCountryPolicyPack', 'CountryPolicyPack', dto, req);
    return this.commandBus.execute(command);
  }

  @Post('policy-packs/validate')
  async validateCountryPolicyPack(
    @Body(new ZodValidationPipe(ValidateCountryPolicyPackDtoSchema)) dto: dtos.ValidateCountryPolicyPackDto,
    @Req() req: Request,
  ) {
    const command = this.buildCommand('ValidateCountryPolicyPack', 'CountryPolicyPack', dto, req);
    return this.commandBus.execute(command);
  }

  @Post('policy-packs/simulate')
  async simulateCountryPolicyPackImpact(
    @Body(new ZodValidationPipe(SimulateCountryPolicyPackImpactDtoSchema)) dto: dtos.SimulateCountryPolicyPackImpactDto,
    @Req() req: Request,
  ) {
    const command = this.buildCommand('SimulateCountryPolicyPackImpact', 'CountryPolicyPack', dto, req);
    return this.commandBus.execute(command);
  }

  @Post('policy-packs/approve')
  async approveCountryPolicyPack(
    @Body(new ZodValidationPipe(ApproveCountryPolicyPackDtoSchema)) dto: dtos.ApproveCountryPolicyPackDto,
    @Req() req: Request,
  ) {
    const pack = await this.policyPackRepo.findById(new Uuid(dto.packId));
    if (!pack) throw new BadRequestException('Country policy pack not found');
    const command = this.buildCommand(
      'ApproveCountryPolicyPack',
      'CountryPolicyPack',
      dto,
      req,
      {
        aggregateId: new Uuid(dto.packId),
        expectedState: pack.status,
        expectedVersion: pack.aggregateVersion,
      },
    );
    return this.commandBus.execute(command);
  }

  @Post('policy-packs/publish')
  async publishCountryPolicyPack(
    @Body(new ZodValidationPipe(PublishCountryPolicyPackDtoSchema)) dto: dtos.PublishCountryPolicyPackDto,
    @Req() req: Request,
  ) {
    const pack = await this.policyPackRepo.findById(new Uuid(dto.packId));
    if (!pack) throw new BadRequestException('Country policy pack not found');
    const command = this.buildCommand(
      'PublishCountryPolicyPack',
      'CountryPolicyPack',
      dto,
      req,
      {
        aggregateId: new Uuid(dto.packId),
        expectedState: pack.status,
        expectedVersion: pack.aggregateVersion,
      },
    );
    return this.commandBus.execute(command);
  }

  @Get('policy-packs')
  async listPolicyPacks(@Query('countryCode') countryCode?: string) {
    if (countryCode) {
      return this.policyPackRepo.findByCountryCode(countryCode);
    }
    return [];
  }

  @Get('policy-packs/:id')
  async getPolicyPack(@Param('id') id: string) {
    return this.policyPackRepo.findById(new Uuid(id));
  }

  /* ---------------------------------------------------------------- */
  /*  Validation Runs                                                   */
  /* ---------------------------------------------------------------- */

  @Get('validation-runs/policy-pack/:packId')
  async getValidationRunsByPolicyPack(@Param('packId') packId: string) {
    return this.validationRunRepo.findByPolicyPackId(new Uuid(packId));
  }

  /* ---------------------------------------------------------------- */
  /*  Impact Simulations                                                */
  /* ---------------------------------------------------------------- */

  @Get('impact-simulations/policy-pack/:packId')
  async getImpactSimulationsByPolicyPack(@Param('packId') packId: string) {
    return this.impactSimRepo.findByPolicyPackId(new Uuid(packId));
  }
}

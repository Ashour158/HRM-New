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
import { CountryPolicyPackRepository } from '../repositories/country-policy-pack.repository.js';
import { CountryPolicyValidationRunRepository } from '../repositories/country-policy-validation-run.repository.js';
import { CountryPolicyImpactSimulationRepository } from '../repositories/country-policy-impact-simulation.repository.js';

import type * as dtos from './dtos.js';
import {
  UploadCountryPolicyPackDtoSchema,
  ValidateCountryPolicyPackDtoSchema,
  SimulateCountryPolicyPackImpactDtoSchema,
  SubmitForLegalReviewDtoSchema,
  SubmitForPayrollTaxReviewDtoSchema,
  SubmitForGlobalHRReviewDtoSchema,
  SubmitForBenefitsReviewDtoSchema,
  SubmitForAbsenceReviewDtoSchema,
  SubmitForComplianceReviewDtoSchema,
  SubmitForApprovalDtoSchema,
  ApproveCountryPolicyPackDtoSchema,
  RejectCountryPolicyPackDtoSchema,
  PublishCountryPolicyPackDtoSchema,
  PackIdOnlyDtoSchema,
  SupersedeCountryPolicyPackDtoSchema,
  RollbackCountryPolicyPackDtoSchema,
  ZodValidationPipe,
} from './dtos.js';

const COUNTRY_POLICY_ADMIN_ROLES = new Set([
  'APP_ADMIN',
  'PLATFORM_ADMIN',
  'SUPER_ADMIN',
  'HR_ADMIN',
  'HRBP',
  'COUNTRY_POLICY_ADMIN',
  'GLOBAL_HR_ADMIN',
  'COMPLIANCE_ADMIN',
  'COMPLIANCE_OFFICER',
]);

@ApiTags('Country Policy')
@UseGuards(AuthGuard)
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
    const actor = req.actor;
    if (!actor) throw new ForbiddenException('Country policy commands require an authenticated actor');
    if (!actor.roles.some((role) => COUNTRY_POLICY_ADMIN_ROLES.has(role))) {
      throw new ForbiddenException('Only country policy administrators can manage country policy packs');
    }
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
        clientType: 'HR_ADMIN',
      },
    };
  }

  private assertCountryPolicyAdminScope(req: Request): void {
    const actor = req.actor;
    if (!actor) throw new ForbiddenException('Country policy access requires an authenticated actor');
    if (!actor.roles.some((role) => COUNTRY_POLICY_ADMIN_ROLES.has(role))) {
      throw new ForbiddenException('Only country policy administrators can access country policy administration');
    }
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

  @Post('policy-packs/submit-for-legal-review')
  async submitCountryPolicyPackForLegalReview(
    @Body(new ZodValidationPipe(SubmitForLegalReviewDtoSchema)) dto: dtos.SubmitForLegalReviewDto,
    @Req() req: Request,
  ) {
    const pack = await this.policyPackRepo.findById(new Uuid(dto.packId));
    if (!pack) throw new BadRequestException('Country policy pack not found');
    const command = this.buildCommand(
      'SubmitForLegalReview',
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

  @Post('policy-packs/submit-for-payroll-tax-review')
  async submitCountryPolicyPackForPayrollTaxReview(
    @Body(new ZodValidationPipe(SubmitForPayrollTaxReviewDtoSchema)) dto: dtos.SubmitForPayrollTaxReviewDto,
    @Req() req: Request,
  ) {
    const pack = await this.policyPackRepo.findById(new Uuid(dto.packId));
    if (!pack) throw new BadRequestException('Country policy pack not found');
    const command = this.buildCommand(
      'SubmitForPayrollTaxReview',
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

  @Post('policy-packs/submit-for-global-hr-review')
  async submitCountryPolicyPackForGlobalHRReview(
    @Body(new ZodValidationPipe(SubmitForGlobalHRReviewDtoSchema)) dto: dtos.SubmitForGlobalHRReviewDto,
    @Req() req: Request,
  ) {
    const pack = await this.policyPackRepo.findById(new Uuid(dto.packId));
    if (!pack) throw new BadRequestException('Country policy pack not found');
    const command = this.buildCommand(
      'SubmitForGlobalHRReview',
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

  @Post('policy-packs/submit-for-benefits-review')
  async submitCountryPolicyPackForBenefitsReview(
    @Body(new ZodValidationPipe(SubmitForBenefitsReviewDtoSchema)) dto: dtos.SubmitForBenefitsReviewDto,
    @Req() req: Request,
  ) {
    const pack = await this.policyPackRepo.findById(new Uuid(dto.packId));
    if (!pack) throw new BadRequestException('Country policy pack not found');
    const command = this.buildCommand(
      'SubmitForBenefitsReview',
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

  @Post('policy-packs/submit-for-absence-review')
  async submitCountryPolicyPackForAbsenceReview(
    @Body(new ZodValidationPipe(SubmitForAbsenceReviewDtoSchema)) dto: dtos.SubmitForAbsenceReviewDto,
    @Req() req: Request,
  ) {
    const pack = await this.policyPackRepo.findById(new Uuid(dto.packId));
    if (!pack) throw new BadRequestException('Country policy pack not found');
    const command = this.buildCommand(
      'SubmitForAbsenceReview',
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

  @Post('policy-packs/submit-for-compliance-review')
  async submitCountryPolicyPackForComplianceReview(
    @Body(new ZodValidationPipe(SubmitForComplianceReviewDtoSchema)) dto: dtos.SubmitForComplianceReviewDto,
    @Req() req: Request,
  ) {
    const pack = await this.policyPackRepo.findById(new Uuid(dto.packId));
    if (!pack) throw new BadRequestException('Country policy pack not found');
    const command = this.buildCommand(
      'SubmitForComplianceReview',
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

  @Post('policy-packs/submit-for-approval')
  async submitCountryPolicyPackForApproval(
    @Body(new ZodValidationPipe(SubmitForApprovalDtoSchema)) dto: dtos.SubmitForApprovalDto,
    @Req() req: Request,
  ) {
    const pack = await this.policyPackRepo.findById(new Uuid(dto.packId));
    if (!pack) throw new BadRequestException('Country policy pack not found');
    const command = this.buildCommand(
      'SubmitForApproval',
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

  @Post('policy-packs/reject')
  async rejectCountryPolicyPack(
    @Body(new ZodValidationPipe(RejectCountryPolicyPackDtoSchema)) dto: dtos.RejectCountryPolicyPackDto,
    @Req() req: Request,
  ) {
    const pack = await this.policyPackRepo.findById(new Uuid(dto.packId));
    if (!pack) throw new BadRequestException('Country policy pack not found');
    const command = this.buildCommand(
      'RejectCountryPolicyPack',
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

  @Post('policy-packs/parse')
  async parseCountryPolicyPack(
    @Body(new ZodValidationPipe(PackIdOnlyDtoSchema)) dto: dtos.PackIdOnlyDto,
    @Req() req: Request,
  ) {
    const pack = await this.policyPackRepo.findById(new Uuid(dto.packId));
    if (!pack) throw new BadRequestException('Country policy pack not found');
    const command = this.buildCommand('ParseCountryPolicyPack', 'CountryPolicyPack', dto, req, {
      aggregateId: new Uuid(dto.packId),
      expectedState: pack.status,
      expectedVersion: pack.aggregateVersion,
    });
    return this.commandBus.execute(command);
  }

  @Post('policy-packs/require-simulation')
  async requireCountryPolicyPackImpactSimulation(
    @Body(new ZodValidationPipe(PackIdOnlyDtoSchema)) dto: dtos.PackIdOnlyDto,
    @Req() req: Request,
  ) {
    const pack = await this.policyPackRepo.findById(new Uuid(dto.packId));
    if (!pack) throw new BadRequestException('Country policy pack not found');
    const command = this.buildCommand('RequireCountryPolicyPackImpactSimulation', 'CountryPolicyPack', dto, req, {
      aggregateId: new Uuid(dto.packId),
      expectedState: pack.status,
      expectedVersion: pack.aggregateVersion,
    });
    return this.commandBus.execute(command);
  }

  @Post('policy-packs/schedule-publication')
  async scheduleCountryPolicyPackPublication(
    @Body(new ZodValidationPipe(PackIdOnlyDtoSchema)) dto: dtos.PackIdOnlyDto,
    @Req() req: Request,
  ) {
    const pack = await this.policyPackRepo.findById(new Uuid(dto.packId));
    if (!pack) throw new BadRequestException('Country policy pack not found');
    const command = this.buildCommand('ScheduleCountryPolicyPackPublication', 'CountryPolicyPack', dto, req, {
      aggregateId: new Uuid(dto.packId),
      expectedState: pack.status,
      expectedVersion: pack.aggregateVersion,
    });
    return this.commandBus.execute(command);
  }

  @Post('policy-packs/supersede')
  async supersedeCountryPolicyPack(
    @Body(new ZodValidationPipe(SupersedeCountryPolicyPackDtoSchema)) dto: dtos.SupersedeCountryPolicyPackDto,
    @Req() req: Request,
  ) {
    const pack = await this.policyPackRepo.findById(new Uuid(dto.packId));
    if (!pack) throw new BadRequestException('Country policy pack not found');
    const command = this.buildCommand('SupersedeCountryPolicyPack', 'CountryPolicyPack', dto, req, {
      aggregateId: new Uuid(dto.packId),
      expectedState: pack.status,
      expectedVersion: pack.aggregateVersion,
    });
    return this.commandBus.execute(command);
  }

  @Post('policy-packs/rollback')
  async rollbackCountryPolicyPack(
    @Body(new ZodValidationPipe(RollbackCountryPolicyPackDtoSchema)) dto: dtos.RollbackCountryPolicyPackDto,
    @Req() req: Request,
  ) {
    const pack = await this.policyPackRepo.findById(new Uuid(dto.packId));
    if (!pack) throw new BadRequestException('Country policy pack not found');
    const command = this.buildCommand('RollbackCountryPolicyPack', 'CountryPolicyPack', dto, req, {
      aggregateId: new Uuid(dto.packId),
      expectedState: pack.status,
      expectedVersion: pack.aggregateVersion,
    });
    return this.commandBus.execute(command);
  }

  @Post('policy-packs/retire')
  async retireCountryPolicyPack(
    @Body(new ZodValidationPipe(PackIdOnlyDtoSchema)) dto: dtos.PackIdOnlyDto,
    @Req() req: Request,
  ) {
    const pack = await this.policyPackRepo.findById(new Uuid(dto.packId));
    if (!pack) throw new BadRequestException('Country policy pack not found');
    const command = this.buildCommand('RetireCountryPolicyPack', 'CountryPolicyPack', dto, req, {
      aggregateId: new Uuid(dto.packId),
      expectedState: pack.status,
      expectedVersion: pack.aggregateVersion,
    });
    return this.commandBus.execute(command);
  }

  @Post('policy-packs/quarantine')
  async quarantineCountryPolicyPack(
    @Body(new ZodValidationPipe(PackIdOnlyDtoSchema)) dto: dtos.PackIdOnlyDto,
    @Req() req: Request,
  ) {
    const pack = await this.policyPackRepo.findById(new Uuid(dto.packId));
    if (!pack) throw new BadRequestException('Country policy pack not found');
    const command = this.buildCommand('QuarantineCountryPolicyPack', 'CountryPolicyPack', dto, req, {
      aggregateId: new Uuid(dto.packId),
      expectedState: pack.status,
      expectedVersion: pack.aggregateVersion,
    });
    return this.commandBus.execute(command);
  }

  @Get('policy-packs')
  async listPolicyPacks(@Query('countryCode') countryCode: string | undefined, @Req() req: Request) {
    this.assertCountryPolicyAdminScope(req);
    if (countryCode) {
      return this.policyPackRepo.findByCountryCode(countryCode);
    }
    return this.policyPackRepo.findAll();
  }

  @Get('policy-packs/:id')
  async getPolicyPack(@Param('id') id: string, @Req() req: Request) {
    this.assertCountryPolicyAdminScope(req);
    return this.policyPackRepo.findById(new Uuid(id));
  }

  /* ---------------------------------------------------------------- */
  /*  Validation Runs                                                   */
  /* ---------------------------------------------------------------- */

  @Get('validation-runs/policy-pack/:packId')
  async getValidationRunsByPolicyPack(@Param('packId') packId: string, @Req() req: Request) {
    this.assertCountryPolicyAdminScope(req);
    return this.validationRunRepo.findByPolicyPackId(new Uuid(packId));
  }

  /* ---------------------------------------------------------------- */
  /*  Impact Simulations                                                */
  /* ---------------------------------------------------------------- */

  @Get('impact-simulations/policy-pack/:packId')
  async getImpactSimulationsByPolicyPack(@Param('packId') packId: string, @Req() req: Request) {
    this.assertCountryPolicyAdminScope(req);
    return this.impactSimRepo.findByPolicyPackId(new Uuid(packId));
  }
}

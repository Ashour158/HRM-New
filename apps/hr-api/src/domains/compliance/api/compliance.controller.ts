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
import { PolicyDocumentRepository } from '../repositories/policy-document.repository.js';
import { PolicyAcknowledgementRepository } from '../repositories/policy-acknowledgement.repository.js';
import { LegalHoldRepository } from '../repositories/legal-hold.repository.js';
import { StatutoryReportRepository } from '../repositories/statutory-report.repository.js';

import type * as dtos from './dtos.js';
import {
  CreatePolicyDocumentDtoSchema,
  RequirePolicyAcknowledgementDtoSchema,
  PlaceLegalHoldDtoSchema,
  ReleaseLegalHoldDtoSchema,
  SubmitStatutoryReportDtoSchema,
  ZodValidationPipe,
} from './dtos.js';

@ApiTags('Compliance')
@Controller('compliance')
export class ComplianceController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly policyDocumentRepo: PolicyDocumentRepository,
    private readonly policyAcknowledgementRepo: PolicyAcknowledgementRepository,
    private readonly legalHoldRepo: LegalHoldRepository,
    private readonly statutoryReportRepo: StatutoryReportRepository,
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
        roles: ['HR_ADMIN', 'COMPLIANCE_ADMIN'],
        permissions: ['COMPLIANCE_CREATE', 'COMPLIANCE_UPDATE', 'COMPLIANCE_READ'],
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
  /*  Policy Documents                                                  */
  /* ---------------------------------------------------------------- */

  @Post('policy-documents')
  async createPolicyDocument(
    @Body(new ZodValidationPipe(CreatePolicyDocumentDtoSchema)) dto: dtos.CreatePolicyDocumentDto,
    @Req() req: Request,
  ) {
    const command = this.buildCommand('CreatePolicyDocument', 'PolicyDocument', dto, req);
    return this.commandBus.execute(command);
  }

  @Post('policy-documents/:id/commands/approve')
  async approvePolicyDocument(@Param('id') id: string, @Req() req: Request) {
    const doc = await this.policyDocumentRepo.findById(new Uuid(id));
    if (!doc) throw new BadRequestException('Policy document not found');
    const command = this.buildCommand(
      'ApprovePolicyDocument',
      'PolicyDocument',
      { documentId: id },
      req,
      {
        aggregateId: new Uuid(id),
        expectedState: doc.status,
        expectedVersion: doc.aggregateVersion,
      },
    );
    return this.commandBus.execute(command);
  }

  @Post('policy-documents/:id/commands/publish')
  async publishPolicyDocument(@Param('id') id: string, @Req() req: Request) {
    const doc = await this.policyDocumentRepo.findById(new Uuid(id));
    if (!doc) throw new BadRequestException('Policy document not found');
    const command = this.buildCommand(
      'PublishPolicyDocument',
      'PolicyDocument',
      { documentId: id },
      req,
      {
        aggregateId: new Uuid(id),
        expectedState: doc.status,
        expectedVersion: doc.aggregateVersion,
      },
    );
    return this.commandBus.execute(command);
  }

  @Get('policy-documents')
  async listPolicyDocuments(@Query('status') status?: string) {
    if (status) {
      return this.policyDocumentRepo.findByStatus(status);
    }
    return this.policyDocumentRepo.findByStatus('DRAFT');
  }

  @Get('policy-documents/:id')
  async getPolicyDocument(@Param('id') id: string) {
    return this.policyDocumentRepo.findById(new Uuid(id));
  }

  /* ---------------------------------------------------------------- */
  /*  Policy Acknowledgements                                           */
  /* ---------------------------------------------------------------- */

  @Post('policy-acknowledgements')
  async requirePolicyAcknowledgement(
    @Body(new ZodValidationPipe(RequirePolicyAcknowledgementDtoSchema)) dto: dtos.RequirePolicyAcknowledgementDto,
    @Req() req: Request,
  ) {
    const command = this.buildCommand('RequirePolicyAcknowledgement', 'PolicyAcknowledgement', dto, req);
    return this.commandBus.execute(command);
  }

  @Post('policy-acknowledgements/:id/commands/acknowledge')
  async recordPolicyAcknowledgement(@Param('id') id: string, @Req() req: Request) {
    const ack = await this.policyAcknowledgementRepo.findById(new Uuid(id));
    if (!ack) throw new BadRequestException('Policy acknowledgement not found');
    const command = this.buildCommand(
      'RecordPolicyAcknowledgement',
      'PolicyAcknowledgement',
      { requirementId: id },
      req,
      {
        aggregateId: new Uuid(id),
        expectedState: ack.status,
        expectedVersion: ack.aggregateVersion,
        subjectWorkerId: ack.workerId,
      },
    );
    return this.commandBus.execute(command);
  }

  @Get('policy-acknowledgements/worker/:workerId')
  async getPolicyAcknowledgementsByWorker(@Param('workerId') workerId: string) {
    return this.policyAcknowledgementRepo.findByWorker(new Uuid(workerId));
  }

  /* ---------------------------------------------------------------- */
  /*  Legal Holds                                                       */
  /* ---------------------------------------------------------------- */

  @Post('legal-holds')
  async placeLegalHold(
    @Body(new ZodValidationPipe(PlaceLegalHoldDtoSchema)) dto: dtos.PlaceLegalHoldDto,
    @Req() req: Request,
  ) {
    const command = this.buildCommand('PlaceLegalHold', 'LegalHold', dto, req);
    return this.commandBus.execute(command);
  }

  @Post('legal-holds/:id/commands/release')
  async releaseLegalHold(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(ReleaseLegalHoldDtoSchema)) dto: dtos.ReleaseLegalHoldDto,
    @Req() req: Request,
  ) {
    const hold = await this.legalHoldRepo.findById(new Uuid(id));
    if (!hold) throw new BadRequestException('Legal hold not found');
    const command = this.buildCommand(
      'ReleaseLegalHold',
      'LegalHold',
      { holdId: id, releasedByWorkerId: dto.releasedByWorkerId },
      req,
      {
        aggregateId: new Uuid(id),
        expectedState: hold.status,
        expectedVersion: hold.aggregateVersion,
      },
    );
    return this.commandBus.execute(command);
  }

  @Get('legal-holds')
  async listLegalHolds() {
    return this.legalHoldRepo.findActive();
  }

  @Get('legal-holds/:id')
  async getLegalHold(@Param('id') id: string) {
    return this.legalHoldRepo.findById(new Uuid(id));
  }

  /* ---------------------------------------------------------------- */
  /*  Statutory Reports                                                 */
  /* ---------------------------------------------------------------- */

  @Post('statutory-reports')
  async submitStatutoryReport(
    @Body(new ZodValidationPipe(SubmitStatutoryReportDtoSchema)) dto: dtos.SubmitStatutoryReportDto,
    @Req() req: Request,
  ) {
    const command = this.buildCommand('SubmitStatutoryReport', 'StatutoryReport', dto, req);
    return this.commandBus.execute(command);
  }

  @Get('statutory-reports')
  async listStatutoryReports(@Query('countryCode') countryCode?: string) {
    if (countryCode) {
      return this.statutoryReportRepo.findByCountryCode(countryCode);
    }
    return [];
  }

  @Get('statutory-reports/:id')
  async getStatutoryReport(@Param('id') id: string) {
    return this.statutoryReportRepo.findById(new Uuid(id));
  }
}

import { z } from 'zod';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PipeTransform, Injectable, BadRequestException } from '@nestjs/common';

/* ------------------------------------------------------------------ */
/*  Country Rule Set DTOs                                              */
/* ------------------------------------------------------------------ */

export const CreateCountryRuleSetDtoSchema = z.object({
  ruleSetId: z.string().uuid(),
  countryCode: z.string().length(2),
  ruleSetType: z.string().min(1),
  version: z.string().min(1),
  effectiveFrom: z.coerce.date(),
  effectiveUntil: z.coerce.date().optional(),
  rules: z.record(z.unknown()),
});

export class CreateCountryRuleSetDto {
  @ApiProperty() ruleSetId!: string;
  @ApiProperty() countryCode!: string;
  @ApiProperty() ruleSetType!: string;
  @ApiProperty() version!: string;
  @ApiProperty() effectiveFrom!: Date;
  @ApiPropertyOptional() effectiveUntil?: Date;
  @ApiProperty() rules!: Record<string, unknown>;
}

/* ------------------------------------------------------------------ */
/*  Statutory Leave Type DTOs                                          */
/* ------------------------------------------------------------------ */

export const CreateStatutoryLeaveTypeDtoSchema = z.object({
  leaveTypeId: z.string().uuid(),
  countryCode: z.string().length(2),
  leaveTypeCode: z.string().min(1),
  leaveTypeName: z.string().min(1),
  minimumEntitlement: z.number().min(0),
  unit: z.string().min(1),
  carryoverAllowed: z.boolean(),
  maxCarryover: z.number().min(0),
  effectiveFrom: z.coerce.date(),
});

export class CreateStatutoryLeaveTypeDto {
  @ApiProperty() leaveTypeId!: string;
  @ApiProperty() countryCode!: string;
  @ApiProperty() leaveTypeCode!: string;
  @ApiProperty() leaveTypeName!: string;
  @ApiProperty() minimumEntitlement!: number;
  @ApiProperty() unit!: string;
  @ApiProperty() carryoverAllowed!: boolean;
  @ApiProperty() maxCarryover!: number;
  @ApiProperty() effectiveFrom!: Date;
}

/* ------------------------------------------------------------------ */
/*  Works Council Consultation DTOs                                    */
/* ------------------------------------------------------------------ */

export const CreateWorksCouncilConsultationDtoSchema = z.object({
  consultationId: z.string().uuid(),
  countryCode: z.string().length(2),
  legalEntityId: z.string().uuid(),
  actionType: z.string().min(1),
  consultationType: z.string().min(1),
  deadlineDate: z.coerce.date().optional(),
});

export class CreateWorksCouncilConsultationDto {
  @ApiProperty() consultationId!: string;
  @ApiProperty() countryCode!: string;
  @ApiProperty() legalEntityId!: string;
  @ApiProperty() actionType!: string;
  @ApiProperty() consultationType!: string;
  @ApiPropertyOptional() deadlineDate?: Date;
}

/* ------------------------------------------------------------------ */
/*  Work Authorization Case DTOs                                       */
/* ------------------------------------------------------------------ */

export const CreateWorkAuthorizationCaseDtoSchema = z.object({
  caseId: z.string().uuid(),
  workerId: z.string().uuid(),
  authorizationType: z.string().min(1),
  issuingCountry: z.string().length(2),
  documentNumber: z.string().optional(),
  validFrom: z.coerce.date().optional(),
  validUntil: z.coerce.date().optional(),
});

export class CreateWorkAuthorizationCaseDto {
  @ApiProperty() caseId!: string;
  @ApiProperty() workerId!: string;
  @ApiProperty() authorizationType!: string;
  @ApiProperty() issuingCountry!: string;
  @ApiPropertyOptional() documentNumber?: string;
  @ApiPropertyOptional() validFrom?: Date;
  @ApiPropertyOptional() validUntil?: Date;
}

export const ApproveWorkAuthorizationCaseDtoSchema = z.object({
  validFrom: z.coerce.date(),
  validUntil: z.coerce.date(),
  documentNumber: z.string().optional(),
});

export class ApproveWorkAuthorizationCaseDto {
  @ApiProperty() validFrom!: Date;
  @ApiProperty() validUntil!: Date;
  @ApiPropertyOptional() documentNumber?: string;
}

export const RenewWorkAuthorizationCaseDtoSchema = z.object({
  newValidUntil: z.coerce.date(),
});

export class RenewWorkAuthorizationCaseDto {
  @ApiProperty() newValidUntil!: Date;
}

/* ------------------------------------------------------------------ */
/*  International Assignment DTOs                                      */
/* ------------------------------------------------------------------ */

export const CreateInternationalAssignmentDtoSchema = z.object({
  assignmentId: z.string().uuid(),
  workerId: z.string().uuid(),
  homeCountry: z.string().length(2),
  hostCountry: z.string().length(2),
  legalEntityId: z.string().uuid().optional(),
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
  assignmentReason: z.string().min(1),
});

export class CreateInternationalAssignmentDto {
  @ApiProperty() assignmentId!: string;
  @ApiProperty() workerId!: string;
  @ApiProperty() homeCountry!: string;
  @ApiProperty() hostCountry!: string;
  @ApiPropertyOptional() legalEntityId?: string;
  @ApiProperty() startDate!: Date;
  @ApiProperty() endDate!: Date;
  @ApiProperty() assignmentReason!: string;
}

/* ------------------------------------------------------------------ */
/*  Zod Validation Pipe                                                */
/* ------------------------------------------------------------------ */

@Injectable()
export class ZodValidationPipe implements PipeTransform {
  constructor(private schema: z.ZodTypeAny) {}

  transform(value: unknown): unknown {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      throw new BadRequestException(result.error.format());
    }
    return result.data;
  }
}

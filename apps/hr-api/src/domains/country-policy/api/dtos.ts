import { z } from 'zod';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PipeTransform, Injectable, BadRequestException } from '@nestjs/common';

/* ------------------------------------------------------------------ */
/*  Country Policy Pack DTOs                                           */
/* ------------------------------------------------------------------ */

export const UploadCountryPolicyPackDtoSchema = z.object({
  packId: z.string().uuid(),
  countryCode: z.string().length(2),
  version: z.string().min(1),
  effectiveFrom: z.coerce.date(),
  sections: z.record(z.unknown()).optional(),
  uploadedBy: z.string().uuid(),
});

export class UploadCountryPolicyPackDto {
  @ApiProperty() packId!: string;
  @ApiProperty() countryCode!: string;
  @ApiProperty() version!: string;
  @ApiProperty() effectiveFrom!: Date;
  @ApiPropertyOptional() sections?: Record<string, unknown>;
  @ApiProperty() uploadedBy!: string;
}

export const ValidateCountryPolicyPackDtoSchema = z.object({
  packId: z.string().uuid(),
  validationRunId: z.string().uuid(),
  validationType: z.string().min(1),
});

export class ValidateCountryPolicyPackDto {
  @ApiProperty() packId!: string;
  @ApiProperty() validationRunId!: string;
  @ApiProperty() validationType!: string;
}

export const SimulateCountryPolicyPackImpactDtoSchema = z.object({
  packId: z.string().uuid(),
  simulationRunId: z.string().uuid(),
  simulationScope: z.string().min(1),
});

export class SimulateCountryPolicyPackImpactDto {
  @ApiProperty() packId!: string;
  @ApiProperty() simulationRunId!: string;
  @ApiProperty() simulationScope!: string;
}

export const SubmitForLegalReviewDtoSchema = z.object({
  packId: z.string().uuid(),
});

export class SubmitForLegalReviewDto {
  @ApiProperty() packId!: string;
}

export const SubmitForPayrollTaxReviewDtoSchema = z.object({
  packId: z.string().uuid(),
});

export class SubmitForPayrollTaxReviewDto {
  @ApiProperty() packId!: string;
}

export const SubmitForGlobalHRReviewDtoSchema = z.object({
  packId: z.string().uuid(),
});

export class SubmitForGlobalHRReviewDto {
  @ApiProperty() packId!: string;
}

export const SubmitForBenefitsReviewDtoSchema = z.object({
  packId: z.string().uuid(),
});

export class SubmitForBenefitsReviewDto {
  @ApiProperty() packId!: string;
}

export const SubmitForAbsenceReviewDtoSchema = z.object({
  packId: z.string().uuid(),
});

export class SubmitForAbsenceReviewDto {
  @ApiProperty() packId!: string;
}

export const SubmitForComplianceReviewDtoSchema = z.object({
  packId: z.string().uuid(),
});

export class SubmitForComplianceReviewDto {
  @ApiProperty() packId!: string;
}

export const SubmitForApprovalDtoSchema = z.object({
  packId: z.string().uuid(),
});

export class SubmitForApprovalDto {
  @ApiProperty() packId!: string;
}

export const RejectCountryPolicyPackDtoSchema = z.object({
  packId: z.string().uuid(),
  rejectedBy: z.string().uuid(),
  reason: z.string().min(1),
});

export class RejectCountryPolicyPackDto {
  @ApiProperty() packId!: string;
  @ApiProperty() rejectedBy!: string;
  @ApiProperty() reason!: string;
}

export const ApproveCountryPolicyPackDtoSchema = z.object({
  packId: z.string().uuid(),
  approvedBy: z.string().uuid(),
});

export class ApproveCountryPolicyPackDto {
  @ApiProperty() packId!: string;
  @ApiProperty() approvedBy!: string;
}

export const PublishCountryPolicyPackDtoSchema = z.object({
  packId: z.string().uuid(),
  publishedBy: z.string().uuid(),
});

export class PublishCountryPolicyPackDto {
  @ApiProperty() packId!: string;
  @ApiProperty() publishedBy!: string;
}

export const PackIdOnlyDtoSchema = z.object({
  packId: z.string().uuid(),
});

export class PackIdOnlyDto {
  @ApiProperty() packId!: string;
}

export const SupersedeCountryPolicyPackDtoSchema = z.object({
  packId: z.string().uuid(),
  supersededBy: z.string().uuid(),
});

export class SupersedeCountryPolicyPackDto {
  @ApiProperty() packId!: string;
  @ApiProperty() supersededBy!: string;
}

export const RollbackCountryPolicyPackDtoSchema = z.object({
  packId: z.string().uuid(),
  rollbackReason: z.string().min(1),
});

export class RollbackCountryPolicyPackDto {
  @ApiProperty() packId!: string;
  @ApiProperty() rollbackReason!: string;
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

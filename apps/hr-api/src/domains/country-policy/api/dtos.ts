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

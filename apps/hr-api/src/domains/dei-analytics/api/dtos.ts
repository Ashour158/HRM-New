import { z } from 'zod';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PipeTransform, Injectable, BadRequestException } from '@nestjs/common';

export const CreateDeiReportDtoSchema = z.object({
  deiReportId: z.string().uuid(),
  reportType: z.string().min(1),
  reportingPeriod: z.string().min(1),
  countryCode: z.string().length(2),
  legalEntityId: z.string().uuid(),
});
export class CreateDeiReportDto {
  @ApiProperty() deiReportId!: string;
  @ApiProperty() reportType!: string;
  @ApiProperty() reportingPeriod!: string;
  @ApiProperty() countryCode!: string;
  @ApiProperty() legalEntityId!: string;
}

export const GenerateDeiReportDtoSchema = z.object({
  deiReportId: z.string().uuid(),
  metrics: z.record(z.unknown()),
});
export class GenerateDeiReportDto {
  @ApiProperty() deiReportId!: string;
  @ApiProperty() metrics!: Record<string, unknown>;
}

export const CreatePayGapReportDtoSchema = z.object({
  payGapReportId: z.string().uuid(),
  reportType: z.enum(['GENDER_PAY_GAP', 'ETHNICITY_PAY_GAP']),
  reportingYear: z.number().int(),
  countryCode: z.string().length(2),
});
export class CreatePayGapReportDto {
  @ApiProperty() payGapReportId!: string;
  @ApiProperty() reportType!: 'GENDER_PAY_GAP' | 'ETHNICITY_PAY_GAP';
  @ApiProperty() reportingYear!: number;
  @ApiProperty() countryCode!: string;
}

export const CalculatePayGapReportDtoSchema = z.object({
  payGapReportId: z.string().uuid(),
  meanHourlyGap: z.number(),
  medianHourlyGap: z.number(),
  quartileDistribution: z.record(z.unknown()),
});
export class CalculatePayGapReportDto {
  @ApiProperty() payGapReportId!: string;
  @ApiProperty() meanHourlyGap!: number;
  @ApiProperty() medianHourlyGap!: number;
  @ApiProperty() quartileDistribution!: Record<string, unknown>;
}

export const CreatePayEquityReviewDtoSchema = z.object({
  payEquityReviewId: z.string().uuid(),
  reviewName: z.string().min(1),
  reviewPeriod: z.string().min(1),
});
export class CreatePayEquityReviewDto {
  @ApiProperty() payEquityReviewId!: string;
  @ApiProperty() reviewName!: string;
  @ApiProperty() reviewPeriod!: string;
}

export const RecordPayEquityFindingsDtoSchema = z.object({
  payEquityReviewId: z.string().uuid(),
  findings: z.record(z.unknown()),
});
export class RecordPayEquityFindingsDto {
  @ApiProperty() payEquityReviewId!: string;
  @ApiProperty() findings!: Record<string, unknown>;
}

export const StartPayEquityRemediationDtoSchema = z.object({
  payEquityReviewId: z.string().uuid(),
  remediationActions: z.record(z.unknown()),
});
export class StartPayEquityRemediationDto {
  @ApiProperty() payEquityReviewId!: string;
  @ApiProperty() remediationActions!: Record<string, unknown>;
}

export const ClosePayEquityReviewDtoSchema = z.object({
  payEquityReviewId: z.string().uuid(),
  completedActions: z.record(z.unknown()).optional(),
});
export class ClosePayEquityReviewDto {
  @ApiProperty() payEquityReviewId!: string;
  @ApiPropertyOptional() completedActions?: Record<string, unknown>;
}

export const CreateAttritionSegmentReportDtoSchema = z.object({
  attritionSegmentReportId: z.string().uuid(),
  reportPeriod: z.string().min(1),
  segmentType: z.string().min(1),
});
export class CreateAttritionSegmentReportDto {
  @ApiProperty() attritionSegmentReportId!: string;
  @ApiProperty() reportPeriod!: string;
  @ApiProperty() segmentType!: string;
}

export const GenerateAttritionSegmentReportDtoSchema = z.object({
  attritionSegmentReportId: z.string().uuid(),
  segments: z.record(z.unknown()),
});
export class GenerateAttritionSegmentReportDto {
  @ApiProperty() attritionSegmentReportId!: string;
  @ApiProperty() segments!: Record<string, unknown>;
}

@Injectable()
export class ZodValidationPipe implements PipeTransform {
  constructor(private schema: z.ZodTypeAny) {}
  transform(value: unknown): unknown {
    const result = this.schema.safeParse(value);
    if (!result.success) throw new BadRequestException(result.error.format());
    return result.data;
  }
}

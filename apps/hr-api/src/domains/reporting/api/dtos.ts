import { z } from 'zod';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PipeTransform, Injectable, BadRequestException } from '@nestjs/common';

export const CreateReportDefinitionDtoSchema = z.object({
  reportDefinitionId: z.string().uuid(),
  reportName: z.string().min(1),
  reportType: z.string().min(1),
  dataSource: z.string().min(1),
  queryDefinition: z.record(z.unknown()).optional(),
  parameters: z.record(z.unknown()).optional(),
  schedule: z.record(z.unknown()).optional(),
});
export class CreateReportDefinitionDto {
  @ApiProperty() reportDefinitionId!: string;
  @ApiProperty() reportName!: string;
  @ApiProperty() reportType!: string;
  @ApiProperty() dataSource!: string;
  @ApiPropertyOptional() queryDefinition?: Record<string, unknown>;
  @ApiPropertyOptional() parameters?: Record<string, unknown>;
  @ApiPropertyOptional() schedule?: Record<string, unknown>;
}

export const PreviewReportDefinitionDtoSchema = z.object({
  dataSource: z.string().min(1),
  queryDefinition: z.record(z.unknown()).optional(),
  parameters: z.record(z.unknown()).optional(),
});
export class PreviewReportDefinitionDto {
  @ApiProperty() dataSource!: string;
  @ApiPropertyOptional() queryDefinition?: Record<string, unknown>;
  @ApiPropertyOptional() parameters?: Record<string, unknown>;
}

export const RunReportAnalyticsDtoSchema = z.object({
  packCode: z.string().min(1),
  scopeLevel: z.string().optional(),
  populationValue: z.string().optional(),
  period: z.string().optional(),
  selectedReportCodes: z.array(z.string()).optional(),
  filters: z.array(z.object({ code: z.string(), value: z.string() })).optional(),
});
export class RunReportAnalyticsDto {
  @ApiProperty() packCode!: string;
  @ApiPropertyOptional() scopeLevel?: string;
  @ApiPropertyOptional() populationValue?: string;
  @ApiPropertyOptional() period?: string;
  @ApiPropertyOptional() selectedReportCodes?: string[];
  @ApiPropertyOptional() filters?: Array<{ code: string; value: string }>;
}

export const RunSmartAnalyticsCategoryDtoSchema = z.object({
  categoryCode: z.string().min(1),
  scopeLevel: z.string().optional(),
  populationValue: z.string().optional(),
  period: z.string().optional(),
  selectedInsightCodes: z.array(z.string()).optional(),
  filters: z.array(z.object({ code: z.string(), value: z.string() })).optional(),
});
export class RunSmartAnalyticsCategoryDto {
  @ApiProperty() categoryCode!: string;
  @ApiPropertyOptional() scopeLevel?: string;
  @ApiPropertyOptional() populationValue?: string;
  @ApiPropertyOptional() period?: string;
  @ApiPropertyOptional() selectedInsightCodes?: string[];
  @ApiPropertyOptional() filters?: Array<{ code: string; value: string }>;
}

export const CreateReportExecutionDtoSchema = z.object({
  reportExecutionId: z.string().uuid(),
  reportDefinitionId: z.string().uuid(),
  executedBy: z.string().uuid(),
  parameters: z.record(z.unknown()).optional(),
});
export class CreateReportExecutionDto {
  @ApiProperty() reportExecutionId!: string;
  @ApiProperty() reportDefinitionId!: string;
  @ApiProperty() executedBy!: string;
  @ApiPropertyOptional() parameters?: Record<string, unknown>;
}

export const CompleteReportExecutionDtoSchema = z.object({
  reportExecutionId: z.string().uuid(),
  resultUrl: z.string().min(1),
  rowCount: z.number().int().min(0),
});
export class CompleteReportExecutionDto {
  @ApiProperty() reportExecutionId!: string;
  @ApiProperty() resultUrl!: string;
  @ApiProperty() rowCount!: number;
}

export const FailReportExecutionDtoSchema = z.object({
  reportExecutionId: z.string().uuid(),
  reason: z.string().min(1),
});
export class FailReportExecutionDto {
  @ApiProperty() reportExecutionId!: string;
  @ApiProperty() reason!: string;
}

export const CreateReportScheduleDtoSchema = z.object({
  reportScheduleId: z.string().uuid(),
  reportDefinitionId: z.string().uuid(),
  frequency: z.string().min(1),
  recipients: z.array(z.string()).optional(),
  nextRunAt: z.coerce.date().optional(),
});
export class CreateReportScheduleDto {
  @ApiProperty() reportScheduleId!: string;
  @ApiProperty() reportDefinitionId!: string;
  @ApiProperty() frequency!: string;
  @ApiPropertyOptional() recipients?: string[];
  @ApiPropertyOptional() nextRunAt?: Date;
}

export const CreateCalculatedFieldDtoSchema = z.object({
  calculatedFieldId: z.string().uuid(),
  fieldName: z.string().min(1),
  expression: z.string().min(1),
  dataType: z.string().min(1),
  sourceFields: z.array(z.string()).optional(),
});
export class CreateCalculatedFieldDto {
  @ApiProperty() calculatedFieldId!: string;
  @ApiProperty() fieldName!: string;
  @ApiProperty() expression!: string;
  @ApiProperty() dataType!: string;
  @ApiPropertyOptional() sourceFields?: string[];
}

export const HrAnalyticsQueryDtoSchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
});
export class HrAnalyticsQueryDto {
  @ApiPropertyOptional() from?: string;
  @ApiPropertyOptional() to?: string;
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

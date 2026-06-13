import { z } from 'zod';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PipeTransform, Injectable, BadRequestException } from '@nestjs/common';

export const CreateEngagementSurveyDtoSchema = z.object({
  title: z.string().min(1),
  surveyType: z.string().min(1),
  questions: z.array(z.record(z.unknown())).optional(),
  anonymous: z.boolean().optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
});

export class CreateEngagementSurveyDto {
  @ApiProperty() title!: string;
  @ApiProperty() surveyType!: string;
  @ApiPropertyOptional() questions?: Record<string, unknown>[];
  @ApiPropertyOptional() anonymous?: boolean;
  @ApiPropertyOptional() startDate?: Date;
  @ApiPropertyOptional() endDate?: Date;
}

export const CreateSurveyResponseDtoSchema = z.object({
  surveyId: z.string().uuid(),
  workerId: z.string().uuid(),
  isAnonymous: z.boolean().optional(),
});

export class CreateSurveyResponseDto {
  @ApiProperty() surveyId!: string;
  @ApiProperty() workerId!: string;
  @ApiPropertyOptional() isAnonymous?: boolean;
}

export const CompleteSurveyResponseDtoSchema = z.object({
  responses: z.record(z.unknown()),
});

export class CompleteSurveyResponseDto {
  @ApiProperty() responses!: Record<string, unknown>;
}

export const CreateFeedback360CycleDtoSchema = z.object({
  subjectWorkerId: z.string().uuid(),
  reviewers: z.array(z.string()).optional(),
  competencies: z.array(z.string().min(1)).optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
});

export class CreateFeedback360CycleDto {
  @ApiProperty() subjectWorkerId!: string;
  @ApiPropertyOptional() reviewers?: string[];
  @ApiPropertyOptional() competencies?: string[];
  @ApiPropertyOptional() startDate?: Date;
  @ApiPropertyOptional() endDate?: Date;
}

export const SubmitFeedback360ResponseDtoSchema = z.object({
  reviewerWorkerId: z.string().uuid(),
  relationship: z.string().min(1).optional(),
  competencyScores: z.record(z.number()).optional(),
  comments: z.string().optional(),
});

export class SubmitFeedback360ResponseDto {
  @ApiProperty() reviewerWorkerId!: string;
  @ApiPropertyOptional() relationship?: string;
  @ApiPropertyOptional() competencyScores?: Record<string, number>;
  @ApiPropertyOptional() comments?: string;
}

export const CreateRecognitionProgramDtoSchema = z.object({
  programName: z.string().min(1),
  programType: z.string().min(1),
  budget: z.number().optional(),
  currency: z.string().optional(),
});

export class CreateRecognitionProgramDto {
  @ApiProperty() programName!: string;
  @ApiProperty() programType!: string;
  @ApiPropertyOptional() budget?: number;
  @ApiPropertyOptional() currency?: string;
}

export const CreateRecognitionRecordDtoSchema = z.object({
  fromWorkerId: z.string().uuid(),
  toWorkerId: z.string().uuid(),
  programId: z.string().uuid(),
  points: z.number().optional(),
  message: z.string().optional(),
});

export class CreateRecognitionRecordDto {
  @ApiProperty() fromWorkerId!: string;
  @ApiProperty() toWorkerId!: string;
  @ApiProperty() programId!: string;
  @ApiPropertyOptional() points?: number;
  @ApiPropertyOptional() message?: string;
}

export const ApproveRecognitionRecordDtoSchema = z.object({
  approvedBy: z.string().uuid(),
});

export class ApproveRecognitionRecordDto {
  @ApiProperty() approvedBy!: string;
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

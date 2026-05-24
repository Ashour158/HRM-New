import { z } from 'zod';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PipeTransform, Injectable, BadRequestException } from '@nestjs/common';

export const CreatePerformanceReviewCycleDtoSchema = z.object({
  name: z.string().min(1),
  cycleYear: z.number().int(),
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
  reviewType: z.string().min(1),
});

export class CreatePerformanceReviewCycleDto {
  @ApiProperty() name!: string;
  @ApiProperty() cycleYear!: number;
  @ApiProperty() startDate!: Date;
  @ApiProperty() endDate!: Date;
  @ApiProperty() reviewType!: string;
}

export const CreatePerformanceReviewDtoSchema = z.object({
  workerId: z.string().uuid(),
  reviewCycleId: z.string().uuid(),
  managerId: z.string().uuid(),
});

export class CreatePerformanceReviewDto {
  @ApiProperty() workerId!: string;
  @ApiProperty() reviewCycleId!: string;
  @ApiProperty() managerId!: string;
}

export const SubmitSelfReviewDtoSchema = z.object({
  content: z.string().min(1),
});

export class SubmitSelfReviewDto {
  @ApiProperty() content!: string;
}

export const SubmitManagerReviewDtoSchema = z.object({
  content: z.string().min(1),
});

export class SubmitManagerReviewDto {
  @ApiProperty() content!: string;
}

export const CalibratePerformanceReviewDtoSchema = z.object({
  rating: z.number(),
});

export class CalibratePerformanceReviewDto {
  @ApiProperty() rating!: number;
}

export const FinalizePerformanceReviewDtoSchema = z.object({
  rating: z.number(),
});

export class FinalizePerformanceReviewDto {
  @ApiProperty() rating!: number;
}

export const CreateGoalDtoSchema = z.object({
  workerId: z.string().uuid(),
  title: z.string().min(1),
  description: z.string().optional(),
  targetValue: z.number().optional(),
  unit: z.string().optional(),
  startDate: z.coerce.date().optional(),
  dueDate: z.coerce.date().optional(),
});

export class CreateGoalDto {
  @ApiProperty() workerId!: string;
  @ApiProperty() title!: string;
  @ApiPropertyOptional() description?: string;
  @ApiPropertyOptional() targetValue?: number;
  @ApiPropertyOptional() unit?: string;
  @ApiPropertyOptional() startDate?: Date;
  @ApiPropertyOptional() dueDate?: Date;
}

export const UpdateGoalProgressDtoSchema = z.object({
  currentValue: z.number(),
});

export class UpdateGoalProgressDto {
  @ApiProperty() currentValue!: number;
}

export const CreateCalibrationSessionDtoSchema = z.object({
  reviewCycleId: z.string().uuid(),
  facilitatorId: z.string().uuid(),
  participants: z.array(z.string()).optional(),
});

export class CreateCalibrationSessionDto {
  @ApiProperty() reviewCycleId!: string;
  @ApiProperty() facilitatorId!: string;
  @ApiPropertyOptional() participants?: string[];
}

export const CreatePerformanceImprovementPlanDtoSchema = z.object({
  workerId: z.string().uuid(),
  managerId: z.string().uuid(),
  objectives: z.array(z.string()).optional(),
  startDate: z.coerce.date().optional(),
  reviewDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
});

export class CreatePerformanceImprovementPlanDto {
  @ApiProperty() workerId!: string;
  @ApiProperty() managerId!: string;
  @ApiPropertyOptional() objectives?: string[];
  @ApiPropertyOptional() startDate?: Date;
  @ApiPropertyOptional() reviewDate?: Date;
  @ApiPropertyOptional() endDate?: Date;
}

export const CompletePerformanceImprovementPlanDtoSchema = z.object({
  outcome: z.string().min(1),
});

export class CompletePerformanceImprovementPlanDto {
  @ApiProperty() outcome!: string;
}

export const ExtendPerformanceImprovementPlanDtoSchema = z.object({
  newEndDate: z.coerce.date(),
});

export class ExtendPerformanceImprovementPlanDto {
  @ApiProperty() newEndDate!: Date;
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

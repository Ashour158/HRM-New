import { z } from 'zod';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PipeTransform, Injectable, BadRequestException } from '@nestjs/common';

/* ── Performance Review Cycle ── */
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

/* ── Performance Review ── */
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

export const SubmitSelfReviewDtoSchema = z.object({ content: z.string().min(1) });
export class SubmitSelfReviewDto { @ApiProperty() content!: string; }

export const SubmitManagerReviewDtoSchema = z.object({ content: z.string().min(1) });
export class SubmitManagerReviewDto { @ApiProperty() content!: string; }

export const CalibratePerformanceReviewDtoSchema = z.object({ rating: z.number() });
export class CalibratePerformanceReviewDto { @ApiProperty() rating!: number; }

export const FinalizePerformanceReviewDtoSchema = z.object({ rating: z.number() });
export class FinalizePerformanceReviewDto { @ApiProperty() rating!: number; }

/* ── Goals ── */
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

export const UpdateGoalProgressDtoSchema = z.object({ currentValue: z.number() });
export class UpdateGoalProgressDto { @ApiProperty() currentValue!: number; }

/* ── Calibration Sessions ── */
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

/* ── Performance Improvement Plans ── */
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

export const CompletePerformanceImprovementPlanDtoSchema = z.object({ outcome: z.string().min(1) });
export class CompletePerformanceImprovementPlanDto { @ApiProperty() outcome!: string; }

export const ExtendPerformanceImprovementPlanDtoSchema = z.object({ newEndDate: z.coerce.date() });
export class ExtendPerformanceImprovementPlanDto { @ApiProperty() newEndDate!: Date; }

/* ── Feedback 360 Cycles ── */
export const CreateFeedback360CycleDtoSchema = z.object({
  name: z.string().min(1),
  cycleYear: z.number().int(),
  reviewCycleId: z.string().uuid().optional(),
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
  selfReviewDeadline: z.coerce.date().optional(),
  peerReviewDeadline: z.coerce.date().optional(),
  managerReviewDeadline: z.coerce.date().optional(),
  anonymityEnabled: z.boolean().optional(),
  minPeerReviews: z.number().int().optional(),
  maxPeerReviews: z.number().int().optional(),
});

export class CreateFeedback360CycleDto {
  @ApiProperty() name!: string;
  @ApiProperty() cycleYear!: number;
  @ApiPropertyOptional() reviewCycleId?: string;
  @ApiProperty() startDate!: Date;
  @ApiProperty() endDate!: Date;
  @ApiPropertyOptional() selfReviewDeadline?: Date;
  @ApiPropertyOptional() peerReviewDeadline?: Date;
  @ApiPropertyOptional() managerReviewDeadline?: Date;
  @ApiPropertyOptional() anonymityEnabled?: boolean;
  @ApiPropertyOptional() minPeerReviews?: number;
  @ApiPropertyOptional() maxPeerReviews?: number;
}

/* ── Feedback 360 Responses ── */
export const CreateFeedback360ResponseDtoSchema = z.object({
  cycleId: z.string().uuid(),
  revieweeId: z.string().uuid(),
  reviewerId: z.string().uuid(),
  relationshipType: z.string().min(1),
  isAnonymous: z.boolean().optional(),
});

export class CreateFeedback360ResponseDto {
  @ApiProperty() cycleId!: string;
  @ApiProperty() revieweeId!: string;
  @ApiProperty() reviewerId!: string;
  @ApiProperty() relationshipType!: string;
  @ApiPropertyOptional() isAnonymous?: boolean;
}

export const SubmitFeedback360ResponseDtoSchema = z.object({
  competencyScores: z.record(z.number()),
  overallRating: z.number(),
  strengths: z.string().min(1),
  improvements: z.string().min(1),
  comments: z.string().min(1),
});

export class SubmitFeedback360ResponseDto {
  @ApiProperty() competencyScores!: Record<string, number>;
  @ApiProperty() overallRating!: number;
  @ApiProperty() strengths!: string;
  @ApiProperty() improvements!: string;
  @ApiProperty() comments!: string;
}

/* ── Objectives (OKR) ── */
export const CreateObjectiveDtoSchema = z.object({
  ownerId: z.string().uuid(),
  orgUnitId: z.string().uuid().optional(),
  parentObjectiveId: z.string().uuid().optional(),
  reviewCycleId: z.string().uuid().optional(),
  title: z.string().min(1),
  description: z.string().optional(),
  period: z.string().min(1),
  alignmentType: z.string().optional(),
});

export class CreateObjectiveDto {
  @ApiProperty() ownerId!: string;
  @ApiPropertyOptional() orgUnitId?: string;
  @ApiPropertyOptional() parentObjectiveId?: string;
  @ApiPropertyOptional() reviewCycleId?: string;
  @ApiProperty() title!: string;
  @ApiPropertyOptional() description?: string;
  @ApiProperty() period!: string;
  @ApiPropertyOptional() alignmentType?: string;
}

export const UpdateObjectiveProgressDtoSchema = z.object({
  progress: z.number().min(0).max(100),
  confidenceScore: z.number().min(0).max(1),
});

export class UpdateObjectiveProgressDto {
  @ApiProperty() progress!: number;
  @ApiProperty() confidenceScore!: number;
}

/* ── Key Results (OKR) ── */
export const CreateKeyResultDtoSchema = z.object({
  objectiveId: z.string().uuid(),
  title: z.string().min(1),
  description: z.string().optional(),
  targetValue: z.number(),
  currentValue: z.number().optional(),
  startValue: z.number().optional(),
  unit: z.string().optional(),
  dueDate: z.coerce.date().optional(),
  weight: z.number().optional(),
});

export class CreateKeyResultDto {
  @ApiProperty() objectiveId!: string;
  @ApiProperty() title!: string;
  @ApiPropertyOptional() description?: string;
  @ApiProperty() targetValue!: number;
  @ApiPropertyOptional() currentValue?: number;
  @ApiPropertyOptional() startValue?: number;
  @ApiPropertyOptional() unit?: string;
  @ApiPropertyOptional() dueDate?: Date;
  @ApiPropertyOptional() weight?: number;
}

export const UpdateKeyResultProgressDtoSchema = z.object({ currentValue: z.number() });
export class UpdateKeyResultProgressDto { @ApiProperty() currentValue!: number; }

/* ── KPIs ── */
export const CreateKpiDtoSchema = z.object({
  orgUnitId: z.string().uuid(),
  name: z.string().min(1),
  description: z.string().optional(),
  targetValue: z.number(),
  unit: z.string().optional(),
  frequency: z.string().min(1),
  ownerId: z.string().uuid(),
  formula: z.string().optional(),
  dataSource: z.string().optional(),
  departmentCategory: z.string().min(1),
});

export class CreateKpiDto {
  @ApiProperty() orgUnitId!: string;
  @ApiProperty() name!: string;
  @ApiPropertyOptional() description?: string;
  @ApiProperty() targetValue!: number;
  @ApiPropertyOptional() unit?: string;
  @ApiProperty() frequency!: string;
  @ApiProperty() ownerId!: string;
  @ApiPropertyOptional() formula?: string;
  @ApiPropertyOptional() dataSource?: string;
  @ApiProperty() departmentCategory!: string;
}

export const UpdateKpiActualDtoSchema = z.object({ actualValue: z.number() });
export class UpdateKpiActualDto { @ApiProperty() actualValue!: number; }

export const AssignKpiOwnerDtoSchema = z.object({ ownerId: z.string().uuid() });
export class AssignKpiOwnerDto { @ApiProperty() ownerId!: string; }

/* ── KPI Measurements ── */
export const RecordKpiMeasurementDtoSchema = z.object({
  kpiId: z.string().uuid(),
  period: z.string().min(1),
  measuredValue: z.number(),
  notes: z.string().optional(),
});

export class RecordKpiMeasurementDto {
  @ApiProperty() kpiId!: string;
  @ApiProperty() period!: string;
  @ApiProperty() measuredValue!: number;
  @ApiPropertyOptional() notes?: string;
}

export const ValidateKpiMeasurementDtoSchema = z.object({ validatedBy: z.string().uuid() });
export class ValidateKpiMeasurementDto { @ApiProperty() validatedBy!: string; }

/* ── Review Templates ── */
export const CreateReviewTemplateDtoSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  sections: z.array(z.object({
    title: z.string(),
    questions: z.array(z.string()),
    competencyIds: z.array(z.string()),
    weight: z.number(),
  })),
  ratingScale: z.object({ min: z.number(), max: z.number(), labels: z.record(z.string()) }),
  applicableRoles: z.array(z.string()),
});

export class CreateReviewTemplateDto {
  @ApiProperty() name!: string;
  @ApiPropertyOptional() description?: string;
  @ApiProperty() sections!: Array<{ title: string; questions: string[]; competencyIds: string[]; weight: number }>;
  @ApiProperty() ratingScale!: { min: number; max: number; labels: Record<string, string> };
  @ApiProperty() applicableRoles!: string[];
}

/* ── Competencies ── */
export const CreateCompetencyDtoSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  category: z.string().min(1),
  behavioralIndicators: z.array(z.string()),
  proficiencyLevels: z.array(z.object({
    level: z.number(),
    description: z.string(),
    expectedBehaviors: z.array(z.string()),
  })),
});

export class CreateCompetencyDto {
  @ApiProperty() name!: string;
  @ApiPropertyOptional() description?: string;
  @ApiProperty() category!: string;
  @ApiProperty() behavioralIndicators!: string[];
  @ApiProperty() proficiencyLevels!: Array<{ level: number; description: string; expectedBehaviors: string[] }>;
}

/* ── Development Plans ── */
export const CreateDevelopmentPlanDtoSchema = z.object({
  workerId: z.string().uuid(),
  managerId: z.string().uuid(),
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  objectives: z.array(z.object({
    title: z.string(),
    description: z.string().optional(),
    targetDate: z.coerce.date().optional(),
    status: z.string(),
  })),
  skillsToDevelop: z.array(z.string()),
  resources: z.array(z.string()),
  startDate: z.coerce.date().optional(),
  reviewDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
});

export class CreateDevelopmentPlanDto {
  @ApiProperty() workerId!: string;
  @ApiProperty() managerId!: string;
  @ApiPropertyOptional() title?: string;
  @ApiPropertyOptional() description?: string;
  @ApiProperty() objectives!: Array<{ title: string; description?: string; targetDate?: Date; status: string }>;
  @ApiProperty() skillsToDevelop!: string[];
  @ApiProperty() resources!: string[];
  @ApiPropertyOptional() startDate?: Date;
  @ApiPropertyOptional() reviewDate?: Date;
  @ApiPropertyOptional() endDate?: Date;
}

export const RecordDevelopmentMilestoneDtoSchema = z.object({
  objectiveTitle: z.string().min(1),
  status: z.string().min(1),
});

export class RecordDevelopmentMilestoneDto {
  @ApiProperty() objectiveTitle!: string;
  @ApiProperty() status!: string;
}

/* ── Validation Pipe ── */
@Injectable()
export class ZodValidationPipe implements PipeTransform {
  constructor(private schema: z.ZodTypeAny) {}
  transform(value: unknown): unknown {
    const result = this.schema.safeParse(value);
    if (!result.success) throw new BadRequestException(result.error.format());
    return result.data;
  }
}

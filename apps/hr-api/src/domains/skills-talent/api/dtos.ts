import { z } from 'zod';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PipeTransform, Injectable, BadRequestException } from '@nestjs/common';

export const CreateSkillProfileDtoSchema = z.object({
  workerId: z.string().uuid(),
  skills: z.array(z.object({ skillId: z.string().min(1), proficiency: z.number() })).optional(),
});

export class CreateSkillProfileDto {
  @ApiProperty() workerId!: string;
  @ApiPropertyOptional() skills?: { skillId: string; proficiency: number }[];
}

export const UpdateSkillProfileDtoSchema = z.object({
  skills: z.array(z.object({ skillId: z.string().min(1), proficiency: z.number() })),
});

export class UpdateSkillProfileDto {
  @ApiProperty() skills!: { skillId: string; proficiency: number }[];
}

export const ValidateSkillProfileDtoSchema = z.object({
  validatedBy: z.string().uuid(),
});

export class ValidateSkillProfileDto {
  @ApiProperty() validatedBy!: string;
}

export const CreateTalentPoolDtoSchema = z.object({
  poolName: z.string().min(1),
  criteria: z.record(z.unknown()).optional(),
  memberIds: z.array(z.string()).optional(),
});

export class CreateTalentPoolDto {
  @ApiProperty() poolName!: string;
  @ApiPropertyOptional() criteria?: Record<string, unknown>;
  @ApiPropertyOptional() memberIds?: string[];
}

export const UpdateTalentPoolDtoSchema = z.object({
  criteria: z.record(z.unknown()),
});

export class UpdateTalentPoolDto {
  @ApiProperty() criteria!: Record<string, unknown>;
}

export const AddTalentPoolMemberDtoSchema = z.object({
  memberId: z.string().min(1),
});

export class AddTalentPoolMemberDto {
  @ApiProperty() memberId!: string;
}

export const CreateCareerPathDtoSchema = z.object({
  title: z.string().min(1),
  currentRole: z.string().min(1),
  targetRole: z.string().min(1),
  requiredSkills: z.array(z.string()).optional(),
  milestones: z.array(z.object({ milestoneId: z.string().min(1), title: z.string().min(1), requiredSkills: z.array(z.string()) })).optional(),
});

export class CreateCareerPathDto {
  @ApiProperty() title!: string;
  @ApiProperty() currentRole!: string;
  @ApiProperty() targetRole!: string;
  @ApiPropertyOptional() requiredSkills?: string[];
  @ApiPropertyOptional() milestones?: { milestoneId: string; title: string; requiredSkills: string[] }[];
}

export const AchieveCareerPathMilestoneDtoSchema = z.object({
  milestoneId: z.string().min(1),
});

export class AchieveCareerPathMilestoneDto {
  @ApiProperty() milestoneId!: string;
}

export const CreateSuccessionPlanDtoSchema = z.object({
  positionId: z.string().uuid(),
  incumbentWorkerId: z.string().uuid().optional(),
  successorCandidates: z.array(z.object({ workerId: z.string().min(1), readinessLevel: z.number() })).optional(),
});

export class CreateSuccessionPlanDto {
  @ApiProperty() positionId!: string;
  @ApiPropertyOptional() incumbentWorkerId?: string;
  @ApiPropertyOptional() successorCandidates?: { workerId: string; readinessLevel: number }[];
}

export const UpdateSuccessionReadinessDtoSchema = z.object({
  workerId: z.string().min(1),
  readinessLevel: z.number(),
});

export class UpdateSuccessionReadinessDto {
  @ApiProperty() workerId!: string;
  @ApiProperty() readinessLevel!: number;
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

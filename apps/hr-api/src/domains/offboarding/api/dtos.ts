import { z } from 'zod';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PipeTransform, Injectable, BadRequestException } from '@nestjs/common';

/**
 * NestJS pipe that validates a request body against an explicit Zod schema
 * supplied at construction time (e.g. `@Body(new ZodValidationPipe(SomeDtoSchema))`).
 * Unlike a metatype-based pipe, this can't silently no-op when a schema is
 * missing — the schema is a required constructor argument.
 */
@Injectable()
export class ZodValidationPipe implements PipeTransform {
  constructor(private schema: z.ZodTypeAny) {}
  transform(value: unknown): unknown {
    const result = this.schema.safeParse(value);
    if (!result.success) throw new BadRequestException(result.error.format());
    return result.data;
  }
}

/* ------------------------------------------------------------------ */
/*  Offboarding Plan DTOs                                              */
/* ------------------------------------------------------------------ */

export const CreateOffboardingPlanDtoSchema = z.object({
  planId: z.string().uuid(),
  workerId: z.string().uuid(),
  lastWorkingDay: z.coerce.date(),
  initiatedBy: z.string().uuid().optional(),
  reasonCategory: z.enum([
    'RESIGNATION',
    'INVOLUNTARY_TERMINATION',
    'LAYOFF_REDUNDANCY',
    'RETIREMENT',
    'END_OF_CONTRACT',
    'MUTUAL_AGREEMENT',
    'OTHER',
  ]).optional(),
  reasonNotes: z.string().optional(),
  managerId: z.string().uuid().optional(),
});

export class CreateOffboardingPlanDto {
  static zodSchema = CreateOffboardingPlanDtoSchema;

  @ApiProperty() planId!: string;
  @ApiProperty() workerId!: string;
  @ApiProperty() lastWorkingDay!: Date;
  @ApiPropertyOptional() initiatedBy?: string;
  @ApiPropertyOptional() reasonCategory?: string;
  @ApiPropertyOptional() reasonNotes?: string;
  @ApiPropertyOptional() managerId?: string;
}

/* ------------------------------------------------------------------ */
/*  Offboarding Task DTOs                                              */
/* ------------------------------------------------------------------ */

export const CreateOffboardingTaskDtoSchema = z.object({
  taskId: z.string().uuid(),
  planId: z.string().uuid(),
  title: z.string().min(1),
  description: z.string().optional(),
  assignedTo: z.string().uuid().optional(),
  ownerGroup: z.string().optional(),
  category: z.enum([
    'EXIT_CHECKLIST',
    'KNOWLEDGE_TRANSFER',
    'ASSET_RETURN',
    'ACCESS_REVOCATION_CONFIRMATION',
    'FINAL_SETTLEMENT_CONFIRMATION',
    'EXIT_INTERVIEW',
    'DOCUMENT',
    'COMPLIANCE',
  ]).optional(),
  required: z.boolean().optional(),
  evidenceType: z.string().optional(),
  evidencePayload: z.record(z.unknown()).optional(),
  dueDate: z.coerce.date().optional(),
});

export class CreateOffboardingTaskDto {
  static zodSchema = CreateOffboardingTaskDtoSchema;

  @ApiProperty() taskId!: string;
  @ApiProperty() planId!: string;
  @ApiProperty() title!: string;
  @ApiPropertyOptional() description?: string;
  @ApiPropertyOptional() assignedTo?: string;
  @ApiPropertyOptional() ownerGroup?: string;
  @ApiPropertyOptional() category?: string;
  @ApiPropertyOptional() required?: boolean;
  @ApiPropertyOptional() evidenceType?: string;
  @ApiPropertyOptional() evidencePayload?: Record<string, unknown>;
  @ApiPropertyOptional() dueDate?: Date;
}

export const ApplyOffboardingTemplateDtoSchema = z.object({
  trackCode: z.string().min(1),
  managerId: z.string().uuid().optional(),
});

export class ApplyOffboardingTemplateDto {
  static zodSchema = ApplyOffboardingTemplateDtoSchema;

  @ApiProperty() trackCode!: string;
  @ApiPropertyOptional() managerId?: string;
}

export const RecordOffboardingTaskEvidenceDtoSchema = z.object({
  evidenceType: z.string().optional(),
  evidencePayload: z.record(z.unknown()).optional(),
  completionNotes: z.string().optional(),
  completeTask: z.boolean().optional(),
});

export class RecordOffboardingTaskEvidenceDto {
  static zodSchema = RecordOffboardingTaskEvidenceDtoSchema;

  @ApiPropertyOptional() evidenceType?: string;
  @ApiPropertyOptional() evidencePayload?: Record<string, unknown>;
  @ApiPropertyOptional() completionNotes?: string;
  @ApiPropertyOptional() completeTask?: boolean;
}
